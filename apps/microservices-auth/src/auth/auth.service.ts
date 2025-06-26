/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as ffmpeg from 'fluent-ffmpeg';
import { HttpService } from '@nestjs/axios';
import { schema } from '../../../../schema/index';
import { eq } from 'drizzle-orm';
import { SupabaseClient } from '@supabase/supabase-js';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { connect as mqttConnect, MqttClient } from 'mqtt';
import { BestImageService } from './best-image/best-image.service';
import * as FormData from 'form-data';
import * as streamifier from 'streamifier';
import appleSigninAuth from 'apple-signin-auth';
import * as sharp from 'sharp';
import { tmpdir } from 'os';
import { existsSync, promises as fsPromises } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  RekognitionClient,
  CreateFaceLivenessSessionCommand,
  GetFaceLivenessSessionResultsCommand,
} from '@aws-sdk/client-rekognition';
import axios from 'axios';
import { JwtService } from '@nestjs/jwt';

interface MqttSettings {
  mqtt_host: string;
  mqtt_port: number;
  mqtt_topic: string;
}

interface SettingsResponse {
  data: MqttSettings;
}

interface GenerationResponse {
  data: {
    generation_id: string;
  };
}

interface MqttMessage {
  action?: 'progress' | 'complete';
  data?: {
    generation_id?: string;
    message?: string;
    url?: string;
  };
}

@Injectable()
export class AuthService {
  private mqttSettings: { data: SettingsResponse } | null;
  private rekognitionClient = new RekognitionClient();

  constructor(
    private bestImageService: BestImageService,
    private configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly httpService: HttpService,
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
    @Inject('POST_SERVICE') private postClient: ClientProxy,
    @Inject('DRIZZLE_CLIENT')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {
    this.mqttSettings = null;
    this.rekognitionClient = new RekognitionClient({
      region: this.configService.get<string>('AWS_REGION')!,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID')!,
        secretAccessKey: this.configService.get<string>(
          'AWS_SECRET_ACCESS_KEY',
        )!,
      },
    });
  }

  get mqttStockMafiaApi(): string {
    return this.configService.get<string>('MQTT_STOCKMAFIA_API') || '';
  }
  get mqttXApiKey(): string {
    return this.configService.get<string>('MQTT_X_API_KEY') || '';
  }
  get mqttAccessToken(): string {
    return this.configService.get<string>('MQTT_ACCESS_TOKEN') || '';
  }

  // Testing purpose

  async authHello() {
    await new Promise((res) => setTimeout(res, 5000));
    return 'Hello';
  }

  // For Guard

  private validateCheckPointProgress(
    userCheckpoint: string,
    currentStep: string,
  ) {
    const steps = schema.loginFormCheckPointEnum;
    const userIndex = steps.indexOf(userCheckpoint);
    const currentIndex = steps.indexOf(currentStep);

    if (userIndex < currentIndex - 1) {
      const requiredStep = steps[currentIndex - 1];
      throw new BadRequestException(`Please complete '${requiredStep}' first`);
    }
  }

