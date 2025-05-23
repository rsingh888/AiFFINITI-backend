import { IsPhoneNumber } from 'class-validator';

export class SendOtpDto {
  @IsPhoneNumber(undefined)
  phone: string;
}
