import { Controller, Get, Post, Body, Headers } from '@nestjs/common';
import { AffinitiApiGatewayService } from './affiniti-api-gateway.service';

@Controller()
export class AffinitiApiGatewayController {
  constructor(
    private readonly affinitiApiGatewayService: AffinitiApiGatewayService,
  ) {}

  @Get('hello')
  getHello() {
    return this.affinitiApiGatewayService.getHello();
  }

  @Get('auth-hello')
  getAuthHello() {
    return this.affinitiApiGatewayService.getAuthHello();
  }

  @Post('refresh-token')
  async refreshToken(@Body() body: { refreshToken: string }) {
    return this.affinitiApiGatewayService.refreshAccessToken(body.refreshToken);
  }

  @Post('phone-login')
  async postPhoneLogin(@Body() body: { phone: string; otp?: string }) {
    return this.affinitiApiGatewayService.postPhoneLogin(body);
  }

  @Post('social-login')
  async postSocialLogin(@Headers('authorization') authHeader: string) {
    const token = authHeader?.split(' ')[1];

    if (!token) {
      throw new Error('Access token not defined');
    }

    return this.affinitiApiGatewayService.postSocialLogin(token);
  }

  @Post('user-intro')
  async postUserIntro(
    @Headers('authorization') authHeader: string,
    @Body() body: { nickName: string; dateOfBirth: Date },
  ) {
    const token = authHeader?.replace(/^Bearer\s+/i, '');

    if (!token) {
      throw new Error('Access token not defined');
    }

    return this.affinitiApiGatewayService.postUpdateIntro(token, body);
  }

  @Post('user-interest')
  async postUserInterest(
    @Headers('authorization') authHeader: string,
    @Body() body: { interests: string[] },
  ) {
    const token = authHeader?.replace(/^Bearer\s+/i, '');

    if (!token) {
      throw new Error('Access token not defined');
    }

    return this.affinitiApiGatewayService.postUpdateInterest(token, body);
  }

  @Post('user-location')
  async postUserLocation(
    @Headers('authorization') authHeader: string,
    @Body()
    body: {
      location: {
        latitude: number;
        longitude: number;
      };
    },
  ) {
    const token = authHeader?.replace(/^Bearer\s+/i, '');

    if (!token) {
      throw new Error('Access token missing or malformed');
    }

    return this.affinitiApiGatewayService.postUpdateLocation(token, body);
  }

  @Post('user-gender')
  async postUserGender(
    @Headers('authorization') authHeader: string,
    @Body() body: { gender: string },
  ) {
    const token = authHeader?.replace(/^Bearer\s+/i, '');

    if (!token) {
      throw new Error('Access token not defined');
    }

    return this.affinitiApiGatewayService.postUpdateGender(token, body);
  }

  @Post('user-distance-preferred')
  async postUserDiatancePreferred(
    @Headers('authorization') authHeader: string,
    @Body() body: { distancePreferred: number },
  ) {
    const token = authHeader?.replace(/^Bearer\s+/i, '');

    if (!token) {
      throw new Error('Access token not defined');
    }

    return this.affinitiApiGatewayService.postUpdateDistancePreferred(
      token,
      body,
    );
  }

  @Post('user-photos')
  async postUserPhotos(
    @Headers('authorization') authHeader: string,
    @Body() body: { photos: string[] },
  ) {
    const token = authHeader?.replace(/^Bearer\s+/i, '');

    if (!token) {
      throw new Error('Access token not defined');
    }

    return this.affinitiApiGatewayService.postUpdatePhotos(token, body);
  }
  @Post('user-video')
  async postUserVideo(
    @Headers('authorization') authHeader: string,
    @Body() body: { Video: string },
  ) {
    const token = authHeader?.replace(/^Bearer\s+/i, '');

    if (!token) {
      throw new Error('Access token not defined');
    }

    return this.affinitiApiGatewayService.postUpdateVideo(token, body);
  }

  // -----------------GET REQUEST ----------------------
  @Get('user-details')
  getUserDetails(@Headers('authorization') authHeader: string) {
    const token = authHeader?.replace(/^Bearer\s+/i, '');
    return this.affinitiApiGatewayService.getUserDetails(token);
  }
}
