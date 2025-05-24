import { IsIn, IsString } from 'class-validator';

export class UpdateUserGenderDto {
  @IsString()
  @IsIn(['Male', 'Female'], {
    message: 'Gender must be either "Male" or "Female"',
  })
  gender: string;
}
