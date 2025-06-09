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

  async refreshAccessToken(refreshToken: string) {
    const result = await firstValueFrom(
      this.authService.send<{ accessToken: string; refreshToken: string }>(
        { cmd: 'refresh-token' },
        { refreshToken },
      ),
    );

    return result; // { accessToken, refreshToken }
  }

  async postSocialLogin(user: User) {
    const status: string = await firstValueFrom(
      this.authService.send<string>({ cmd: 'auth-social-login' }, user),
    );

    return status;
  }

  async postUpdateIntro(
    userId: string,
    data: { nickName: string; dateOfBirth: Date },
  ) {
    const { nickName, dateOfBirth } = data;

    const status: string = await firstValueFrom(
      this.authService.send<string>(
        { cmd: 'update-user-intro' },
        {
          userId,
          data: {
            nickName,
            dateOfBirth,
          },
        },
      ),
    );

    return status;
  }

  async postUpdateInterest(userId: string, data: { interests: string[] }) {
    const { interests } = data;

    const status: string = await firstValueFrom(
      this.authService.send<string>(
        { cmd: 'update-user-interest' },
        {
          userId,
          data: {
            interests,
          },
        },
      ),
    );

    return status;
  }

  async postUpdateLocation(
    userId: string,
    data: {
      location: {
        latitude: number;
        longitude: number;
      };
    },
  ) {
    const { location } = data;

    const status: string = await firstValueFrom(
      this.authService.send<string>(
        { cmd: 'update-user-location' },
        {
          userId,
          data: {
            location,
          },
        },
      ),
    );

    return status;
  }

  async postUpdateGender(userId: string, data: { gender: string }) {
    const { gender } = data;

    const status: string = await firstValueFrom(
      this.authService.send<string>(
        { cmd: 'update-user-gender' },
        {
          userId,
          data: {
            gender,
          },
        },
      ),
    );

    return status;
  }

  async postUpdateGenderPreference(
    userId: string,
    data: { genderPreference: string },
  ) {
    const { genderPreference } = data;

    const status = await firstValueFrom(
      this.authService.send<string>(
        { cmd: 'update-user-gender-preference' },
        { userId, data: { genderPreference } },
      ),
    );

    return status;
  }

  async postUpdateDistancePreferredInKm(
    userId: string,
    data: { distancePreferredInKm: number },
  ) {
    const { distancePreferredInKm } = data;

    const status: string = await firstValueFrom(
      this.authService.send<string>(
        { cmd: 'update-user-distance-preferred' },
        {
          userId,
          data: {
            distancePreferredInKm,
          },
        },
      ),
    );

    return status;
  }

  async postUpdateKyc(userId: string, data: { sessionId: string }) {
    const { sessionId } = data;
    const status = await firstValueFrom(
      this.authService.send<string>(
        { cmd: 'update-user-kyc' },
        { userId, data: { sessionId } },
      ),
    );

    return status;
  }

  async postVerifyPhotos(userId: string, data: { photos: string[] }) {
    const { photos } = data;

    const status: string = await firstValueFrom(
      this.authService.send<string>(
        { cmd: 'verify-user-photos' },
        { userId, data: { photos } },
      ),
    );

    return status;
  }

  async postUpdatePhotos(userId: string, data: { photos: string[] }) {
    const { photos } = data;

    const status: string = await firstValueFrom(
      this.authService.send<string>(
        { cmd: 'update-user-photos' },
        {
          userId,
          data: {
            photos,
          },
        },
      ),
    );

    return status;
  }

  async userVideo(userId: string): Promise<string> {
    return firstValueFrom(
      this.authService.send<string>({ cmd: 'get-user-video' }, { userId }),
    );
  }

  // -----------------------GET REquest-------------------

  async getUserDetails(userId: string): Promise<{
    email?: string;
    nickName: string;
    dateOfBirth: string;
    interests: string[];
    location: { latitude: number; longitude: number };
    gender: string;
    distancePreferredInKm: number;
    photos: string[];
  }> {
    return firstValueFrom(
      this.authService.send<{
        email?: string;
        nickName: string;
        dateOfBirth: string;
        interests: string[];
        location: { latitude: number; longitude: number };
        gender: string;
        distancePreferredInKm: number;
        photos: string[];
      }>({ cmd: 'get-user-details' }, userId),
    );
  }
}
