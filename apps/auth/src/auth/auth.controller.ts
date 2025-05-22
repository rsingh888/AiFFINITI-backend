import { Controller } from '@nestjs/common';
import { AuthService } from './auth.service';
import { MessagePattern } from '@nestjs/microservices';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @MessagePattern({ cmd: 'auth-hello' })
  authHello() {
    return this.authService.authHello();
  }

  @MessagePattern({ cmd: 'refresh-token' })
  refreshToken(refreshToken: string) {
    return this.authService.refreshSupabaseSession(refreshToken);
  }

  @MessagePattern({ cmd: 'auth-send-otp' })
  async sendOtp(data: { phone: string }) {
    return this.authService.sendOtp(data.phone);
  }

  @MessagePattern({ cmd: 'auth-verify-otp' })
  async verifyOtp(data: { phone: string; otp: string }) {
    return this.authService.verifyOtp(data.phone, data.otp);
  }

  @MessagePattern({ cmd: 'auth-social-login' })
  async socialLogin(accessToken: string) {
    return this.authService.socialLogin(accessToken);
  }

  @MessagePattern({ cmd: 'update-user-intro' })
  async updateUserInfo(payload: {
    token: string;
    data: {
      nickName: string;
      dateOfBirth: Date;
    };
  }) {
    return this.authService.updateNickNameDOB(payload.token, payload.data);
  }

  @MessagePattern({ cmd: 'update-user-interest' })
  async updateUserInterests(payload: {
    token: string;
    data: { interests: string[] };
  }) {
    return this.authService.updateInterest(payload.token, payload.data);
  }

  @MessagePattern({ cmd: 'update-user-location' })
  async updateUserLocation(payload: {
    token: string;
    data: {
      location: {
        latitude: number;
        longitude: number;
      };
    };
  }) {
    return this.authService.updateLocation(payload.token, payload.data);
  }

  @MessagePattern({ cmd: 'update-user-gender' })
  async updateUserGender(payload: {
    token: string;
    data: {
      gender: string;
    };
  }) {
    return this.authService.updateGender(payload.token, payload.data);
  }

  @MessagePattern({ cmd: 'update-user-distance-preferred' })
  async updateUserDistancePreferred(payload: {
    token: string;
    data: {
      distancePreferred: number;
    };
  }) {
    return this.authService.updateDistance(payload.token, payload.data);
  }

  @MessagePattern({ cmd: 'update-user-photos' })
  async updateUserPhotos(payload: {
    token: string;
    data: {
      photos: string[];
    };
  }) {
    return this.authService.updatePhotos(payload.token, payload.data);
  }

  @MessagePattern({ cmd: 'update-user-video' })
  async updateUserVideo(payload: {
    token: string;
    data: {
      Video: string;
    };
  }) {
    return this.authService.updateVideo(payload.token, payload.data);
  }

  // -------------------------------------GET REQUEST-------------------------------------------

  @MessagePattern({ cmd: 'get-user-details' })
  getDetails(token: string) {
    return this.authService.getDetails(token);
  }
}
