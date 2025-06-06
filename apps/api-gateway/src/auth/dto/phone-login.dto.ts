import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsPhoneNumber,
} from 'class-validator';

export class PhoneLoginDto {
  @IsString()
  @IsNotEmpty()
  @IsPhoneNumber(undefined, { message: 'Invalid phone number' })
  phone: string;

  @IsOptional()
  @IsString()
  otp?: string;
}
