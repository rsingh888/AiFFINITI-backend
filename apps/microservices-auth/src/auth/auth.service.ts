import { Inject, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { schema } from '../../../../schema/index';
import { eq } from 'drizzle-orm';
import { inArray } from 'drizzle-orm';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ConfigService } from '@nestjs/config';

interface imageResponse {
  imageBase64: string;
}
interface EnrollResponse {
  Success: boolean;
  Message?: string;
  Candidate?: { Person?: { Id?: string } };
}
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

  async refreshSupabaseSession(refreshToken: string) {
    const client = createClient(
      this.configService.get<string>('SUPABASE_URL') || '',
      this.configService.get<string>('SUPABASE_KEY') || '',
    );

    const { data, error } = await client.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session?.access_token) {
      throw new Error('Failed to refresh token');
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in,
      user: data.session.user,
    };
  }

  // For Guard
  async verifyToken(accessToken: string) {
    const { data, error } = await this.supabase.auth.getUser(accessToken);
    if (error || !data?.user) {
      throw new Error('Invalid or expired token');
    }
    return { ...data.user };
  }

  // Private user id token

  // private async getUserIdFromToken(token: string): Promise<string> {
  //   const { data: session, error } = await this.supabase.auth.getUser(token);
  //   if (error || !session?.user) throw new Error('Invalid token');

  //   const user: User = session.user;
  //   const email = user.email;

  //   if (!email) {
  //     throw new Error('User email is missing');
  //   }

  //   const result = await this.db
  //     .select()
  //     .from(schema.user)
  //     .where(eq(schema.user.email, email));

  //   if (result.length === 0) throw new Error('User not found');
  //   return result[0].id; // Now gives ---> Supabase user id
  // }

  // Sign In with Oauth

  async socialLogin(user: User) {
    try {
      const validUser = user;
      const userEmail = validUser.email;
      const userMetadata = validUser.user_metadata ?? {};
      const userProvider = validUser.app_metadata?.provider as
        | 'google'
        | 'facebook';

      if (!userEmail) {
        throw new Error('Email is missing from Supabase user');
      }

      if (!userProvider) {
        throw new Error('Auth provider is not specified');
      }

      const isEmailVerified = Boolean(userMetadata.email_verified);

      const existingUser = await this.db
        .select()
        .from(schema.user)
        .where(eq(schema.user.email, userEmail));

      if (existingUser.length != 0) {
        return {
          success: true,
          message: 'User already exist',
          userDetail: {
            email: userEmail,
            loginCheckPoint: existingUser[0].loginFormCheckPoint,
          },
        };
      }

      await this.db.insert(schema.user).values({
        id: validUser.id,
        email: userEmail,
        isEmailVerified,
        authProvider: userProvider,
        loginFormCheckPoint: 'STARTED',
      });

      return {
        success: true,
        message: 'User Added to DB',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`OAuth Sign-In failed: ${message}`);
    }
  }

  // NickName and Date of Birth Update

  async updateNickNameDOB(
    userId: string,
    data: {
      nickName: string;
      dateOfBirth: Date;
    },
  ) {
    try {
      const { nickName, dateOfBirth } = data;

      if (!nickName || !dateOfBirth) {
        throw new Error('Nick Name and Date of Birth are required');
      }

      const parsedDateOfBirth = new Date(dateOfBirth);

      const existingUserInfo = await this.db
        .select()
        .from(schema.userInfo)
        .where(eq(schema.userInfo.userId, userId));

      if (existingUserInfo.length === 0) {
        await this.db.insert(schema.userInfo).values({
          userId,
          nickName,
          dateOfBirth: parsedDateOfBirth,
        });
        await this.db
          .update(schema.user)
          .set({ loginFormCheckPoint: 'INTRO_DONE' })
          .where(eq(schema.user.id, userId));
      } else {
        await this.db
          .update(schema.userInfo)
          .set({
            nickName,
            dateOfBirth: parsedDateOfBirth,
          })
          .where(eq(schema.userInfo.userId, userId));

        return {
          success: true,
          message: 'User Info updated successfully',
        };
      }

      return { success: true, message: 'User Info Added successfully' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to update user info: ${message}`);
    }
  }

  // Interests Update

  async updateInterest(userId: string, data: { interests: string[] }) {
    const { interests } = data;

    return await this.db.transaction(async (trx) => {
      const userMapped = await trx
        .select({
          name: schema.userInterests.name,
        })
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
        await trx
          .update(schema.user)
          .set({
            loginFormCheckPoint: 'INTEREST_DONE',
          })
          .where(eq(schema.user.id, userId));
      }

      return {
        success: true,
        message: 'Interests updated successfully',
        newlyAdded: newInterestNames,
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

      const existingLocation = await this.db
        .select()
        .from(schema.userLocation)
        .where(eq(schema.userLocation.userId, userId));

      if (existingLocation.length === 0) {
        await this.db.insert(schema.userLocation).values({
          userId,
          longitude: location.longitude,
          latitude: location.latitude,
        });

        await this.db
          .update(schema.user)
          .set({ loginFormCheckPoint: 'LOCATION_DONE' })
          .where(eq(schema.user.id, userId));
      } else {
        await this.db
          .update(schema.userLocation)
          .set({
            longitude: location.longitude,
            latitude: location.latitude,
          })
          .where(eq(schema.userLocation.userId, userId));
      }

      return { success: true, message: 'Location updated successfully' };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`Failed to update location: ${errorMessage}`);
    }
  }

  // Gender Update

  async updateGender(userId: string, data: { gender: string }) {
    try {
      const { gender } = data;

      const validGenders: ('Male' | 'Female')[] = ['Male', 'Female'];
      if (!validGenders.includes(gender as 'Male' | 'Female')) {
        throw new Error('Invalid gender. Must be "Male" or "Female"');
      }

      const existingUserInfo = await this.db
        .select()
        .from(schema.userInfo)
        .where(eq(schema.userInfo.userId, userId));

      if (existingUserInfo.length === 0) {
        throw new Error('User info not found');
      }

      const isFirstTime = !existingUserInfo[0].gender; // true if gender is empty or null

      if (isFirstTime === true) {
        await this.db
          .update(schema.userInfo)
          .set({ gender: gender as 'Male' | 'Female' })
          .where(eq(schema.userInfo.userId, userId));

        await this.db
          .update(schema.user)
          .set({ loginFormCheckPoint: 'GENDER_DONE' })
          .where(eq(schema.user.id, userId));
      } else {
        await this.db
          .update(schema.userInfo)
          .set({ gender: gender as 'Male' | 'Female' })
          .where(eq(schema.userInfo.userId, userId));
      }

      return { success: true, message: 'Gender updated successfully' };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`Failed to update gender: ${errorMessage}`);
    }
  }

  // Gender Preference update
  async updateGenderPreference(
    userId: string,
    data: { genderPreference: string },
  ) {
    try {
      const { genderPreference } = data;

      const validGenders: ('Male' | 'Female' | 'Both')[] = [
        'Male',
        'Female',
        'Both',
      ];
      if (
        !validGenders.includes(genderPreference as 'Male' | 'Female' | 'Both')
      ) {
        throw new Error(
          'Invalid gender preference. Must be "Male" or "Female" or "Both',
        );
      }

      const existingUserInfo = await this.db
        .select()
        .from(schema.userInfo)
        .where(eq(schema.userInfo.userId, userId));

      if (existingUserInfo.length === 0) {
        throw new Error('User info not found');
      }

      const isFirstTime = !existingUserInfo[0].genderPreference; // true if gender preference is empty or null

      await this.db
        .update(schema.userInfo)
        .set({
          genderPreference: genderPreference as 'Male' | 'Female' | 'Both',
        })
        .where(eq(schema.userInfo.userId, userId));

      if (isFirstTime === true) {
        await this.db
          .update(schema.user)
          .set({ loginFormCheckPoint: 'GENDER_PREFERENCE_DONE' })
          .where(eq(schema.user.id, userId));
      }

      return {
        success: true,
        message: 'Gender preference updated successfully',
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`Failed to update gender: ${errorMessage}`);
    }
  }

  // Distance Update

  async updateDistancePreferred(
    userId: string,
    data: { distancePreferredInKm: number },
  ) {
    try {
      const { distancePreferredInKm } = data;

      if (
        distancePreferredInKm === undefined ||
        distancePreferredInKm === null
      ) {
        throw new Error('distancePreferredInKm must be provided');
      }

      if (distancePreferredInKm < 0) {
        throw new Error('Distance cannot be negative');
      }

      const existingUserInfo = await this.db
        .select()
        .from(schema.userInfo)
        .where(eq(schema.userInfo.userId, userId))
        .limit(1);

      if (existingUserInfo.length === 0) {
        throw new Error('User info not found');
      }

      await this.db
        .update(schema.userInfo)
        .set({ distancePreferredInKm })
        .where(eq(schema.userInfo.userId, userId));

      await this.db
        .update(schema.user)
        .set({ loginFormCheckPoint: 'DISTANCE_PREFERRED_DONE' })
        .where(eq(schema.user.id, userId));

      return { success: true, message: 'Distance updated successfully' };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`Failed to update distance: ${errorMessage}`);
    }
  }

  // KYC Update
  private async getLivenessImage(sessionId: string) {
    try {
      const res = await this.httpService
        .get(`${this.biopassApiUrl}/liveness/session/${sessionId}`, {
          headers: {
            'BIOPASS-API-KEY': this.biopassKey,
          },
        })
        .toPromise();

      if (!res) {
        throw new Error('No response received from liveness session API');
      }

      return res.data as imageResponse;
    } catch (err) {
      if (err instanceof Error) {
        throw new Error(`Failed to get liveness image: ${err.message}`);
      } else {
        throw new Error('Failed to get liveness image: Unknown error');
      }
    }
  }

  private async enrollUserInBioPass(
    userId: string,
    fileName: string,
    base64: string,
  ): Promise<EnrollResponse> {
    const payload = {
      Candidate: {
        GalleryNames: ['your-gallery'],
        CustomId: userId,
        EnrollWithDeduplication: true,
        BiographicData: {
          Nome: 'FromDBOrForm',
          Cpf: '123.456.789-00',
          DataDeNascimento: '1990-01-01',
          NomeDaMae: 'Mother',
          NomeDoPai: 'Father',
          Gender: 'Male',
          Signature: {
            ImageFileName: '',
            ImageBase64: '',
          },
          CaptureDateUtc: new Date().toISOString().split('T')[0],
        },
        Face: {
          Face: [
            {
              ImageFileName: fileName,
              ImageBase64: base64,
              HorzResolution: 300,
              VertResolution: 300,
            },
          ],
        },
      },
      PriorityOrder: 0,
      DelayOrder: 0,
    };

    const res = await this.httpService
      .post(`${this.biopassApiUrl}/enroll/create`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'BIOPASS-API-KEY': this.biopassKey,
        },
      })
      .toPromise();

    if (!res) {
      throw new Error('No response received from BioPass API');
    }
    return res.data as EnrollResponse;
  }

  async updateKyc(userId: string, data: { sessionId: string }) {
    try {
      const { sessionId } = data;

      const livenessImage = (await this.getLivenessImage(sessionId)) as {
        imageBase64: string;
      };
      const imageBase64 = livenessImage.imageBase64;
      const fileName = 'liveness_face.png';

      const enrollmentRes = await this.enrollUserInBioPass(
        userId,
        fileName,
        imageBase64,
      );

      if (!enrollmentRes.Success) {
        throw new Error('Enrollment failed: ' + enrollmentRes.Message);
      }

      const candidateId = enrollmentRes.Candidate?.Person?.Id;
      if (!candidateId) {
        throw new Error('Candidate ID missing in enrollment response');
      }

      await this.db
        .update(schema.userInfo)
        .set({ candidateId })
        .where(eq(schema.userInfo.userId, userId));

      await this.db
        .update(schema.user)
        .set({ loginFormCheckPoint: 'KYC_DONE' })
        .where(eq(schema.user.id, userId));

      return {
        success: true,
        message: 'User enrolled successfully in BioPass ABIS',
        candidateId,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`KYC update failed: ${errorMessage}`);
    }
  }

  // photos Update  and Verify Photos

  async verifyPhotos(userId: string, data: { photos: string[] }) {
    try {
      const { photos } = data;

      if (!photos) {
        throw new Error('Minimum 1 photos are required for verification');
      }

      const userInfo = await this.db
        .select()
        .from(schema.userInfo)
        .where(eq(schema.userInfo.userId, userId))
        .limit(1);

      if (userInfo.length === 0 || !userInfo[0].candidateId) {
        throw new Error('Candidate ID not found for user');
      }

      const candidateId = userInfo[0].candidateId;

      for (const photoBase64 of photos) {
        const verifyPayload = {
          CandidateId: candidateId,
          ImageBase64: photoBase64,
        };

        const verifyRes = await this.httpService
          .post<{ MatchSuccess: boolean }>(
            `${this.biopassApiUrl}/face/verify/1to1`,
            verifyPayload,
            {
              headers: {
                'Content-Type': 'application/json',
                'BIOPASS-API-KEY': this.biopassKey,
              },
            },
          )
          .toPromise();

        if (!verifyRes?.data?.MatchSuccess) {
          throw new Error('Face verification failed for one or more photos');
        }
      }

      return { success: true, message: 'All photos verified successfully' };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`Photo verification failed: ${errorMessage}`);
    }
  }

  async updatePhotos(
    userId: string,
    data: {
      photos?: string[];
    },
  ) {
    try {
      const { photos } = data;

      const existingMedia = await this.db
        .select()
        .from(schema.userMedia)
        .where(eq(schema.userMedia.userId, userId));

      if (existingMedia.length === 0) {
        await this.db.insert(schema.userMedia).values({
          userId,
          photos: photos ?? [],
        });

        await this.db
          .update(schema.user)
          .set({
            loginFormCheckPoint: 'PHOTOS_DONE',
          })
          .where(eq(schema.user.id, userId));
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

      return { success: true, message: 'Photos updated successfully' };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`Failed to update media: ${errorMessage}`);
    }
  }

  // Best Image selection and Video Generation using AI will be integrated later

  async getVideo(userId: string) {
    const existingMedia = await this.db
      .select()
      .from(schema.userMedia)
      .where(eq(schema.userMedia.userId, userId));

    // Ideally first fetch the all four images from user db

    const userPhotos = existingMedia[0].photos;

    if (!userPhotos) {
      throw new Error('Minimum 1 image required');
    }

    // select the best image using google vision

    // make a video on that image using API

    const videoUrl =
      'https://drive.google.com/file/d/1BxTbeqXf56cTa1B5x8OfaplD9s_Vw9Yg/view?usp=drivesdk';

    if (existingMedia.length != 0) {
      await this.db.insert(schema.userMedia).values({
        userId,
        videos: [videoUrl],
      });

      await this.db
        .update(schema.user)
        .set({
          loginFormCheckPoint: 'VIDEO_DONE',
        })
        .where(eq(schema.user.id, userId));

      const checkPoint = this.db
        .select({ loginFormCheckPoint: schema.user.loginFormCheckPoint })
        .from(schema.user)
        .where(eq(schema.user.id, userId));
      return {
        videoUrl: videoUrl,
        loginFormCheckPoint: checkPoint,
      };
    }
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
