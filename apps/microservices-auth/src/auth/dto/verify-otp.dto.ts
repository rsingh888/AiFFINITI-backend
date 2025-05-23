import { IsPhoneNumber, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsPhoneNumber(undefined)
  phone: string;

  @IsString()
  @Length(6) //  OTP length
  otp: string;
}
