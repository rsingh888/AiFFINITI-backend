import { Inject, Injectable } from '@nestjs/common';
import { schema } from '../../../../schema/index';
import { eq } from 'drizzle-orm';
import { inArray } from 'drizzle-orm';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private configService: ConfigService,
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
    @Inject('DRIZZLE_CLIENT')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  // Testing purpose

  async authHello() {
    await new Promise((res) => setTimeout(res, 5000));
    return 'Hello';
  }

  // User ko new access token dene ke liye

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

  // Guard ke liye
  async verifyToken(accessToken: string) {
    const { data, error } = await this.supabase.auth.getUser(accessToken);
    if (error || !data?.user) {
      throw new Error('Invalid or expired token');
    }
    return { ...data.user };
  }

  // Private user id token

  private async getUserIdFromToken(token: string): Promise<number> {
    const { data: session, error } = await this.supabase.auth.getUser(token);
    if (error || !session?.user) throw new Error('Invalid token');

    const user: User = session.user;
    const email = user.email;
    const phone = user.phone;

    const result = await this.db
      .select()
      .from(schema.user)
      .where(
        email
          ? eq(schema.user.email, email)
          : eq(schema.user.phone, phone ?? ''),
      );

    if (result.length === 0) throw new Error('User not found');
    return result[0].id;
  }

  async sendOtp(phone: string) {
    try {
      const { error } = await this.supabase.auth.signInWithOtp({
        phone,
      });

      if (error) {
        throw new Error(error.message || 'Failed to send OTP');
      }

      return { success: true, message: 'OTP sent successfully' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Sending OTP failed: ${msg}`);
    }
  }

  async verifyOtp(phone: string, otp: string) {
    try {
      const { data: session, error } = await this.supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: 'sms',
      });

      if (error || !session?.user) {
        throw new Error(error?.message || 'OTP verification failed');
      }

      const validUser = session.user;

      if (!validUser.phone) {
        throw new Error('Verified user does not have a phone number');
      }

      const existingUser = await this.db
        .select()
        .from(schema.user)
        .where(eq(schema.user.phone, validUser.phone));

      let userId: number;
      let isNewUser = false;

      if (existingUser.length === 0) {
        const insertedUser = await this.db
          .insert(schema.user)
          .values({
            phone: validUser.phone,
            email: validUser.email ?? '',
            isEmailVerified: !!validUser.email, // true if email exists
            loginFormCheckPoint: 'PHONE_DONE',
            authProvider: 'phone',
          })
          .returning();

        userId = insertedUser[0].id;

        await this.db.insert(schema.userInfo).values({
          userId,
        });
        isNewUser = true;

        return {
          success: true,
          message: 'User Created',
          session,
        };
      }

      if (!isNewUser) {
        return {
          success: true,
          message: 'User already exists',
          session,
          checkPoint: existingUser[0]?.loginFormCheckPoint,
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Phone sign-in failed: ${msg}`);
    }
  }

  // Sign In with Oauth

  async socialLogin(accessToken: string) {
    try {
      if (!accessToken) {
        throw new Error('Access token is missing');
      }
      const { data: session, error } =
        await this.supabase.auth.getUser(accessToken);

      if (error || !session?.user) {
        throw new Error('Failed to retrieve user session from Supabase');
      }

      const validUser = session.user;
      const userEmail = validUser.email;
      const userPhone = validUser.phone ?? '';
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

      if (existingUser.length === 0) {
        await this.db.insert(schema.user).values({
          phone: userPhone,
          email: userEmail,
          isEmailVerified,
          authProvider: userProvider,
        });
      }

      return {
        success: true,
        message: 'User synced to DB',
        // user: userInfo,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`OAuth Sign-In failed: ${message}`);
    }
  }

  // NickName and Date of Birth Updation

  async updateNickNameDOB(
    accessToken: string,
    data: {
      nickName: string;
      dateOfBirth: Date;
    },
  ) {
    try {
      const userId = await this.getUserIdFromToken(accessToken);
      const { nickName, dateOfBirth } = data;

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
      }

      return { success: true, message: 'User info updated successfully' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to update user info: ${message}`);
    }
  }

  // Interests Updation

  async updateInterest(accessToken: string, data: { interests: string[] }) {
    const userId = await this.getUserIdFromToken(accessToken);
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
            loginFormCheckPoint: 'INTREST_DONE',
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

  // Location Updation

  async updateLocation(
    accessToken: string,
    data: { location: { latitude: number; longitude: number } },
  ) {
    try {
      const userId = await this.getUserIdFromToken(accessToken);
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

  // Gender Updation

  async updateGender(accessToken: string, data: { gender: string }) {
    try {
      const userId = await this.getUserIdFromToken(accessToken);
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

  // Distance Updation

  async updateDistancePreferred(
    accessToken: string,
    data: { distancePreferredInKm: number },
  ) {
    try {
      const userId = await this.getUserIdFromToken(accessToken);
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

  // photos Updation

  async updatePhotos(
    accessToken: string,
    data: {
      photos?: string[];
    },
  ) {
    try {
      const { photos } = data;

      const userId = await this.getUserIdFromToken(accessToken);

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

      return { success: true, message: 'Media updated successfully' };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`Failed to update media: ${errorMessage}`);
    }
  }

  // video Updation

  async updateVideo(
    accessToken: string,
    data: {
      videoUrl?: string;
    },
  ) {
    try {
      const { videoUrl } = data;

      const userId = await this.getUserIdFromToken(accessToken);

      const existingMedia = await this.db
        .select()
        .from(schema.userMedia)
        .where(eq(schema.userMedia.userId, userId));

      const currentMedia = existingMedia[0];

      const updatedVideos = videoUrl
        ? [...new Set([...(currentMedia.videos ?? []), videoUrl])] // Removing duplicates
        : currentMedia.videos;

      await this.db
        .update(schema.userMedia)
        .set({
          videos: updatedVideos,
        })
        .where(eq(schema.userMedia.userId, userId));

      await this.db
        .update(schema.user)
        .set({
          loginFormCheckPoint: 'VIDEO_DONE',
        })
        .where(eq(schema.user.id, userId));

      return { message: 'Media updated successfully' };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`Failed to update media: ${errorMessage}`);
    }
  }

  // ----------------------------------------- GET ENDPOINTS ------------------

  async getDetails(token: string) {
    const { data: session, error } = await this.supabase.auth.getUser(token);
    if (error || !session?.user) throw new Error('Invalid token');

    const user = session.user;
    const email = user.email;
    const phone = user.phone;

    // Get user from DB
    const userRow = await this.db
      .select()
      .from(schema.user)
      .where(
        email
          ? eq(schema.user.email, email)
          : eq(schema.user.phone, phone ?? ''),
      );

    if (userRow.length === 0) {
      throw new Error('User not found');
    }

    const userId = userRow[0].id;
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
      email,
      phone,
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
