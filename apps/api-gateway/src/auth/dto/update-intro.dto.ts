import { IsString, IsDateString } from 'class-validator';
import { IsAdult } from '../validator/age-validator';
export class UpdateIntroDto {
  @IsString({ message: 'Nickname must be a string' })
  nickName: string;

  @IsDateString({}, { message: 'Date of birth must be a valid ISO date' })
  @IsAdult({ message: 'User must be at least 18 years old' })
  dateOfBirth: Date;
}
