import { IsString } from 'class-validator';

export class UpdateUserGenderDto {
  @IsString()
  gender: string;
}
