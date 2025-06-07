import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { AuthApiGatewayService } from './auth-api-gateway.service';
import { UpdateIntroDto } from './dto/update-intro.dto';
import { UpdateInterestDto } from './dto/update-interests.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateGenderDto } from './dto/update-gender.dto';
import { UpdateDistanceDto } from './dto/update-distance.dto';
import { UpdatePhotosDto } from './dto/update-photos.dto';
import { AuthGuard } from '../common/guard/auth.guard';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Controller()
export class AuthApiGatewayController {
  constructor(private readonly AuthApiGatewayService: AuthApiGatewayService) {}

  @Get('hello')
  getHello() {
    return this.AuthApiGatewayService.getHello();
  }

  @Get('auth-hello')
  getAuthHello() {
    return this.AuthApiGatewayService.getAuthHello();
  }

  // For granting new access token to user

  @Post('refresh-token')
  async refreshToken(@Body() body: RefreshTokenDto) {
    return this.AuthApiGatewayService.refreshAccessToken(body.refreshToken);
  }

  @Post('social-login')
  async postSocialLogin(@Headers('authorization') authHeader: string) {
    const token = authHeader?.replace(/^Bearer\s+/i, '');

    if (!token) {
      throw new Error('Access token not defined');
    }

    return this.AuthApiGatewayService.postSocialLogin(token);
  }

  @UseGuards(AuthGuard)
  @Post('user-intro')
  async postUserIntro(
    @Headers('authorization') authHeader: string,
    @Body() body: UpdateIntroDto,
  ) {
    const token = authHeader?.replace(/^Bearer\s+/i, '');

    if (!token) {
      throw new Error('Access token not defined');
    }

    return this.AuthApiGatewayService.postUpdateIntro(token, body);
  }

  @UseGuards(AuthGuard)
  @Post('user-interest')
  async postUserInterest(
    @Headers('authorization') authHeader: string,
    @Body() body: UpdateInterestDto,
  ) {
    const token = authHeader?.replace(/^Bearer\s+/i, '');

    if (!token) {
      throw new Error('Access token not defined');
    }

    return this.AuthApiGatewayService.postUpdateInterest(token, body);
  }

  @UseGuards(AuthGuard)
  @Post('user-location')
  async postUserLocation(
    @Headers('authorization') authHeader: string,
    @Body()
    body: UpdateLocationDto,
  ) {
    const token = authHeader?.replace(/^Bearer\s+/i, '');

    if (!token) {
      throw new Error('Access token missing or malformed');
    }

    return this.AuthApiGatewayService.postUpdateLocation(token, body);
  }

  @UseGuards(AuthGuard)
  @Post('user-gender')
  async postUserGender(
    @Headers('authorization') authHeader: string,
    @Body() body: UpdateGenderDto,
  ) {
    const token = authHeader?.replace(/^Bearer\s+/i, '');

    if (!token) {
      throw new Error('Access token not defined');
    }

    return this.AuthApiGatewayService.postUpdateGender(token, body);
  }

  @UseGuards(AuthGuard)
  @Post('user-distance-preferred')
  async postUserDistancePreferred(
    @Headers('authorization') authHeader: string,
    @Body() body: UpdateDistanceDto,
  ) {
    const token = authHeader?.replace(/^Bearer\s+/i, '');

    if (!token) {
      throw new Error('Access token not defined');
    }

    return this.AuthApiGatewayService.postUpdateDistancePreferredInKm(
      token,
      body,
    );
  }

  @UseGuards(AuthGuard)
  @Post('user-photos')
  async postUserPhotos(
    @Headers('authorization') authHeader: string,
    @Body() body: UpdatePhotosDto,
  ) {
    const token = authHeader?.replace(/^Bearer\s+/i, '');

    if (!token) {
      throw new Error('Access token not defined');
    }

    return this.AuthApiGatewayService.postUpdatePhotos(token, body);
  }

  // -----------------GET REQUEST ----------------------
  @UseGuards(AuthGuard)
  @Get('user-details')
  getUserDetails(@Headers('authorization') authHeader: string) {
    const token = authHeader?.replace(/^Bearer\s+/i, '');
    return this.AuthApiGatewayService.getUserDetails(token);
  }
}
