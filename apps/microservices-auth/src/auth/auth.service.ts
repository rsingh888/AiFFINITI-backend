import { Inject, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { schema } from '../../../../schema/index';
import { eq } from 'drizzle-orm';
import { inArray } from 'drizzle-orm';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ConfigService } from '@nestjs/config';

// interface imageResponse {
//   imageBase64: string;
// }
// interface EnrollResponse {
//   Success: boolean;
//   Message?: string;
//   Candidate?: { Person?: { Id?: string } };
// }
@Injectable()
export class AuthService {
  constructor(
    private configService: ConfigService,
    private readonly httpService: HttpService,
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
    @Inject('DRIZZLE_CLIENT')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  get biopassKey(): string {
    return this.configService.get<string>('BIOPASS_API_KEY') || '';
  }
  get biopassApiUrl(): string {
    return this.configService.get<string>('BIOPASS_API_URL') || '';
  }

  // Testing purpose

  async authHello() {
    await new Promise((res) => setTimeout(res, 5000));
    return 'Hello';
  }

  // for granting new access token to user

  // async refreshSupabaseSession(refreshToken: string) {
  //   const client = createClient(
  //     this.configService.get<string>('SUPABASE_URL') || '',
  //     this.configService.get<string>('SUPABASE_KEY') || '',
  //   );

  //   const { data, error } = await client.auth.refreshSession({
  //     refresh_token: refreshToken,
  //   });

  //   if (error || !data.session?.access_token) {
  //     throw new Error('Failed to refresh token');
  //   }

  //   return {
  //     accessToken: data.session.access_token,
  //     refreshToken: data.session.refresh_token,
  //     expiresIn: data.session.expires_in,
  //     user: data.session.user,
  //   };
  // }

  // For Guard
  async verifyToken(accessToken: string) {
    const { data, error } = await this.supabase.auth.getUser(accessToken);
    if (error || !data?.user) {
      console.log('🟡 : AuthService : error:', error);
      throw new Error('Invalid or expired token');
    }
    return { ...data.user };
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

  private async getUserInterests(userId: string) {
    return await this.db
      .select()
      .from(schema.userInterestMapping)
      .where(eq(schema.userInterestMapping.userId, userId));
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
      throw new Error(`❌ OAuth Sign-In failed: ${message}`);
    }
  }

  // NICKNAME + DOB
  async updateNickNameDOB(
    userId: string,
    data: { nickName: string; dateOfBirth: Date },
  ) {
    try {
      const { nickName, dateOfBirth } = data;

      if (!nickName || !dateOfBirth)
        throw new Error('Nick Name and Date of Birth are required');

      const parsedDate = new Date(dateOfBirth);
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
          message: 'User Info Added successfully',
          data: { checkPoint: 'INTRO_DONE', nickName, dateOfBirth },
        };
      }

      await this.db
        .update(schema.userInfo)
        .set({ nickName, dateOfBirth: parsedDate })
        .where(eq(schema.userInfo.userId, userId));

      const user = await this.getUserById(userId);
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
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to update user info: ${message}`);
    }
  }

  // INTERESTS
  async updateInterest(userId: string, data: { interests: string[] }) {
    const { interests } = data;

    if (!interests.every((interest) => schema.allInterest.includes(interest))) {
      throw new Error('Invalid interest(s)');
    }
    const user = await this.getUserById(userId);
    if (!user) throw new Error('User does not exist');

    const userInfo = await this.getUserInfo(userId);
    if (!userInfo?.nickName || !userInfo?.dateOfBirth) {
      throw new Error('First fill nickname and date of birth');
    }

    return await this.db.transaction(async (trx) => {
      const userMapped = await trx
        .select({ name: schema.userInterests.name })
        .from(schema.userInterestMapping)
        .innerJoin(
          schema.userInterests,
          eq(schema.userInterestMapping.interestId, schema.userInterests.id),
        )
        .where(eq(schema.userInterestMapping.userId, userId));

      const alreadyMappedNames = userMapped.map((item) => item.name);
      const isFirstTime = alreadyMappedNames.length === 0;

      const newInterestNames = interests.filter(
        (name) => !alreadyMappedNames.includes(name),
      );

      const existingInterests = await trx
        .select()
        .from(schema.userInterests)
        .where(inArray(schema.userInterests.name, newInterestNames));

      const existingNames = existingInterests.map((i) => i.name);
      const interestsToCreate = newInterestNames.filter(
        (name) => !existingNames.includes(name),
      );

      if (interestsToCreate.length > 0) {
        const inserted = await trx
          .insert(schema.userInterests)
          .values(interestsToCreate.map((name) => ({ name })))
          .returning();
        existingInterests.push(...inserted);
      }

      const nameToId = new Map(
        existingInterests.map((interest) => [interest.name, interest.id]),
      );

      const newMappings = newInterestNames.map((name) => ({
        userId,
        interestId: nameToId.get(name)!,
      }));

      if (newMappings.length > 0) {
        await trx.insert(schema.userInterestMapping).values(newMappings);
      }

      if (isFirstTime) {
        await this.updateCheckpoint(userId, 'INTEREST_DONE');
        return {
          isSuccess: true,
          message: 'Interests Added Successfully',
          data: {
            checkPoint: 'INTEREST_DONE',
            interest: newInterestNames,
          },
        };
      }

      return {
        isSuccess: true,
        message: 'Interests Updated successfully',
        data: {
          checkPoint: user.loginFormCheckPoint,
        },
      };
    });
  }

  // Location Update

  async updateLocation(
    userId: string,
    data: { location: { latitude: number; longitude: number } },
  ) {
    try {
      const { location } = data;

      const user = await this.getUserById(userId);
      if (!user) throw new Error('User not found');

      const userInfo = await this.getUserInfo(userId);
      const interests = await this.getUserInterests(userId);
      if (
        !userInfo?.nickName ||
        !userInfo?.dateOfBirth ||
        interests.length === 0
      ) {
        throw new Error('First fill nickname, date of birth, and interests');
      }

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
      throw new Error(
        `Failed to update location: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }

  // Gender Update

  async updateGender(userId: string, data: { gender: string }) {
    try {
      const { gender } = data;

      if (!schema.genderType.includes(gender)) {
        throw new Error('Invalid gender');
      }

      const user = await this.getUserById(userId);
      const userInfo = await this.getUserInfo(userId);
      const interests = await this.getUserInterests(userId);
      const location = await this.getUserLocation(userId);

      if (
        !userInfo?.nickName ||
        !userInfo?.dateOfBirth ||
        interests.length === 0 ||
        !location
      ) {
        throw new Error(
          'First fill nickname, date of birth, interests, and location',
        );
      }

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
      throw new Error(
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

      if (!schema.genderType.includes(genderPreference)) {
        throw new Error('Invalid gender preference');
      }

      const user = await this.getUserById(userId);
      const userInfo = await this.getUserInfo(userId);
      const interests = await this.getUserInterests(userId);
      const location = await this.getUserLocation(userId);

      if (
        !userInfo?.nickName ||
        !userInfo?.dateOfBirth ||
        !userInfo.gender ||
        interests.length === 0 ||
        !location
      ) {
        throw new Error(
          'First fill nickname, date of birth, gender, interests, and location',
        );
      }

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
      throw new Error(
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
        throw new Error('Distance must be a non-negative number');
      }

      const user = await this.getUserById(userId);
      const userInfo = await this.getUserInfo(userId);
      const interests = await this.getUserInterests(userId);
      const location = await this.getUserLocation(userId);

      if (
        !userInfo?.nickName ||
        !userInfo?.dateOfBirth ||
        !userInfo?.gender ||
        !userInfo?.genderPreference ||
        interests.length === 0 ||
        !location
      ) {
        throw new Error(
          'First fill nickname, date of birth, gender, gender preference, interests, and location',
        );
      }

      const isFirstTime = !userInfo.distancePreferredInKm;

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
        data: { checkPoint: user.loginFormCheckPoint, distancePreferredInKm },
      };
    } catch (err) {
      throw new Error(
        `Failed to update distance preference: ${err instanceof Error ? err.message : 'Unknown error'}`,
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

  //   const sessionId: string = response.data.sessionId;
  //   // const url = `https://liveness.biopassid.com/session/${sessionId}`;

  //   return { sessionId }; // frontend will open this URL
  // }

  // KYC Update
  // private async getLivenessImage(sessionId: string) {
  //   try {
  //     const res = await this.httpService
  //       .get(`${this.biopassApiUrl}/liveness/session/${sessionId}`, {
  //         headers: {
  //           'BIOPASS-API-KEY': this.biopassKey,
  //         },
  //       })
  //       .toPromise();

  //     if (!res) {
  //       throw new Error('No response received from liveness session API');
  //     }

  //     return res.data as imageResponse;
  //   } catch (err) {
  //     if (err instanceof Error) {
  //       throw new Error(`Failed to get liveness image: ${err.message}`);
  //     } else {
  //       throw new Error('Failed to get liveness image: Unknown error');
  //     }
  //   }
  // }

  // private async enrollUserInBioPass(
  //   userId: string,
  //   fileName: string,
  //   base64: string,
  // ): Promise<EnrollResponse> {
  //   const payload = {
  //     Candidate: {
  //       GalleryNames: ['your-gallery'],
  //       CustomId: userId,
  //       EnrollWithDeduplication: true,
  //       BiographicData: {
  //         Nome: 'FromDBOrForm',
  //         Cpf: '123.456.789-00',
  //         DataDeNascimento: '1990-01-01',
  //         NomeDaMae: 'Mother',
  //         NomeDoPai: 'Father',
  //         Gender: 'Male',
  //         Signature: {
  //           ImageFileName: '',
  //           ImageBase64: '',
  //         },
  //         CaptureDateUtc: new Date().toISOString().split('T')[0],
  //       },
  //       Face: {
  //         Face: [
  //           {
  //             ImageFileName: fileName,
  //             ImageBase64: base64,
  //             HorzResolution: 300,
  //             VertResolution: 300,
  //           },
  //         ],
  //       },
  //     },
  //     PriorityOrder: 0,
  //     DelayOrder: 0,
  //   };

  //   const res = await this.httpService
  //     .post(`${this.biopassApiUrl}/enroll/create`, payload, {
  //       headers: {
  //         'Content-Type': 'application/json',
  //         'BIOPASS-API-KEY': this.biopassKey,
  //       },
  //     })
  //     .toPromise();

  //   if (!res) {
  //     throw new Error('No response received from BioPass API');
  //   }
  //   return res.data as EnrollResponse;
  // }

  async updateKyc(userId: string) {
    try {
      // Placeholder for actual BioPass integration
      const candidateId = 'hf3u-fjkejrjfejk-njhjbvherbh';

      const user = await this.getUserById(userId);
      const userInfo = await this.getUserInfo(userId);
      const interests = await this.getUserInterests(userId);
      const location = await this.getUserLocation(userId);

      if (!user) throw new Error('User not found');
      if (!userInfo) throw new Error('User info not found');

      const {
        nickName,
        dateOfBirth,
        gender,
        genderPreference,
        distancePreferredInKm,
      } = userInfo;

      if (
        !nickName ||
        !dateOfBirth ||
        !gender ||
        !genderPreference ||
        distancePreferredInKm == null ||
        interests.length === 0 ||
        !location
      ) {
        throw new Error(
          'User profile is incomplete. Please ensure nickname, DOB, gender, gender preference, interests, location, and distance preference are set before proceeding with KYC.',
        );
      }

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
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`KYC update failed: ${errorMessage}`);
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

  async updatePhotos(
    userId: string,
    data: {
      photos?: string[];
    },
  ) {
    try {
      const { photos } = data;

      const user = await this.getUserById(userId);
      const userInfo = await this.getUserInfo(userId);
      const interests = await this.getUserInterests(userId);
      const location = await this.getUserLocation(userId);

      if (!user) throw new Error('User not found');
      if (!userInfo) throw new Error('User info not found');

      const {
        nickName,
        dateOfBirth,
        gender,
        genderPreference,
        distancePreferredInKm,
        candidateId,
      } = userInfo;

      if (
        !nickName ||
        !dateOfBirth ||
        !gender ||
        !genderPreference ||
        !candidateId ||
        distancePreferredInKm == null ||
        interests.length === 0 ||
        !location
      ) {
        throw new Error(
          'User profile is incomplete. Please ensure nickname, DOB, gender, gender preference, interests, location, and distance preference and candidateId are set before proceeding with KYC.',
        );
      }

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
          message: 'Photos Added successfully',
          data: {
            checkPoint: 'PHOTOS_DONE',
            photos,
          },
        };
      } else {
        const currentMedia = existingMedia[0];

        const updatedPhotos = photos
          ? [...new Set([...(currentMedia.photos ?? []), ...photos])] // Removing duplicates
          : currentMedia.photos;

        await this.db
          .update(schema.userMedia)
          .set({
            photos: updatedPhotos,
          })
          .where(eq(schema.userMedia.userId, userId));
      }

      return {
        isSuccess: true,
        message: 'Photos updated successfully',
        data: {
          checkPoint: user.loginFormCheckPoint,
          photos,
        },
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`Failed to update media: ${errorMessage}`);
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
        throw new Error('mediaPreference and mediaUrl are required.');
      }

      const user = await this.getUserById(userId);
      const userInfo = await this.getUserInfo(userId);
      const interests = await this.getUserInterests(userId);
      const location = await this.getUserLocation(userId);
      const mediaData = await this.getUserMedia(userId);

      if (!user) throw new Error('User not found');
      if (!userInfo) throw new Error('User info not found');

      const {
        nickName,
        dateOfBirth,
        gender,
        genderPreference,
        distancePreferredInKm,
        candidateId,
      } = userInfo;

      if (
        !nickName ||
        !dateOfBirth ||
        !gender ||
        !genderPreference ||
        !candidateId ||
        distancePreferredInKm == null ||
        interests.length === 0 ||
        !location ||
        !mediaData
      ) {
        throw new Error(
          'User profile is incomplete. Please ensure nickname, DOB, gender, gender preference, interests, location, distance preference, and candidateId and photos are set before updating media preference.',
        );
      }

      const existingMedia = await this.db
        .select()
        .from(schema.userMedia)
        .where(eq(schema.userMedia.userId, userId));

      if (existingMedia.length === 0) {
        throw new Error('User media record not found');
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
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`Failed to update media preference: ${errorMessage}`);
    }
  }

  // Best Image selection and Video Generation using AI will be integrated later

  async getVideo(userId: string) {
    const mediaData = await this.getUserMedia(userId);

    if (!mediaData) {
      throw new Error('No media found for this user');
    }

    const userPhotos = mediaData.photos;

    if (!userPhotos || userPhotos.length < 1) {
      throw new Error('Minimum 1 image required');
    }

    // TODO: Select best image using Google Vision API

    // TODO: Generate AI video using API

    const aiVideo =
      'https://drive.google.com/file/d/1BxTbeqXf56cTa1B5x8OfaplD9s_Vw9Yg/view?usp=drivesdk';

    const photoSlideShow =
      'https://drive.google.com/file/d/1NSlIVGqSLP4uOITpsRhjzkHdexP_iE7G/view?usp=sharing';

    const currentVideos = mediaData.videos || [];
    const updatedVideos = [...currentVideos, aiVideo];

    await this.db
      .update(schema.userMedia)
      .set({
        videos: updatedVideos,
      })
      .where(eq(schema.userMedia.userId, userId));

    await this.updateCheckpoint(userId, 'VIDEO_PROCESSED_DONE');

    const userData = await this.db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, userId));