  // Helper to fetch user by ID
  private async getUserById(userId: string) {
    const user = await this.db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, userId));
    return user[0];
  }

  // Helper to fetch userInfo by userId
  private async getUserInfo(userId: string) {
    const info = await this.db
      .select()
      .from(schema.userInfo)
      .where(eq(schema.userInfo.userId, userId));
    return info[0];
  }

  // Helper to update checkpoint
  private async updateCheckpoint(userId: string, checkPoint: string) {
    await this.db
      .update(schema.user)
      .set({ loginFormCheckPoint: checkPoint })
      .where(eq(schema.user.id, userId));
  }

  private async getUserLocation(userId: string) {
    const loc = await this.db
      .select()
      .from(schema.userLocation)
      .where(eq(schema.userLocation.userId, userId));
    return loc[0];
  }

  private async getUserMedia(userId: string) {
    const media = await this.db
      .select()
      .from(schema.userMedia)
      .where(eq(schema.userMedia.userId, userId));
    return media[0];
  }

  async verifyToken(accessToken: string) {
    try {
      const data = await this.jwtService.verifyAsync<{
        [key: string]: unknown;
      }>(accessToken);

      console.log(data);

      if (!data || !data.email) {
        throw new UnauthorizedException('Invalid or expired token');
      }
      // Ensure the returned value is of type AppUser
      return data;
    } catch (error) {
      console.log('🟡 : AuthService : error:', error);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private async verifyAppleToken(idToken: string) {
    const response = await appleSigninAuth.verifyIdToken(idToken, {
      audience: this.configService.get<string>('APPLE_CLIENT_ID')!, // Your app's bundle ID
      ignoreExpiration: true,
    });

    return {
      email: response.email,
    };
  }

  private async verifySocialToken(token: string, provider: string) {
    switch (provider) {
      case 'google': {
        // use Google Auth API
        const googleRes = await axios.get(
          `https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${token}`,
        );
        const googleData = googleRes.data as {
          email: string;
        };
        return {
          email: googleData.email,
        };
      }
      case 'facebook': {
        // Validate Facebook token
        const fbRes = await axios.get(
          `https://graph.facebook.com/me?access_token=${token}&fields=id,email,name`,
        );
        const fbData = fbRes.data as {
          email: string;
        };
        return {
          email: fbData.email,
        };
      }
      case 'apple': {
        // You will need to decode & verify Apple ID token using Apple's public key
        return await this.verifyAppleToken(token);
      }
      default: {
        throw new Error('Unsupported provider');
      }
    }
  }

  // SOCIAL LOGIN
  async socialLogin({
    token,
    provider,
  }: {
    token: string;
    provider: 'google' | 'facebook' | 'apple';
  }) {
    console.log('🟡 : 🟡 --> AuthService : token:', token);
    console.log('🟡 : 🟡 --> AuthService : provider:', provider);
    try {
      const userInfo = (await this.verifySocialToken(token, provider)) as {
        email: string;
      };
      const { email } = userInfo;

      if (!email)
        throw new UnauthorizedException('Email not found in provider data');

      let [existingUser] = await this.db
        .select()
        .from(schema.user)
        .where(eq(schema.user.email, email));

      if (!existingUser) {
        [existingUser] = await this.db
          .insert(schema.user)
          .values({
            id: uuidv4(),
            email,
            authProvider: provider,
            loginFormCheckPoint: 'STARTED',
          })
          .returning();
      }

      const jwt = this.jwtService.sign(existingUser, { expiresIn: '7d' });

      return {
        isSuccess: true,
        message: 'User created',
        data: {
          token: jwt,
          user: existingUser,
        },
      };
    } catch (err) {
      throw new Error(
        `OAuth Login failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  // NICKNAME + DOB
  async updateNickNameDOB(
    userId: string,
    data: { nickName: string; dateOfBirth: Date },
  ) {
    try {
      const { nickName, dateOfBirth } = data;

      if (!nickName || !dateOfBirth) {
        throw new BadRequestException(
          'Nick Name and Date of Birth are required',
        );
      }

      const parsedDate = new Date(dateOfBirth);
      if (isNaN(parsedDate.getTime())) {
        throw new BadRequestException('Invalid Date of Birth');
      }

      const user = await this.getUserById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      this.validateCheckPointProgress(
        user.loginFormCheckPoint ?? '',
        'INTRO_DONE',
      );

      const userInfo = await this.getUserInfo(userId);

      if (!userInfo) {
        await this.db.insert(schema.userInfo).values({
          userId,
          nickName,
          dateOfBirth: parsedDate,
        });
        await this.updateCheckpoint(userId, 'INTRO_DONE');
        return {
          isSuccess: true,
          message: 'User Info added successfully',
          data: { checkPoint: 'INTRO_DONE', nickName, dateOfBirth },
        };
      }

      await this.db
        .update(schema.userInfo)
        .set({ nickName, dateOfBirth: parsedDate })
        .where(eq(schema.userInfo.userId, userId));

      return {
        isSuccess: true,
        message: 'User Info updated successfully',
        data: {
          checkPoint: user.loginFormCheckPoint,
          nickName,
          dateOfBirth,
        },
      };
    } catch (err) {
      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException
      ) {
        throw err;
      }
      console.error('Unexpected error in updateNickNameDOB:', err);
      throw new InternalServerErrorException('Failed to update user info');
    }
  }

  // INTERESTS

  async updateInterest(userId: string, data: { interests: string[] }) {
    const { interests } = data;

    if (!interests.every((interest) => schema.allInterest.includes(interest))) {
      throw new BadRequestException('Invalid interest(s)');
    }

    const user = await this.getUserById(userId);
    if (!user) {
      throw new NotFoundException('User does not exist');
    }

    this.validateCheckPointProgress(
      user.loginFormCheckPoint ?? '',
      'INTEREST_DONE',
    );

    try {
      const existingInterests = await this.db
        .select()
        .from(schema.userInterestMapping)
        .where(eq(schema.userInterestMapping.userId, userId));

      const isFirstTime = existingInterests.length === 0;

      await this.db
        .delete(schema.userInterestMapping)
        .where(eq(schema.userInterestMapping.userId, userId));

      if (interests.length > 0) {
        await this.db.insert(schema.userInterestMapping).values(
          interests.map((interest) => ({
            userId,
            interest,
          })),
        );

        if (isFirstTime) {
          await this.updateCheckpoint(userId, 'INTEREST_DONE');
          return {
            isSuccess: true,
            message: 'Interests added successfully',
            data: { checkPoint: 'INTEREST_DONE', interests },
          };
        }
        return {
          isSuccess: true,
          message: 'Interests updated successfully',
          data: { checkPoint: user.loginFormCheckPoint, interests },
        };
      }
    } catch (err) {
      console.error('Error updating interests:', err);
      throw new InternalServerErrorException('Failed to update interests');
    }
  }

  // Location Update

  async updateLocation(
    userId: string,
    data: { location: { latitude: number; longitude: number } },
  ) {
    try {
      const { location } = data;

      if (
        typeof location.latitude !== 'number' ||
        typeof location.longitude !== 'number'
      ) {
        throw new BadRequestException('Invalid latitude or longitude');
      }

      const user = await this.getUserById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      this.validateCheckPointProgress(
        user.loginFormCheckPoint ?? '',
        'LOCATION_DONE',
      );

      const existingLocation = await this.getUserLocation(userId);
      const isFirstTime = !existingLocation;

      if (isFirstTime) {
        await this.db
          .insert(schema.userLocation)
          .values({ userId, ...location });

        await this.updateCheckpoint(userId, 'LOCATION_DONE');

        return {
          isSuccess: true,
          message: 'Location added successfully',
          data: { checkPoint: 'LOCATION_DONE', location },
        };
      }

      await this.db
        .update(schema.userLocation)
        .set(location)
        .where(eq(schema.userLocation.userId, userId));

      return {
        isSuccess: true,
        message: 'Location updated successfully',
        data: { checkPoint: user.loginFormCheckPoint, location },
      };
    } catch (err) {
      console.error('Error in updateLocation:', err);
      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException
      ) {
        throw err;
      }

      throw new InternalServerErrorException(
        `Failed to update location: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }

  // Gender Update

  async updateGender(userId: string, data: { gender: string }) {
    try {
      const { gender } = data;

      if (!schema.genderType.includes(gender)) {
        throw new BadRequestException('Invalid gender');
      }

      const user = await this.getUserById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const userInfo = await this.getUserInfo(userId);

      this.validateCheckPointProgress(
        user.loginFormCheckPoint ?? '',
        'GENDER_DONE',
      );

      const isFirstTime = !userInfo.gender;

      await this.db
        .update(schema.userInfo)
        .set({ gender })
        .where(eq(schema.userInfo.userId, userId));

      if (isFirstTime) {
        await this.updateCheckpoint(userId, 'GENDER_DONE');
        return {
          isSuccess: true,
          message: 'Gender added successfully',
          data: { checkPoint: 'GENDER_DONE', gender },
        };
      }

      return {
        isSuccess: true,
        message: 'Gender updated successfully',
        data: { checkPoint: user.loginFormCheckPoint, gender },
      };
    } catch (err) {
      console.error('Error in updateGender:', err);
      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException
      ) {
        throw err;
      }

      throw new InternalServerErrorException(
        `Failed to update gender: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }

  // Gender Preference update

  async updateGenderPreference(
    userId: string,
    data: { genderPreference: string },
  ) {
    try {
      const { genderPreference } = data;

      if (!schema.genderPreferenceType.includes(genderPreference)) {
        throw new BadRequestException('Invalid gender preference');
      }

      const user = await this.getUserById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const userInfo = await this.getUserInfo(userId);
      this.validateCheckPointProgress(
        user.loginFormCheckPoint ?? '',
        'GENDER_PREFERENCE_DONE',
      );

      const isFirstTime = !userInfo.genderPreference;

      await this.db
        .update(schema.userInfo)
        .set({ genderPreference })
        .where(eq(schema.userInfo.userId, userId));

      if (isFirstTime) {
        await this.updateCheckpoint(userId, 'GENDER_PREFERENCE_DONE');
        return {
          isSuccess: true,
          message: 'Gender preference added successfully',
          data: { checkPoint: 'GENDER_PREFERENCE_DONE', genderPreference },
        };
      }

      return {
        isSuccess: true,
        message: 'Gender preference updated successfully',
        data: { checkPoint: user.loginFormCheckPoint, genderPreference },
      };
    } catch (err) {
      console.error('Error in updateGenderPreference:', err);
      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException
      ) {
        throw err;
      }
      throw new InternalServerErrorException(
        `Failed to update gender preference: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }

  // Distance Update

  async updateDistancePreferred(
    userId: string,
    data: { distancePreferredInKm: number },
  ) {
    try {
      const { distancePreferredInKm } = data;

      if (distancePreferredInKm == null || distancePreferredInKm < 0) {
        throw new BadRequestException('Distance must be a non-negative number');
      }

      const user = await this.getUserById(userId);
      if (!user) throw new NotFoundException('User not found');

      const userInfo = await this.getUserInfo(userId);
      this.validateCheckPointProgress(
        user.loginFormCheckPoint ?? '',
        'DISTANCE_PREFERRED_DONE',
      );

      const isFirstTime = userInfo.distancePreferredInKm == null;

      await this.db
        .update(schema.userInfo)
        .set({ distancePreferredInKm })
        .where(eq(schema.userInfo.userId, userId));

      if (isFirstTime) {
        await this.updateCheckpoint(userId, 'DISTANCE_PREFERRED_DONE');
        return {
          isSuccess: true,
          message: 'Distance preference added successfully',
          data: {
            checkPoint: 'DISTANCE_PREFERRED_DONE',
            distancePreferredInKm,
          },
        };
      }

      return {
        isSuccess: true,
        message: 'Distance preference updated successfully',
        data: {
          checkPoint: user.loginFormCheckPoint,
          distancePreferredInKm,
        },
      };
    } catch (err) {
      console.error('Error in updateDistancePreferred:', err);
      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException
      ) {
        throw err;
      }
      throw new InternalServerErrorException(
        `Failed to update distance preference: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`,
      );
    }
  }

  // KYC Update
  async createSessionId(userId: string) {
    try {
      const user = await this.getUserById(userId);
      if (!user) throw new NotFoundException('User not found');

      this.validateCheckPointProgress(
        user.loginFormCheckPoint ?? '',
        'KYC_DONE',
      );

      const command = new CreateFaceLivenessSessionCommand({});
      const response = await this.rekognitionClient.send(command);

      await this.db
        .update(schema.userInfo)
        .set({ sessionId: response.SessionId })
        .where(eq(schema.userInfo.userId, userId));
      return {
        isSuccess: true,
        data: {
          sessionId: response.SessionId,
        },
      };
    } catch (err) {
      console.error('Error creating KYC session:', err);
      if (err instanceof NotFoundException) {
        throw err;
      }
      throw new InternalServerErrorException(
        `Failed to create KYC session: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }

  async updateKyc(userId: string, data: { sessionId: string }) {
    try {
      // AWS Integration
      const { sessionId } = data;

      const user = await this.getUserById(userId);
      if (!user) throw new NotFoundException('User not found');

      const userInfo = await this.getUserInfo(userId);
      if (!userInfo) throw new NotFoundException('User info not found');

      this.validateCheckPointProgress(
        user.loginFormCheckPoint ?? '',
        'KYC_DONE',
      );

      const command = new GetFaceLivenessSessionResultsCommand({
        SessionId: sessionId,
      });
      const response = await this.rekognitionClient.send(command);
      const confidence = Math.round(response.Confidence ?? 0);

      await this.db
        .update(schema.userInfo)
        .set({
          sessionId,
          confidenceScore: confidence,
        })
        .where(eq(schema.userInfo.userId, userId));

      await this.updateCheckpoint(userId, 'KYC_DONE');

      return {
        isSuccess: true,
        message: 'User KYC completed successfully',
        data: {
          confidenceScore: confidence,
          checkPoint: 'KYC_DONE',
        },
      };
    } catch (err) {
      console.error('KYC Update Error:', err);
      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException
      ) {
        throw err;
      }
      throw new InternalServerErrorException(
        `KYC update failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }

  private async generateSlideShowAndUploadToSupabase(
    images: string[],
    userId: string,
  ) {
    const videoPath = await this.getSlideShow(images);
    const slideshowUrl = await this.uploadVideoToSupabase(videoPath, userId);
    await this.cleanupJobFolder(videoPath);

    console.log('-------- ✅ SLIDE SHOW GENERATED --------', slideshowUrl);

    return slideshowUrl;
  }

  private async startVideoProcessingInBackground(userId: string) {
    try {
      const mediaData = await this.getUserMedia(userId);
      if (!mediaData || !mediaData.photos || mediaData.photos.length === 0)
        return;

      console.log('🟡🟡 Slide Show Generation Started');

      const bestImage =
        (await this.bestImageService.selectBestImage(mediaData.photos)) ||
        mediaData.photos[0];

      console.log('🟡🟡 Best Image -->', bestImage);

      const [slideshowUrl, aiVideoRes] = await Promise.all([
        this.generateSlideShowAndUploadToSupabase(mediaData.photos, userId),
        this.generateAiVideo(bestImage, userId),
      ]);

      // const videoPath = await this.getSlideShow(mediaData.photos);
      // const slideshowUrl = await this.uploadVideoToSupabase(videoPath, userId);
      // this.cleanupJobFolder(videoPath);

      await this.db
        .update(schema.userMedia)
        .set({ photoSlideShow: [slideshowUrl] })
        .where(eq(schema.userMedia.userId, userId));

      // const aiVideoRes = await this.generateAiVideo(
      //   // Apply best image --> Pending
      //   mediaData.photos[0],
      //   userId,
      // );
      const aiVideo = aiVideoRes.videoUrl;

      console.log('-------- ✅ ✅ AI VIDEO CREATED --------', aiVideo);

      const updatedVideos = [...(mediaData.aiVideos ?? []), aiVideo];

      await this.db
        .update(schema.userMedia)
        .set({
          aiVideos: updatedVideos,
          aiVideoProgress: '100%',
        })
        .where(eq(schema.userMedia.userId, userId));

      await this.postClient
        .send(
          { cmd: 'post-create-post' },
          {
            userId,
            data: {
              postMediaUrl: aiVideo,
              postType: 'AiVideo',
            },
          },
        )
        .toPromise();

      await this.postClient
        .send(
          { cmd: 'post-create-post' },
          {
            userId,
            data: {
              postMediaUrl: slideshowUrl,
              postType: 'PhotoSlideShow',
            },
          },
        )
        .toPromise();

      await this.updateCheckpoint(userId, 'VIDEO_PROCESSED_DONE');
    } catch (err) {
      console.error('------- ‼️ ❌ AI IMAGE GENERATION ISSUE ❌ ‼️ ---------');
      console.log(err.message);
      console.log('------------------------------------------------');
      console.log(err?.response);
      console.log('------------------------------------------------');
      console.error('Background video generation failed:\n----->', err);
      console.log('------------------------------------------------');
    }
  }

  async updatePhotos(userId: string, data: { photos?: string[] }) {
    try {
      const { photos } = data;

      const user = await this.getUserById(userId);
      if (!user) throw new NotFoundException('User not found');

      const userInfo = await this.getUserInfo(userId);
      if (!userInfo) throw new NotFoundException('User info not found');

      this.validateCheckPointProgress(
        user.loginFormCheckPoint ?? '',
        'PHOTOS_DONE',
      );

      const existingMedia = await this.db
        .select()
        .from(schema.userMedia)
        .where(eq(schema.userMedia.userId, userId));

      if (existingMedia.length === 0) {
        await this.db.insert(schema.userMedia).values({
          userId,
          photos: photos ?? [],
        });

        await this.updateCheckpoint(userId, 'PHOTOS_DONE');
      } else {
        await this.db
          .update(schema.userMedia)
          .set({ photos: photos })
          .where(eq(schema.userMedia.userId, userId));
      }

      this.startVideoProcessingInBackground(userId).catch((err) =>
        console.error('Video background task failed:', err),
      );

      return {
        isSuccess: true,
        message: 'Photos updated successfully',
        data: {
          checkPoint: user.loginFormCheckPoint,
          photos,
        },
      };
    } catch (err) {
      console.error('Photo update error:', err);
      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException
      ) {
        throw err;
      }
      throw new InternalServerErrorException(
        `Failed to update media: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`,
      );
    }
  }

  // Media Preference

  async updateMedia(
    userId: string,
    data: { mediaPreference: string; mediaUrl: string },
  ) {
    try {
      const { mediaPreference, mediaUrl } = data;

      if (!mediaPreference || !mediaUrl) {
        throw new BadRequestException(
          'mediaPreference and mediaUrl are required.',
        );
      }

      const user = await this.getUserById(userId);
      if (!user) throw new NotFoundException('User not found');

      // const userInfo = await this.getUserInfo(userId);
      // if (!userInfo) throw new NotFoundException('User info not found');

      this.validateCheckPointProgress(
        user.loginFormCheckPoint ?? '',
        'MEDIA_PREFERENCE_DONE',
      );

      const existingMedia = await this.db
        .select()
        .from(schema.userMedia)
        .where(eq(schema.userMedia.userId, userId));

      if (existingMedia.length === 0) {
        throw new NotFoundException('User media record not found');
      }

      // await this.db
      //   .update(schema.userMedia)
      //   .set({
      //     preferredMedia: [mediaUrl],
      //   })
      //   .where(eq(schema.userMedia.userId, userId));

      // await this.db
      //   .update(schema.userInfo)
      //   .set({
      //     userMediaPreference: mediaPreference,
      //   })
      //   .where(eq(schema.userInfo.userId, userId));

      const [resp] = await this.db
        .update(schema.post)
        .set({ isPublic: true })
        .where(eq(schema.post.postMediaUrl, mediaUrl))
        .returning();

      await this.updateCheckpoint(userId, 'MEDIA_PREFERENCE_DONE');

      if (resp) {
        const { postId } = resp;
        await this.generatePostEntryInScoresTable(postId, userId);
      }

      return {
        isSuccess: true,
        message: 'User media preference updated successfully',
        data: {
          checkPoint: 'MEDIA_PREFERENCE_DONE',
          mediaPreference,
          mediaUrl,
        },
      };
    } catch (err) {
      console.error('Media update error:', err);
      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException
      ) {
        throw err;
      }
      throw new InternalServerErrorException(
        `Failed to update media preference: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`,
      );
    }
  }

  private async generatePostEntryInScoresTable(postId: string, userId: string) {
    const [userDataFromLocationTable] = await this.db
      .select({
        userId: schema.userLocation.userId,
        latitude: schema.userLocation.latitude,
        longitude: schema.userLocation.longitude,
      })
      .from(schema.userLocation)
      .where(eq(schema.userLocation.userId, userId));

    const [userDataFromInfoTable] = await this.db
      .select({
        dateOfBirth: schema.userInfo.dateOfBirth,
        distancePreferredInKm: schema.userInfo.distancePreferredInKm,
        gender: schema.userInfo.gender,
        genderPreference: schema.userInfo.genderPreference,
      })
      .from(schema.userInfo)
      .where(eq(schema.userInfo.userId, userId));

    const interestsResult = await this.db
      .select({ interest: schema.userInterestMapping.interest })
      .from(schema.userInterestMapping)
      .where(eq(schema.userInterestMapping.userId, userId));

    if (
      !userDataFromLocationTable ||
      !userDataFromInfoTable ||
      !interestsResult ||
      !userDataFromInfoTable.dateOfBirth ||
      !userDataFromInfoTable.distancePreferredInKm ||
      !userDataFromInfoTable.gender ||
      !userDataFromInfoTable.genderPreference
    ) {
      throw new InternalServerErrorException(
        'user data for location, info or interests not found!',
      );
    }

    const interests: string[] = interestsResult.map((row) => row.interest);

    await this.db.insert(schema.userPostsScores).values({
      userId,
      postId,
      isPublic: true,
      userPostBaseScore: 0,
      longitude: userDataFromLocationTable?.longitude,
      latitude: userDataFromLocationTable?.latitude,
      distancePreferredInKm: userDataFromInfoTable?.distancePreferredInKm,
      dateOfBirth: userDataFromInfoTable.dateOfBirth,
      gender: userDataFromInfoTable.gender,
      genderPreference: userDataFromInfoTable.genderPreference,
      interests: interests,
    });

    console.log('🟡 : Inserted Post IN PostScores Table --------');
  }

  // Best Image selection and Video Generation using AI will be integrated later
  // async selectBestImage(photos: string[]) {}

  private async uploadVideoToSupabase(
    videoPath: string,
    userId: string,
  ): Promise<string> {
    const bucket = 'user-videos';
    const filename = `${userId}-${Date.now()}.mp4`;
    const fileBuffer = await fsPromises.readFile(videoPath);

    const { error } = await this.supabase.storage
      .from(bucket)
      .upload(filename, fileBuffer, {
        contentType: 'video/mp4',
        upsert: true,
      });

    if (error) {
      console.error('Upload failed:', error.message);
      throw new InternalServerErrorException('Video upload failed');
    }

    const { data } = this.supabase.storage.from(bucket).getPublicUrl(filename);
    return data.publicUrl;
  }

  private async getSlideShow(images: string[]): Promise<string> {
    const jobId = uuidv4();
    const jobDir = join(tmpdir(), `slideshow-${jobId}`);
    const inputTxtPath = join(jobDir, 'input.txt');
    const outputVideoPath = join(jobDir, 'output.mp4');

    try {
      if (!existsSync(jobDir)) {
        await fsPromises.mkdir(jobDir, { recursive: true });
      }
      const normalizedImagePaths: string[] = [];

      for (let i = 0; i < images.length; i++) {
        const imageUrl = images[i];
        const localPath = join(jobDir, `img-${i}.jpg`);
        const response = (await this.httpService.axiosRef.get(imageUrl, {
          responseType: 'arraybuffer',
        })) as { data: ArrayBuffer };

        const imageBuffer = Buffer.from(response.data);
        await sharp(imageBuffer).jpeg().toFile(localPath);
        normalizedImagePaths.push(localPath);
      }

      let ffmpegInput = '';
      for (let i = 0; i < normalizedImagePaths.length; i++) {
        ffmpegInput += `file '${normalizedImagePaths[i]}'\n`;
        // Add duration for all except the last image
        if (i < normalizedImagePaths.length) {
          ffmpegInput += `duration 2\n`;
        }
      }
      // Repeat last image once (required)
      ffmpegInput += `file '${normalizedImagePaths[normalizedImagePaths.length - 1]}'`;

      await fsPromises.writeFile(inputTxtPath, ffmpegInput);

      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(inputTxtPath)
          .inputFormat('concat')
          .inputOptions('-safe 0')
          .outputOptions(['-vf scale=720:1280', '-pix_fmt yuv420p', '-r 25'])
          .on('end', resolve)
          .on('error', (err) =>
            reject(new Error('FFmpeg error: ' + err.message)),
          )
          .output(outputVideoPath)
          .run();
      });

      return outputVideoPath;
    } catch (err) {
      console.error('Slideshow generation failed:', err);
      throw new InternalServerErrorException('Failed to generate slideshow');
    }
  }

  private async cleanupJobFolder(videoPath: string): Promise<void> {
    try {
      const jobDir = videoPath.split('/output.mp4')[0];
      if (existsSync(jobDir)) {
        await fsPromises.rm(jobDir, { recursive: true, force: true });
        console.log('Temp job folder cleaned:', jobDir);
      }
    } catch (err) {
      console.warn('Failed to clean job folder:', err);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async refreshMqttSettings() {
    console.log('Cron job running every minutes');
    this.mqttSettings = (await this.httpService
      .get<SettingsResponse>(`${this.mqttStockMafiaApi}settings`, {
        headers: {
          Authorization: `Bearer ${this.mqttAccessToken}`,
          'X-API-KEY': this.mqttXApiKey,
        },
      })
      .toPromise()) as { data: SettingsResponse };
  }

  private async generateAiVideo(
    imageUrl: string,
    userId: string,
  ): Promise<{ videoUrl: string; progress: string[] }> {
    try {
      if (!this.mqttSettings) {
        await this.refreshMqttSettings();
      }

      if (!this.mqttSettings) {
        throw new InternalServerErrorException(
          'MQTT settings not available, please try again later',
        );
      }
      const {
        mqtt_host: mqttHost = '',
        mqtt_port: mqttPort = '',
        mqtt_topic: mqttTopic = '',
      } = this.mqttSettings?.data?.data || {};

      const imageRes = (await this.httpService.axiosRef.get(imageUrl, {
        responseType: 'arraybuffer',
      })) as { data: ArrayBuffer };
      const imageBuffer = Buffer.from(imageRes.data);

      const formData = new FormData();
      formData.append('image', streamifier.createReadStream(imageBuffer), {
        filename: 'image.jpg',
        contentType: 'image/jpeg',
      });

      const generationRes =
        (await this.httpService.axiosRef.post<GenerationResponse>(
          `${this.mqttStockMafiaApi}media-generations`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${this.mqttAccessToken}`,
              'X-API-KEY': this.mqttXApiKey,
              ...formData.getHeaders(),
            },
          },
        )) as { data: GenerationResponse };

      console.log(
        '-------- 🟡 🟡 AI GENERATION RESPONSE --------',
        generationRes,
      );

      const generationId = generationRes.data.data.generation_id;
      if (!generationId)
        throw new Error('No generation_id returned from media-generations API');

      return await new Promise((resolve, reject) => {
        const client: MqttClient = mqttConnect(
          `mqtt://${mqttHost}:${mqttPort}`,
        );
        const progressUpdates: string[] = [];

        const timeout = setTimeout(() => {
          client.end();
          reject(new Error('Timeout: AI video not generated within 300s'));
        }, 300000);

        client.on('connect', () => {
          client.subscribe(mqttTopic, (err) => {
            if (err) {
              clearTimeout(timeout);
              client.end();
              reject(new Error('MQTT subscription failed'));
            }
          });
        });

        let flag25: boolean = false;
        let flag50: boolean = false;
        let flag75: boolean = false;

        client.on('message', (topic, message) => {
          void (async () => {
            try {
              const payload = JSON.parse(message.toString()) as MqttMessage;
              if (payload.data?.generation_id !== generationId) return;

              if (payload.action === 'progress' && payload.data?.message) {
                console.log('AI Video Progress:', payload.data.message);
                progressUpdates.push(payload.data.message);

                const currentProgress = payload.data.message.split('%')[0];

                // Update DB with progress
                if (Number(currentProgress) >= 25 && !flag25) {
                  flag25 = true;
                  await this.db
                    .update(schema.userMedia)
                    .set({ aiVideoProgress: '25%' })
                    .where(eq(schema.userMedia.userId, userId));
                }
                if (Number(currentProgress) >= 50 && !flag50) {
                  flag50 = true;
                  await this.db
                    .update(schema.userMedia)
                    .set({ aiVideoProgress: '50%' })
                    .where(eq(schema.userMedia.userId, userId));
                }
                if (Number(currentProgress) >= 75 && !flag75) {
                  flag75 = true;
                  await this.db
                    .update(schema.userMedia)
                    .set({ aiVideoProgress: '75%' })
                    .where(eq(schema.userMedia.userId, userId));
                }
              }

              if (payload.action === 'complete' && payload.data?.url) {
                clearTimeout(timeout);
                client.end();
                await this.db
                  .update(schema.userMedia)
                  .set({ aiVideoProgress: '100%' })
                  .where(eq(schema.userMedia.userId, userId));

                return resolve({
                  videoUrl: payload.data.url,
                  progress: progressUpdates,
                });
              }
            } catch (err) {
              console.error('MQTT error:', err);
            }
          })();
        });

        client.on('error', (err) => {
          console.log(
            '-------- ❌ 🔴 🔴 AI GENERATION RESPONSE message "ERROR" 🔴 🔴 ❌ --------',
          );
          console.log(err.message);
          console.log('--------------------------------------------------');
          console.log(err);
          console.log('--------------------------------------------------');
          clearTimeout(timeout);
          client.end();
          reject(err);
        });
      });
    } catch (err) {
      console.log(
        '-------- ❌ ❌ ❌ AI Video Generation Failed ❌ ❌ ❌ --------',
      );
      console.log(err.message);
      console.log(
        '---------------- err.response.data ----------------------------------',
      );
      console.log(err.response.data);
      console.log('--------------------------------------------------');
      throw new InternalServerErrorException('Failed to generate AI video');
    }
  }

  async getVideo(userId: string) {
    try {
      const mediaData = await this.getUserMedia(userId);
      if (!mediaData) throw new NotFoundException('No media found for user');

      const hasSlideshow = !!mediaData.photoSlideShow;
      const hasAiVideo = (mediaData.aiVideos ?? []).length > 0;

      if (!hasSlideshow || !hasAiVideo) {
        return {
          isSuccess: true,
          data: {
            isPhotoSlideShowProcessed: hasSlideshow,
            isAiVideoProcessed: hasAiVideo,
            aiVideoProgress: mediaData.aiVideoProgress ?? '0%',
          },
        };
      }

      return {
        isSuccess: true,
        data: {
          isPhotoSlideShowProcessed: true,
          isAiVideoProcessed: true,
          aiVideoProgress: '100%',
          aiVideo: (mediaData.aiVideos ?? [])[
            (mediaData.aiVideos ?? []).length - 1
          ],
          photoSlideShow: mediaData.photoSlideShow,
        },
      };
    } catch (err) {
      console.error('Video fetch error:', err);
      throw new InternalServerErrorException(
        `Failed to get video: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }

  // ----------------------------------------- GET ENDPOINTS ------------------

  async getDetails(userId: string) {
    // Check if user exists
    const userRow = await this.db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, userId));

    if (userRow.length === 0) {
      throw new Error('User not found');
    }

    const user = userRow[0];

    // Parallel fetch of user-related data
    const [userInfo, location, media, interestsRaw] = await Promise.all([
      this.db
        .select({
          nickName: schema.userInfo.nickName,
          dateOfBirth: schema.userInfo.dateOfBirth,
          gender: schema.userInfo.gender,
          distancePreferredInKm: schema.userInfo.distancePreferredInKm,
        })
        .from(schema.userInfo)
        .where(eq(schema.userInfo.userId, userId)),

      this.db
        .select()
        .from(schema.userLocation)
        .where(eq(schema.userLocation.userId, userId)),

      this.db
        .select({
          photos: schema.userMedia.photos,
          videos: schema.userMedia.aiVideos,
          photoSlideShow: schema.userMedia.photoSlideShow,
        })
        .from(schema.userMedia)
        .where(eq(schema.userMedia.userId, userId)),

      await this.db
        .select()
        .from(schema.userInterestMapping)
        .where(eq(schema.userInterestMapping.userId, userId)),
    ]);

    return {
      id: user.id,
      email: user.email,
      intro: userInfo[0] ?? null,
      location: location[0] ?? null,
      gender: userInfo[0]?.gender ?? null,
      distancePreferredInKm: userInfo[0]?.distancePreferredInKm ?? null,
      loginFormCheckPoint: user.loginFormCheckPoint ?? null,
      photos: media[0]?.photos ?? [],
      aiVideos: media[0]?.videos ?? [],
      photoSlideShow: media[0]?.photoSlideShow ?? [],
      interests: interestsRaw.map((i) => i.interest),
    };
  }
}
