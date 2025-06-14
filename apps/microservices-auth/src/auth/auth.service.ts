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
import { eq, inArray, and } from 'drizzle-orm';
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
      throw new UnauthorizedException('Invalid or expired token');
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

      if (!nickName || !dateOfBirth) {
        throw new BadRequestException(
          'Nick Name and Date of Birth are required',
        );
      }

      const parsedDate = new Date(dateOfBirth);
      if (isNaN(parsedDate.getTime())) {
        throw new BadRequestException('Invalid Date of Birth');
      }

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

      const user = await this.getUserById(userId);
      if (!user) {
        throw new NotFoundException('User not found after update');
      }

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

    const userInfo = await this.getUserInfo(userId);
    if (!userInfo?.nickName || !userInfo?.dateOfBirth) {
      throw new BadRequestException('First fill nickname and date of birth');
    }

    try {
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
          isCurrent: 1,
        }));

        if (newMappings.length > 0) {
          await trx.insert(schema.userInterestMapping).values(newMappings);
        }

        const currentInterestIds = interests.map((name) => nameToId.get(name)!);

        await trx
          .update(schema.userInterestMapping)
          .set({ isCurrent: 0 })
          .where(eq(schema.userInterestMapping.userId, userId));

        await trx
          .update(schema.userInterestMapping)
          .set({ isCurrent: 1 })
          .where(
            and(
              eq(schema.userInterestMapping.userId, userId),
              inArray(
                schema.userInterestMapping.interestId,
                currentInterestIds,
              ),
            ),
          );

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

      const userInfo = await this.getUserInfo(userId);
      const interests = await this.getUserInterests(userId);
      if (
        !userInfo?.nickName ||
        !userInfo?.dateOfBirth ||
        interests.length === 0
      ) {
        throw new BadRequestException(
          'First fill nickname, date of birth, and interests',
        );
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
      console.error('Error in updateLocation:', err);
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
      const interests = await this.getUserInterests(userId);
      const location = await this.getUserLocation(userId);

      if (
        !userInfo?.nickName ||
        !userInfo?.dateOfBirth ||
        interests.length === 0 ||
        !location
      ) {
        throw new BadRequestException(
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

      if (!schema.genderType.includes(genderPreference)) {
        throw new BadRequestException('Invalid gender preference');
      }

      const user = await this.getUserById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

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
        throw new BadRequestException(
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
        throw new BadRequestException(
          'First fill nickname, date of birth, gender, gender preference, interests, and location',
        );
      }

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
      if (!user) throw new NotFoundException('User not found');

      const userInfo = await this.getUserInfo(userId);
      if (!userInfo) throw new NotFoundException('User info not found');

      const {
        nickName,
        dateOfBirth,
        gender,
        genderPreference,
        distancePreferredInKm,
      } = userInfo;

      const interests = await this.getUserInterests(userId);
      const location = await this.getUserLocation(userId);

      const isProfileIncomplete =
        !nickName ||
        !dateOfBirth ||
        !gender ||
        !genderPreference ||
        distancePreferredInKm == null ||
        interests.length === 0 ||
        !location;

      if (isProfileIncomplete) {
        throw new BadRequestException(
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

      const interests = await this.getUserInterests(userId);
      const location = await this.getUserLocation(userId);

      const {
        nickName,
        dateOfBirth,
        gender,
        genderPreference,
        distancePreferredInKm,
        candidateId,
      } = userInfo;

      const isProfileIncomplete =
        !nickName ||
        !dateOfBirth ||
        !gender ||
        !genderPreference ||
        distancePreferredInKm == null ||
        !candidateId ||
        interests.length === 0 ||
        !location;

      if (isProfileIncomplete) {
        throw new BadRequestException(
          'User profile is incomplete. Please ensure nickname, DOB, gender, gender preference, interests, location, distance preference, and KYC (candidateId) are completed before uploading photos.',
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

      const interests = await this.getUserInterests(userId);
      const location = await this.getUserLocation(userId);
      const mediaData = await this.getUserMedia(userId);

      const {
        nickName,
        dateOfBirth,
        gender,
        genderPreference,
        distancePreferredInKm,
        candidateId,
      } = userInfo;

      const isProfileIncomplete =
        !nickName ||
        !dateOfBirth ||
        !gender ||
        !genderPreference ||
        !candidateId ||
        distancePreferredInKm == null ||
        interests.length === 0 ||
        !location ||
        !mediaData;

      if (isProfileIncomplete) {
        throw new BadRequestException(
          'User profile is incomplete. Please ensure nickname, DOB, gender, gender preference, interests, location, distance preference, candidateId, and photos are set before updating media preference.',
        );
      }

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

  // private async selectBestImage(photos: string[]) {
  //   if (!photos || photos.length === 0) {
  //     throw new BadRequestException('No photos available for selection');
  //   }

  // }

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

      // TODO: Integrate with AI video generation service
      const aiVideo =
        'https://drive.google.com/file/d/1BxTbeqXf56cTa1B5x8OfaplD9s_Vw9Yg/view?usp=drivesdk';

      const photoSlideShow =
        'https://drive.google.com/file/d/1NSlIVGqSLP4uOITpsRhjzkHdexP_iE7G/view?usp=sharing';

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
      id: user.id,
      email: user.email,
      intro: userInfo[0] ?? null,
      location: location[0] ?? null,
      gender: userInfo[0]?.gender ?? null,
      distancePreferredInKm: userInfo[0]?.distancePreferredInKm ?? null,
      loginFormCheckPoint: user.loginFormCheckPoint ?? null,
      photos: media[0]?.photos ?? [],
      videos: media[0]?.videos ?? [],
      interests: interestsRaw.map((i) => i.name),
    };
  }
}
