import { IsIn, IsString } from 'class-validator';

export class UpdateGenderDto {
  @IsString()
  @IsIn(['Male', 'Female'], {
    message: 'Gender must be either "male" or "female"',
  })
  gender: string;
}
