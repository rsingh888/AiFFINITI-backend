import { IsString, IsDateString } from 'class-validator';

export class UpdateIntroDto {
  @IsString()
  nickName: string;

  @IsDateString()
  dateOfBirth: Date;
}
