import { IsString } from 'class-validator';

export class SocialLoginDto {
  @IsString()
  accessToken: string;
}
