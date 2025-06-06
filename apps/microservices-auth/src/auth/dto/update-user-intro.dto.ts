import { IsString, IsDateString } from 'class-validator';

export class UpdateUserIntroDto {
  @IsString()
  nickName: string;

  @IsDateString()
  dateOfBirth: string;
}
