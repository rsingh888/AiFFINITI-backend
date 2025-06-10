import { Controller } from '@nestjs/common';
import { AuthService } from './auth.service';
import { MessagePattern } from '@nestjs/microservices';
import { UpdateUserIntroDto } from './dto/update-user-intro.dto';
import { UpdateUserInterestDto } from './dto/update-user-interests.dto';
import { UpdateLocationDto } from './dto/update-user-location.dto';
import { UpdateUserGenderDto } from './dto/update-user-gender.dto';
import { UpdateUserDistancePreferredInKmDto } from './dto/update-user-distance-preferred.dto';
import { UpdateUserPhotosDto } from './dto/update-user-photos.dto';
import { UpdateUserGenderPreferenceDto } from './dto/update-user-gender-preference.dto';
import { User } from '@supabase/supabase-js';
import { UpdateUserMediaPreferenceDto } from './dto/update-user-media-preference.dto';
// import { UpdateUserKycDto } from './dto/update-user-kyc.dto';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @MessagePattern({ cmd: 'auth-hello' })
  authHello() {
    return this.authService.authHello();
  }

  // verify token

  @MessagePattern({ cmd: 'auth-verify-token' })
  async verifyToken(accessToken: string) {
    return this.authService.verifyToken(accessToken);
  }

  // for granting new access token to user --> if expired
  // @MessagePattern({ cmd: 'refresh-token' })
  // refreshToken(data: { refreshToken: string }) {
  //   return this.authService.refreshSupabaseSession(data.refreshToken);
  // }

  @MessagePattern({ cmd: 'auth-social-login' })
  async socialLogin(user: User) {
    return this.authService.socialLogin(user);
  }

  @MessagePattern({ cmd: 'update-user-intro' })
  async updateUserInfo(payload: { userId: string; data: UpdateUserIntroDto }) {
    return this.authService.updateNickNameDOB(payload.userId, {
      ...payload.data,
      dateOfBirth: new Date(payload.data.dateOfBirth),
    });
  }

  @MessagePattern({ cmd: 'update-user-interest' })
  async updateUserInterests(payload: {
    userId: string;
    data: UpdateUserInterestDto;
  }) {
    return this.authService.updateInterest(payload.userId, payload.data);
  }

  @MessagePattern({ cmd: 'update-user-location' })
  async updateUserLocation(payload: {
    userId: string;
    data: UpdateLocationDto;
  }) {
    return this.authService.updateLocation(payload.userId, payload.data);
  }

  @MessagePattern({ cmd: 'update-user-gender' })
  async updateUserGender(payload: {
    userId: string;
    data: UpdateUserGenderDto;
  }) {
    return this.authService.updateGender(payload.userId, payload.data);
  }

  @MessagePattern({ cmd: 'update-user-gender-preference' })
  async updateUserGenderPreference(payload: {
    userId: string;
    data: UpdateUserGenderPreferenceDto;
  }) {
    return this.authService.updateGenderPreference(
      payload.userId,
      payload.data,
    );
  }

  @MessagePattern({ cmd: 'update-user-distance-preferred' })
  async updateUserDistancePreferredInKm(payload: {
    userId: string;
    data: UpdateUserDistancePreferredInKmDto;
  }) {
    return this.authService.updateDistancePreferred(
      payload.userId,
      payload.data,
    );
  }

  // @MessagePattern({ cmd: 'create-session' })
  // async createSessionId(payload: { userId: string }) {
  //   return this.authService.createId(payload.userId);
  // }

  @MessagePattern({ cmd: 'update-user-kyc' })
  async updateUserKyc(payload: { userId: string }) {
    return this.authService.updateKyc(payload.userId);
  }

  // @MessagePattern({ cmd: 'verify-user-photos' })
  // async verifyUserPhotos(payload: {
  //   userId: string;
  //   data: UpdateUserPhotosDto;
  // }) {
  //   return this.authService.verifyPhotos(payload.userId, payload.data);
  // }

  @MessagePattern({ cmd: 'update-user-photos' })
  async updateUserPhotos(payload: {
    userId: string;
    data: UpdateUserPhotosDto;
  }) {
    return this.authService.updatePhotos(payload.userId, payload.data);
  }

  @MessagePattern({ cmd: 'update-user-media-preference' })
  async updateUserMediaPreference(payload: {
    userId: string;
    data: UpdateUserMediaPreferenceDto;
  }) {
    return this.authService.updateMedia(payload.userId, payload.data);
  }

  @MessagePattern({ cmd: 'get-user-video' })
  async getVideo(payload: { userId: string }) {
    return this.authService.getVideo(payload.userId);
  }

  // ---------------------------------GET USER DETAILS----------------------------------------------------

  @MessagePattern({ cmd: 'get-user-details' })
  getDetails(payload: { userId: string }) {
    return this.authService.getDetails(payload.userId);
  }
}
