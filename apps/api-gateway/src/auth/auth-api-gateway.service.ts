import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
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

  async postSocialLogin(accessToken: string) {
    const accessTokenValue = accessToken;

    if (!accessTokenValue) {
      throw new Error('Access token needed');
    }

    // console.log('access token value ', accessTokenValue);

    const status: string = await firstValueFrom(
      this.authService.send<string>(
        { cmd: 'auth-social-login' },
        accessTokenValue,
      ),
    );

    return status;
  }

  async postUpdateIntro(
    accessToken: string,
    data: { nickName: string; dateOfBirth: Date },
  ) {
    const { nickName, dateOfBirth } = data;
    const accessTokenValue = accessToken;

    if (!accessTokenValue) {
      throw new Error('Access token needed');
    }

    const status: string = await firstValueFrom(
      this.authService.send<string>(
        { cmd: 'update-user-intro' },
        {
          token: accessTokenValue,
          data: {
            nickName,
            dateOfBirth,
          },
        },
      ),
    );

    return status;
  }

  async postUpdateInterest(accessToken: string, data: { interests: string[] }) {
    const { interests } = data;
    const accessTokenValue = accessToken;

    if (!accessTokenValue) {
      throw new Error('Access denied');
    }

    const status: string = await firstValueFrom(
      this.authService.send<string>(
        { cmd: 'update-user-interest' },
        {
          token: accessTokenValue,
          data: {
            interests,
          },
        },
      ),
    );

    return status;
  }

  async postUpdateLocation(
    accessToken: string,
    data: {
      location: {
        latitude: number;
        longitude: number;
      };
    },
  ) {
    const { location } = data;
    const accessTokenValue = accessToken;

    if (!accessTokenValue) {
      throw new Error('Access denied');
    }

    const status: string = await firstValueFrom(
      this.authService.send<string>(
        { cmd: 'update-user-location' },
        {
          token: accessTokenValue,
          data: {
            location,
          },
        },
      ),
    );

    return status;
  }

  async postUpdateGender(accessToken: string, data: { gender: string }) {
    const { gender } = data;
    const accessTokenValue = accessToken;

    if (!accessTokenValue) {
      throw new Error('Access denied');
    }

    const status: string = await firstValueFrom(
      this.authService.send<string>(
        { cmd: 'update-user-gender' },
        {
          token: accessTokenValue,
          data: {
            gender,
          },
        },
      ),
    );

    return status;
  }

  async postUpdateDistancePreferredInKm(
    accessToken: string,
    data: { distancePreferredInKm: number },
  ) {
    const { distancePreferredInKm } = data;
    const accessTokenValue = accessToken;

    if (!accessTokenValue) {
      throw new Error('Access denied');
    }

    const status: string = await firstValueFrom(
      this.authService.send<string>(
        { cmd: 'update-user-distance-preferred' },
        {
          token: accessTokenValue,
          data: {
            distancePreferredInKm,
          },
        },
      ),
    );

    return status;
  }

  async postUpdatePhotos(accessToken: string, data: { photos: string[] }) {
    const accessTokenValue = accessToken;

    if (!accessTokenValue) {
      throw new Error('Access denied');
    }

    const { photos } = data;

    const status: string = await firstValueFrom(
      this.authService.send<string>(
        { cmd: 'update-user-photos' },
        {
          token: accessTokenValue,
          data: {
            photos,
          },
        },
      ),
    );

    return status;
  }

  // -----------------------GET REquest-------------------

  async getUserDetails(token: string): Promise<{
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
      }>({ cmd: 'get-user-details' }, token),
    );
  }
}
