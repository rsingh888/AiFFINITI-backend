import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AuthApiGatewayService } from './auth-api-gateway.service';
import { UpdateIntroDto } from './dto/update-intro.dto';
import { UpdateInterestDto } from './dto/update-interests.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateGenderDto } from './dto/update-gender.dto';
import { UpdateDistanceDto } from './dto/update-distance.dto';
import { UpdatePhotosDto } from './dto/update-photos.dto';
import { AuthGuard } from '../common/guard/auth.guard';
// import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UpdateGenderPreferenceDto } from './dto/update-gender-preference.dto';
import { UpdateMediaPreferenceDto } from './dto/update-media-preference.dto';
import { UpdateKycDto } from './dto/update-kyc.dto';

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

  // @Post('refresh-token')
  //  refreshToken(@Body() body: RefreshTokenDto) {
  //   return this.AuthApiGatewayService.refreshAccessToken(body.refreshToken);
  // }

  @Post('social-login')
  postSocialLogin(
    @Body() body: { token: string; provider: 'google' | 'facebook' | 'apple' },
  ) {
    // console.log('🟡 : AuthApiGatewayController : User:', req.user);
    return this.AuthApiGatewayService.postSocialLogin(body);
  }

  @UseGuards(AuthGuard)
  @Post('user-intro')
  postUserIntro(
    @Req() req: { user: { id: string } },
    @Body() body: UpdateIntroDto,
  ) {
    const userId = req.user.id;

    return this.AuthApiGatewayService.postUpdateIntro(userId, body);
  }

  @UseGuards(AuthGuard)
  @Post('user-interest')
  postUserInterest(
    @Req() req: { user: { id: string } },
    @Body() body: UpdateInterestDto,
  ) {
    const userId = req.user.id;
    return this.AuthApiGatewayService.postUpdateInterest(userId, body);
  }

  @UseGuards(AuthGuard)
  @Post('user-location')
  postUserLocation(
    @Req() req: { user: { id: string } },
    @Body()
    body: UpdateLocationDto,
  ) {
    const userId = req.user.id;

    return this.AuthApiGatewayService.postUpdateLocation(userId, body);
  }

  @UseGuards(AuthGuard)
  @Post('user-gender')
  postUserGender(
    @Req() req: { user: { id: string } },
    @Body() body: UpdateGenderDto,
  ) {
    const userId = req.user.id;

    return this.AuthApiGatewayService.postUpdateGender(userId, body);
  }

  @UseGuards(AuthGuard)
  @Post('user-gender-preference')
  postUserGenderPreference(
    @Req() req: { user: { id: string } },
    @Body() body: UpdateGenderPreferenceDto,
  ) {
    const userId = req.user.id;

    return this.AuthApiGatewayService.postUpdateGenderPreference(userId, body);
  }

  @UseGuards(AuthGuard)
  @Post('user-distance-preferred')
  postUserDistancePreferred(
    @Req() req: { user: { id: string } },
    @Body() body: UpdateDistanceDto,
  ) {
    const userId = req.user.id;

    return this.AuthApiGatewayService.postUpdateDistancePreferredInKm(
      userId,
      body,
    );
  }

  // @UseGuards(AuthGuard)
  @Get('create-session')
  createSession(@Req() req: { user: { id: string } }) {
    const userId = req.user.id;
    return this.AuthApiGatewayService.createSession(userId);
  }

  @UseGuards(AuthGuard)
  @Post('user-kyc')
  postUserKyc(
    @Req() req: { user: { id: string } },
    @Body() body: UpdateKycDto,
  ) {
    const userId = req.user.id;

    return this.AuthApiGatewayService.postUpdateKyc(userId, body);
  }

  // only for testing fe

  @UseGuards(AuthGuard)
  @Get('generate-upload-url')
  postGenerateUrl(@Req() req: { user: { id: string } }) {
    const userId = req.user.id;
    return this.AuthApiGatewayService.generateUrl(userId);
  }

  @UseGuards(AuthGuard)
  @Post('user-photos')
  postUserPhotos(
    @Req() req: { user: { id: string } },
    @Body() body: UpdatePhotosDto,
  ) {
    const userId = req.user.id;

    return this.AuthApiGatewayService.postUpdatePhotos(userId, body);
  }

  @UseGuards(AuthGuard)
  @Post('user-media-preference')
  postUserMediaPreference(
    @Req() req: { user: { id: string } },
    @Body() body: UpdateMediaPreferenceDto,
  ) {
    const userId = req.user.id;

    return this.AuthApiGatewayService.postUpdateMediaPreference(userId, body);
  }

  @UseGuards(AuthGuard)
  @Get('user-video')
  getUserVideo(@Req() req: { user: { id: string } }) {
    const userId = req.user.id;
    return this.AuthApiGatewayService.userVideo(userId);
  }

  // -----------------GET REQUEST ----------------------
  @UseGuards(AuthGuard)
  @Get('user-details')
  getUserDetails(@Req() req: { user: { id: string } }) {
    const userId = req.user.id;
    return this.AuthApiGatewayService.getUserDetails(userId);
  }
}
