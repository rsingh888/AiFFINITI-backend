import { Controller } from '@nestjs/common';
import { AuthService } from './auth.service';
import { MessagePattern } from '@nestjs/microservices';
import { UpdateUserIntroDto } from './dto/update-user-intro.dto';
import { UpdateUserInterestDto } from './dto/update-user-interests.dto';
import { UpdateLocationDto } from './dto/update-user-location.dto';
import { UpdateUserGenderDto } from './dto/update-user-gender.dto';
import { UpdateUserDistancePreferredInKmDto } from './dto/update-user-distance-preferred.dto';
import { UpdateUserPhotosDto } from './dto/update-user-photos.dto';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @MessagePattern({ cmd: 'auth-hello' })
  authHello() {
    return this.authService.authHello();
  }

  // verify token

  @MessagePattern('auth-verify-token')
  async verifyToken(accessToken: string) {
    return this.authService.verifyToken(accessToken);
  }

  // for granting new access token to user --> if expired
  @MessagePattern({ cmd: 'refresh-token' })
  refreshToken(data: { refreshToken: string }) {
    return this.authService.refreshSupabaseSession(data.refreshToken);
  }

  @MessagePattern({ cmd: 'auth-social-login' })
  async socialLogin(accessTokenValue: string) {
    return this.authService.socialLogin(accessTokenValue);
  }

  @MessagePattern({ cmd: 'update-user-intro' })
  async updateUserInfo(payload: { token: string; data: UpdateUserIntroDto }) {
    return this.authService.updateNickNameDOB(payload.token, {
      ...payload.data,
      dateOfBirth: new Date(payload.data.dateOfBirth),
    });
  }

  @MessagePattern({ cmd: 'update-user-interest' })
  async updateUserInterests(payload: {
    token: string;
    data: UpdateUserInterestDto;
  }) {
    return this.authService.updateInterest(payload.token, payload.data);
  }

  @MessagePattern({ cmd: 'update-user-location' })
  async updateUserLocation(payload: {
    token: string;
    data: UpdateLocationDto;
  }) {
    return this.authService.updateLocation(payload.token, payload.data);
  }

  @MessagePattern({ cmd: 'update-user-gender' })
  async updateUserGender(payload: {
    token: string;
    data: UpdateUserGenderDto;
  }) {
    return this.authService.updateGender(payload.token, payload.data);
  }

  @MessagePattern({ cmd: 'update-user-distance-preferred' })
  async updateUserDistancePreferredInKm(payload: {
    token: string;
    data: UpdateUserDistancePreferredInKmDto;
  }) {
    return this.authService.updateDistancePreferred(
      payload.token,
      payload.data,
    );
  }

  @MessagePattern({ cmd: 'update-user-photos' })
  async updateUserPhotos(payload: {
    token: string;
    data: UpdateUserPhotosDto;
  }) {
    return this.authService.updatePhotos(payload.token, payload.data);
  }

  // ---------------------------------GET USER DETAILS----------------------------------------------------

  @MessagePattern({ cmd: 'get-user-details' })
  getDetails(token: string) {
    return this.authService.getDetails(token);
  }
}
