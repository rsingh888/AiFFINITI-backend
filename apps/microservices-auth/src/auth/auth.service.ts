import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { schema } from '../../../../schema/index';
import { eq } from 'drizzle-orm';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { connect as mqttConnect, MqttClient } from 'mqtt';

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
  constructor(
    private configService: ConfigService,
    private readonly httpService: HttpService,
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
    @Inject('POST_SERVICE') private postClient: ClientProxy,
    @Inject('DRIZZLE_CLIENT')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  get stockmafiaApi(): string {
    return this.configService.get<string>('STOCKMAFIA_API') || '';
  }
  get xApiKey(): string {
    return this.configService.get<string>('X_API_KEY') || '';
  }
  get accessToken(): string {
    return this.configService.get<string>('ACCESS_TOKEN') || '';
  }

  // Testing purpose

  async authHello() {
    await new Promise((res) => setTimeout(res, 5000));
    return 'Hello';
  }

  // For Guard
  async verifyToken(accessToken: string) {
    const { data, error } = await this.supabase.auth.getUser(accessToken);

    if (error || !data?.user) {
      console.log('🟡 : AuthService : error:', error);
      throw new UnauthorizedException('Invalid or expired token');
    }

    return { ...data.user };
  }

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

  // SOCIAL LOGIN
  async socialLogin(user: User) {
    try {
      const { email: userEmail, user_metadata, app_metadata } = user;
      const provider = app_metadata?.provider as 'google' | 'facebook';

      if (!userEmail) throw new Error('Email is missing from Supabase user');
      if (!provider) throw new Error('Auth provider is not specified');

      const isEmailVerified = Boolean(user_metadata?.email_verified);

      const existing = await this.db
        .select()
        .from(schema.user)
        .where(eq(schema.user.email, userEmail));

      if (existing.length > 0) {
        return {
          isSuccess: true,
          message: 'User already exists',
          userDetail: {
            email: userEmail,
            loginCheckPoint: existing[0].loginFormCheckPoint,
          },
        };
      }

      await this.db.insert(schema.user).values({
        id: user.id,
        email: userEmail,
        isEmailVerified,
        authProvider: provider,
        loginFormCheckPoint: 'STARTED',
      });

      return {
        isSuccess: true,
        message: 'User Added to DB',
        data: {
          checkPoint: 'STARTED',
          user,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`OAuth Sign-In failed: ${message}`);
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

  // async createId(userId: string) {
  //   const response = await this.httpService
  //     .post<{ sessionId: string }>(
  //       'https://api.biopassid.com/v1/liveness/session',
  //       {
  //         settings: {
  //           // Optional: configure settings if needed
  //           challengeType: 'PASSIVE', // or 'ACTIVE'
  //           locale: 'en',
  //         },
  //       },
  //       {
  //         headers: {
  //           Authorization: `Bearer ${this.biopassKey}`,
  //           'Content-Type': 'application/json',
  //         },
  //       },
  //     )
  //     .toPromise();

  //   if (!response || !response.data || !response.data.sessionId) {
  //     throw new Error('Failed to create liveness session or missing sessionId');
  //   }

  async updateKyc(userId: string) {
    try {
      // Placeholder for actual BioPass integration
      const candidateId = 'hf3u-fjkejrjfejk-njhjbvherbh';

      const user = await this.getUserById(userId);
      if (!user) throw new NotFoundException('User not found');

      const userInfo = await this.getUserInfo(userId);
      if (!userInfo) throw new NotFoundException('User info not found');

      this.validateCheckPointProgress(
        user.loginFormCheckPoint ?? '',
        'KYC_DONE',
      );

      await this.db
        .update(schema.userInfo)
        .set({ candidateId })
        .where(eq(schema.userInfo.userId, userId));

      await this.updateCheckpoint(userId, 'KYC_DONE');

      return {
        isSuccess: true,
        message: 'User KYC completed successfully',
        data: {
          candidateId,
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

  // photos Update  and Verify Photos

  // async verifyPhotos(userId: string, data: { photos: string[] }) {
  //   try {
  //     const { photos } = data;

  //     if (!photos) {
  //       throw new Error('Minimum 1 photos are required for verification');
  //     }

  //     const userInfo = await this.db
  //       .select()
  //       .from(schema.userInfo)
  //       .where(eq(schema.userInfo.userId, userId))
  //       .limit(1);

  //     if (userInfo.length === 0 || !userInfo[0].candidateId) {
  //       throw new Error('Candidate ID not found for user');
  //     }

  //     const candidateId = userInfo[0].candidateId;

  //     for (const photoBase64 of photos) {
  //       const verifyPayload = {
  //         CandidateId: candidateId,
  //         ImageBase64: photoBase64,
  //       };

  //       const verifyRes = await this.httpService
  //         .post<{ MatchSuccess: boolean }>(
  //           `${this.biopassApiUrl}/face/verify/1to1`,
  //           verifyPayload,
  //           {
  //             headers: {
  //               'Content-Type': 'application/json',
  //               'BIOPASS-API-KEY': this.biopassKey,
  //             },
  //           },
  //         )
  //         .toPromise();

  //       if (!verifyRes?.data?.MatchSuccess) {
  //         throw new Error('Face verification failed for one or more photos');
  //       }
  //     }

  //     return { success: true, message: 'All photos verified successfully' };
  //   } catch (err) {
  //     const errorMessage = err instanceof Error ? err.message : 'Unknown error';
  //     throw new Error(`Photo verification failed: ${errorMessage}`);
  //   }
  // }

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

        return {
          isSuccess: true,
          message: 'Photos added successfully',
          data: {
            checkPoint: 'PHOTOS_DONE',
            photos,
          },
        };
      }

      const currentMedia = existingMedia[0];

      const updatedPhotos = photos
        ? [...new Set([...(currentMedia.photos ?? []), ...photos])]
        : currentMedia.photos;

      await this.db
        .update(schema.userMedia)
        .set({ photos: updatedPhotos })
        .where(eq(schema.userMedia.userId, userId));

      return {
        isSuccess: true,
        message: 'Photos updated successfully',
        data: {
          checkPoint: user.loginFormCheckPoint,
          photos: updatedPhotos,
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

      const userInfo = await this.getUserInfo(userId);
      if (!userInfo) throw new NotFoundException('User info not found');

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

      await this.db
        .update(schema.userMedia)
        .set({
          preferredMedia: [mediaUrl],
        })
        .where(eq(schema.userMedia.userId, userId));

      await this.db
        .update(schema.userInfo)
        .set({
          userMediaPreference: mediaPreference,
        })
        .where(eq(schema.userInfo.userId, userId));

      await this.db
        .update(schema.post)
        .set({ isPublic: true })
        .where(eq(schema.post.postMediaUrl, mediaUrl));

      await this.updateCheckpoint(userId, 'MEDIA_PREFERENCE_DONE');

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

  // Best Image selection and Video Generation using AI will be integrated later

  private async generateAiVideo(image: string): Promise<string> {
    try {
      const settingsRes = await this.httpService
        .get<SettingsResponse>(`${this.stockmafiaApi}settings`, {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'X-API-KEY': this.xApiKey,
          },
        })
        .toPromise();

      if (!settingsRes?.data?.data) {
        throw new Error('Failed to fetch MQTT settings from API');
      }

      const {
        mqtt_host: mqttHost,
        mqtt_port: mqttPort,
        mqtt_topic: mqttTopic,
      } = settingsRes.data.data;

      const generationRes = await this.httpService
        .post<GenerationResponse>(
          `${this.stockmafiaApi}media-generations`,
          { image },
          {
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              'X-API-KEY': this.xApiKey,
            },
          },
        )
        .toPromise();

      const generationId = generationRes?.data?.data?.generation_id;
      if (!generationId) {
        throw new Error('No generation_id returned from media-generations API');
      }

      return await new Promise<string>((resolve, reject) => {
        const client: MqttClient = mqttConnect(
          `mqtt://${mqttHost}:${mqttPort}`,
        );

        const timeout = setTimeout(() => {
          client.end();
          reject(new Error('Timeout: No video generated within 60 seconds'));
        }, 60000);

        client.on('connect', () => {
          client.subscribe(mqttTopic, (err) => {
            if (err) {
              clearTimeout(timeout);
              client.end();
              reject(new Error('Failed to subscribe to MQTT topic'));
            }
          });
        });

        client.on('message', (topic, message) => {
          try {
            const payload = JSON.parse(
              message.toString(),
            ) as unknown as MqttMessage;

            if (
              payload.action === 'complete' &&
              payload.data?.generation_id === generationId &&
              payload.data?.url
            ) {
              clearTimeout(timeout);
              client.end();
              resolve(payload.data.url);
            }
          } catch (err) {
            console.error('Error parsing MQTT message:', err);
          }
        });

        client.on('error', (err) => {
          clearTimeout(timeout);
          client.end();
          reject(err);
        });
      });
    } catch (error) {
      console.error('Video generation error:', error);
      throw new InternalServerErrorException(
        `Failed to generate video: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getVideo(userId: string) {
    try {
      const mediaData = await this.getUserMedia(userId);

      if (!mediaData) {
        throw new NotFoundException('No media found for this user.');
      }

      const userPhotos = mediaData.photos;

      if (!userPhotos || userPhotos.length < 1) {
        throw new BadRequestException(
          'At least one image is required to generate a video.',
        );
      }

      // TODO: Use Google Vision API to select the best image
      // const bestImage = await this.selectBestImage(userPhotos);
      // const bestImage = userPhotos[0];
      // TODO: Integrate with AI video generation service

      const aiVideo =
        'https://drive.google.com/file/d/1BxTbeqXf56cTa1B5x8OfaplD9s_Vw9Yg/view?usp=drivesdk';

      const photoSlideShow =
        'https://drive.google.com/file/d/1NSlIVGqSLP4uOITpsRhjzkHdexP_iE7G/view?usp=sharing';

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
              postMediaUrl: photoSlideShow,
              postType: 'PhotoSlideShow',
            },
          },
        )
        .toPromise();

      const updatedVideos = [...(mediaData.videos || []), aiVideo];

      await this.db
        .update(schema.userMedia)
        .set({ videos: updatedVideos })
        .where(eq(schema.userMedia.userId, userId));

      await this.updateCheckpoint(userId, 'VIDEO_PROCESSED_DONE');

      const [user] = await this.db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, userId));

      if (!user) {
        throw new NotFoundException('User not found.');
      }

      return {
        isSuccess: true,
        data: {
          checkPoint: user.loginFormCheckPoint,
          aiVideo,
          photoSlideShow,
        },
      };
    } catch (err) {
      console.error('Video generation error:', err);
      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException
      ) {
        throw err;
      }
      throw new InternalServerErrorException(
        `Failed to generate video: ${err instanceof Error ? err.message : 'Unknown error'}`,
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
          videos: schema.userMedia.videos,
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
      videos: media[0]?.videos ?? [],
      interests: interestsRaw.map((i) => i.interest),
    };
  }
}
