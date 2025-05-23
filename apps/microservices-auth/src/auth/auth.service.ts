import { Inject, Injectable } from '@nestjs/common';
import { schema } from '../../../../schema/index';
import { eq } from 'drizzle-orm';
import { inArray } from 'drizzle-orm';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
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
    };
  }

  async verifyToken(accessToken: string) {
    console.log('accessToken in verifytoken function: ', accessToken);
    const { data, error } = await this.supabase.auth.getUser(accessToken);
    if (error || !data?.user) {
      throw new Error('Invalid or expired token');
    }
    return data.user;
  }

  // Private user id token

  private async getUserIdFromToken(token: string): Promise<number> {
    const { data: session, error } = await this.supabase.auth.getUser(token);
    if (error || !session?.user) throw new Error('Invalid token');

    const user = session.user;
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
            authProvider: 'phone',
          })
          .returning();

        userId = insertedUser[0].id;

        await this.db.insert(schema.userInfo).values({
          userId,
          loginFormCheckPoint: 'PHONE_DONE',
        });
        isNewUser = true;
        console.log('new user created in db');

        return {
          success: true,
          message: 'User Created',
          session,
        };
      }

      if (!isNewUser) {
        userId = existingUser[0].id;
        const userInfoDetails = await this.db
          .select()
          .from(schema.userInfo)
          .where(eq(schema.userInfo.userId, userId));
        return {
          success: true,
          message: 'User already exists',
          session,
          checkPoint: userInfoDetails[0]?.loginFormCheckPoint,
        };

        console.log('user already exist');
      }

      console.log('-------------Done------');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Phone sign-in failed: ${msg}`);
    }
  }

  // Sign In with Oauth

  async socialLogin(accessToken: string) {
    try {
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
      const { data: session, error } =
        await this.supabase.auth.getUser(accessToken);
      if (error || !session?.user) {
        throw new Error('Failed to get user from Supabase');
      }

      const validUser = session.user;
      const userEmail = validUser.email;
      const userPhone = validUser.phone;

      if (!userEmail && !userPhone) {
        throw new Error('User must have either email or phone');
      }

      const { nickName, dateOfBirth } = data;

      const parsedDateOfBirth = new Date(dateOfBirth);

      const existingUser = await this.db
        .select()
        .from(schema.user)
        .where(
          userEmail
            ? eq(schema.user.email, userEmail)
            : eq(schema.user.phone, userPhone ?? ''),
        );

      if (existingUser.length === 0) {
        throw new Error('User not found in database');
      }

      const userId: number = existingUser[0].id;

      const existingUserInfo = await this.db
        .select()
        .from(schema.userInfo)
        .where(eq(schema.userInfo.userId, userId));

      if (existingUserInfo.length === 0) {
        await this.db.insert(schema.userInfo).values({
          userId,
          nickName,
          dateOfBirth: parsedDateOfBirth,
          loginFormCheckPoint: 'INTRO_DONE',
        });
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
    const { data: session, error } =
      await this.supabase.auth.getUser(accessToken);
    if (error || !session?.user) {
      throw new Error('Failed to get user from Supabase');
    }

    const user = session.user;
    const userEmail = user.email;
    const userPhone = user.phone;
    const { interests } = data;

    return await this.db.transaction(async (trx) => {
      const existingUser = await trx
        .select()
        .from(schema.user)
        .where(
          userEmail
            ? eq(schema.user.email, userEmail)
            : eq(schema.user.phone, userPhone ?? ''),
        );

      if (existingUser.length === 0) {
        throw new Error('User not found');
      }

      const userId = existingUser[0].id;

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
          .update(schema.userInfo)
          .set({
            loginFormCheckPoint: 'INTREST_DONE',
          })
          .where(eq(schema.userInfo.userId, userId));
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
    data: {
      location: {
        latitude: number;
        longitude: number;
      };
    },
  ) {
    try {
      const { data: session, error } =
        await this.supabase.auth.getUser(accessToken);
      if (error || !session?.user) {
        throw new Error('Failed to get user from Supabase');
      }

      const validUser = session.user;
      const userEmail = validUser.email;
      const userPhone = validUser.phone;

      if (!userEmail && !userPhone) {
        throw new Error('User must have either email or phone');
      }

      const { location } = data;

      const existingUser = await this.db
        .select()
        .from(schema.user)
        .where(
          userEmail
            ? eq(schema.user.email, userEmail)
            : eq(schema.user.phone, userPhone ?? ''),
        );

      if (existingUser.length === 0) {
        throw new Error('User not found');
      }

      const userId = existingUser[0].id;

      // Insert or update userLocation
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
      } else {
        await this.db
          .update(schema.userLocation)
          .set({
            longitude: location.longitude,
            latitude: location.latitude,
          })
          .where(eq(schema.userLocation.userId, userId));
      }

      // Update checkpoint ONLY for this user
      await this.db
        .update(schema.userInfo)
        .set({
          loginFormCheckPoint: 'LOCATION_DONE',
        })
        .where(eq(schema.userInfo.userId, userId));

      return { success: true, message: 'Location updated successfully' };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`Failed to update location: ${errorMessage}`);
    }
  }

  // Gender Updation

  async updateGender(accessToken: string, data: { gender: string }) {
    try {
      const { data: session, error } =
        await this.supabase.auth.getUser(accessToken);
      if (error || !session?.user) {
        throw new Error('Failed to get user from Supabase');
      }

      const validUser = session.user;
      const userEmail = validUser.email;
      const userPhone = validUser.phone;
      const { gender } = data;

      const validGenders: ('Male' | 'Female')[] = ['Male', 'Female'];
      if (!validGenders.includes(gender as 'Male' | 'Female')) {
        throw new Error('Invalid gender. Must be "Male" or "Female"');
      }

      const existingUser = await this.db
        .select()
        .from(schema.user)
        .where(
          userEmail
            ? eq(schema.user.email, userEmail)
            : eq(schema.user.phone, userPhone ?? ''),
        );

      if (existingUser.length === 0) {
        throw new Error('User not found');
      }

      const userId = existingUser[0].id;

      await this.db
        .update(schema.userInfo)
        .set({
          gender: gender as 'Male' | 'Female',
          loginFormCheckPoint: 'GENDER_DONE',
        })
        .where(eq(schema.userInfo.userId, userId));

      return { success: true, message: 'Gender updated successfully' };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`Failed to update gender: ${errorMessage}`);
    }
  }

  // Distance Updation

  async updateDistance(
    accessToken: string,
    data: {
      distancePreferred: number;
    },
  ) {
    try {
      const { data: session, error } =
        await this.supabase.auth.getUser(accessToken);
      if (error || !session?.user) {
        throw new Error('Failed to get user from Supabase');
      }

      const validUser = session.user;
      const userEmail = validUser.email;
      const userPhone = validUser.phone;
      const { distancePreferred } = data;

      if (distancePreferred < 0) {
        throw new Error('Distance cannot be negative');
      }

      const existingUser = await this.db
        .select()
        .from(schema.user)
        .where(
          userEmail
            ? eq(schema.user.email, userEmail)
            : eq(schema.user.phone, userPhone ?? ''),
        );

      if (existingUser.length === 0) {
        throw new Error('User not found');
      }

      const userId = existingUser[0].id;

      await this.db
        .update(schema.userInfo)
        .set({
          distancePreferred: distancePreferred,
          loginFormCheckPoint: 'DISTANCE_PREFERRED_DONE',
        })
        .where(eq(schema.userInfo.userId, userId));

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

      const { data: session, error } =
        await this.supabase.auth.getUser(accessToken);
      if (error || !session?.user) {
        throw new Error('Failed to get user from Supabase');
      }

      const validUser = session.user;
      const userEmail = validUser.email;
      const userPhone = validUser.phone;

      const existingUser = await this.db
        .select()
        .from(schema.user)
        .where(
          userEmail
            ? eq(schema.user.email, userEmail)
            : eq(schema.user.phone, userPhone ?? ''),
        );

      if (existingUser.length === 0) {
        throw new Error('User not found');
      }

      const userId = existingUser[0].id;

      const existingMedia = await this.db
        .select()
        .from(schema.userMedia)
        .where(eq(schema.userMedia.userId, userId));

      if (existingMedia.length === 0) {
        await this.db.insert(schema.userMedia).values({
          userId,
          photos: photos ?? [],
        });

        await this.db.update(schema.userInfo).set({
          loginFormCheckPoint: 'PHOTOS_DONE',
        });
      } else {
        const currentMedia = existingMedia[0];

        const updatedPhotos = photos
          ? [...new Set([...currentMedia.photos, ...photos])] // Removing duplicates
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
      Video?: string;
    },
  ) {
    try {
      const { Video } = data;

      const { data: session, error } =
        await this.supabase.auth.getUser(accessToken);
      if (error || !session?.user) {
        throw new Error('Failed to get user from Supabase');
      }

      const validUser = session.user;
      const userEmail = validUser.email;
      const userPhone = validUser.phone;

      const existingUser = await this.db
        .select()
        .from(schema.user)
        .where(
          userEmail
            ? eq(schema.user.email, userEmail)
            : eq(schema.user.phone, userPhone ?? ''),
        );

      if (existingUser.length === 0) {
        throw new Error('User not found');
      }

      const userId = existingUser[0].id;

      const existingMedia = await this.db
        .select()
        .from(schema.userMedia)
        .where(eq(schema.userMedia.userId, userId));

      if (existingMedia.length === 0) {
        await this.db.insert(schema.userMedia).values({
          userId,
          photos: [],
          videos: Video ? [Video] : [],
        });
      } else {
        const currentMedia = existingMedia[0];

        const updatedVideos = Video
          ? [...new Set([...(currentMedia.videos ?? []), Video])] // Removing duplicates
          : currentMedia.videos;

        await this.db
          .update(schema.userMedia)
          .set({
            videos: updatedVideos,
          })
          .where(eq(schema.userMedia.userId, userId));
      }

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
        .select({ distancePreferred: schema.userInfo.distancePreferred })
        .from(schema.userInfo)
        .where(eq(schema.userInfo.userId, userId)),

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
      distancePreferred: distanceRow[0]?.distancePreferred ?? null,
      photos: photosRow[0]?.photos ?? [],
      videos: videosRow[0]?.videos ?? [],
      interests: interestsRaw.map((i) => i.name),
    };
  }
}