    return {
      isSuccess: true,
      data: {
        checkPoint: userData[0].loginFormCheckPoint,
        aiVideo,
        photoSlideShow,
      },
    };
  }

  // ----------------------------------------- GET ENDPOINTS ------------------

  async getDetails(userId: string) {
    // Get user from DB
    const userRow = await this.db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, userId));

    if (userRow.length === 0) {
      throw new Error('User not found');
    }

    const [
      intro,
      location,
      genderRow,
      distanceRow,
      loginFormCheckPoint,
      photosRow,
      videosRow,
      interestsRaw,
    ] = await Promise.all([
      this.db
        .select({
          nickName: schema.userInfo.nickName,
          dateOfBirth: schema.userInfo.dateOfBirth,
        })
        .from(schema.userInfo)
        .where(eq(schema.userInfo.userId, userId)),

      this.db
        .select()
        .from(schema.userLocation)
        .where(eq(schema.userLocation.userId, userId)),

      this.db
        .select({ gender: schema.userInfo.gender })
        .from(schema.userInfo)
        .where(eq(schema.userInfo.userId, userId)),

      this.db
        .select({
          distancePreferredInKm: schema.userInfo.distancePreferredInKm,
        })
        .from(schema.userInfo)
        .where(eq(schema.userInfo.userId, userId)),

      this.db
        .select({ loginFormCheckPoint: schema.user.loginFormCheckPoint })
        .from(schema.user)
        .where(eq(schema.user.id, userId)),

      this.db
        .select({ photos: schema.userMedia.photos })
        .from(schema.userMedia)
        .where(eq(schema.userMedia.userId, userId)),

      this.db
        .select({ videos: schema.userMedia.videos })
        .from(schema.userMedia)
        .where(eq(schema.userMedia.userId, userId)),

      this.db
        .select({ name: schema.userInterests.name })
        .from(schema.userInterestMapping)
        .innerJoin(
          schema.userInterests,
          eq(schema.userInterestMapping.interestId, schema.userInterests.id),
        )
        .where(eq(schema.userInterestMapping.userId, userId)),
    ]);

    return {
      id: userRow[0].id,
      email: userRow[0].email,
      intro: intro[0] ?? null,
      location: location[0] ?? null,
      gender: genderRow[0]?.gender ?? null,
      distancePreferredInKm: distanceRow[0]?.distancePreferredInKm ?? null,
      loginFormCheckPoint: loginFormCheckPoint[0]?.loginFormCheckPoint ?? null,
      photos: photosRow[0]?.photos ?? [],
      videos: videosRow[0]?.videos ?? [],
      interests: interestsRaw.map((i) => i.name),
    };
  }
}
