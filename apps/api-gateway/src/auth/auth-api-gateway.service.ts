import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { User } from '@supabase/supabase-js';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AuthApiGatewayService {
  constructor(@Inject('AUTH_SERVICE') private authService: ClientProxy) {}
  getHello(): string {
    return 'Hello World!';
  }

  async getAuthHello() {
    const val: string = await firstValueFrom(
      this.authService.send<string>({ cmd: 'auth-hello' }, 'Aryan'),
    );
    console.log('--->val', val);

    return 'Done';
  }

  // async refreshAccessToken(refreshToken: string) {
  //   const result = await firstValueFrom(
  //     this.authService.send<{ accessToken: string; refreshToken: string }>(
  //       { cmd: 'refresh-token' },
  //       { refreshToken },
  //     ),
  //   );

  //   return result; // { accessToken, refreshToken }
  // }

  postSocialLogin(user: User) {
    return this.authService.send<string>({ cmd: 'auth-social-login' }, user);
  }

  postUpdateIntro(
    userId: string,
    data: { nickName: string; dateOfBirth: Date },
  ) {
    const { nickName, dateOfBirth } = data;

    return this.authService.send<string>(
      { cmd: 'update-user-intro' },
      {
        userId,
        data: {
          nickName,
          dateOfBirth,
        },
      },
    );
  }

  postUpdateInterest(userId: string, data: { interests: string[] }) {
    const { interests } = data;

    return this.authService.send<string>(
      { cmd: 'update-user-interest' },
      {
        userId,
        data: {
          interests,
        },
      },
    );
  }

  postUpdateLocation(
    userId: string,
    data: {
      location: {
        latitude: number;
        longitude: number;
      };
    },
  ) {
    const { location } = data;

    return this.authService.send<string>(
      { cmd: 'update-user-location' },
      {
        userId,
        data: {
          location,
        },
      },
    );
  }

  postUpdateGender(userId: string, data: { gender: string }) {
    const { gender } = data;

    return this.authService.send<string>(
      { cmd: 'update-user-gender' },
      {
        userId,
        data: {
          gender,
        },
      },
    );
  }

  postUpdateGenderPreference(
    userId: string,
    data: { genderPreference: string },
  ) {
    const { genderPreference } = data;

    return this.authService.send<string>(
      { cmd: 'update-user-gender-preference' },
      { userId, data: { genderPreference } },
    );
  }

  postUpdateDistancePreferredInKm(
    userId: string,
    data: { distancePreferredInKm: number },
  ) {
    const { distancePreferredInKm } = data;

    return this.authService.send<string>(
      { cmd: 'update-user-distance-preferred' },
      {
        userId,
        data: {
          distancePreferredInKm,
        },
      },
    );
  }

  //  createSession(userId: string) {
  //   const status = await firstValueFrom(
  //     this.authService.send<string>({ cmd: 'create-session' }, { userId }),
  //   );
  //   return status;
  // }

  postUpdateKyc(userId: string) {
    // const { sessionId } = data;

    return this.authService.send<string>(
      { cmd: 'update-user-kyc' },
      { userId },
    );
  }

  postVerifyPhotos(userId: string, data: { photos: string[] }) {
    const { photos } = data;

    return this.authService.send<string>(
      { cmd: 'verify-user-photos' },
      { userId, data: { photos } },
    );
  }

  postUpdatePhotos(userId: string, data: { photos: string[] }) {
    const { photos } = data;

    return this.authService.send<string>(
      { cmd: 'update-user-photos' },
      {
        userId,
        data: {
          photos,
        },
      },
    );
  }

  postUpdateMediaPreference(
    userId: string,
    data: { mediaPreference: string; mediaUrl: string },
  ) {
    const { mediaPreference, mediaUrl } = data;

    return this.authService.send<string>(
      { cmd: 'update-user-media-preference' },
      { userId, data: { mediaPreference, mediaUrl } },
    );
  }

  userVideo(userId: string) {
    return this.authService.send<string>({ cmd: 'get-user-video' }, { userId });
  }

  // -----------------------GET REquest-------------------

  getUserDetails(userId: string) {
    return this.authService.send<{
      email?: string;
      nickName: string;
      dateOfBirth: string;
      interests: string[];
      location: { latitude: number; longitude: number };
      gender: string;
      distancePreferredInKm: number;
      photos: string[];
    }>({ cmd: 'get-user-details' }, { userId });
  }
}
