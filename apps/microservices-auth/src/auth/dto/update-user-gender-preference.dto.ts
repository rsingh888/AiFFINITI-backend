import { IsIn, IsString } from 'class-validator';

export class UpdateUserGenderPreferenceDto {
  @IsString()
  @IsIn(['Male', 'Female', 'Both'], {
    message: 'Gender preference must be either "Male" or "Female" or "Both',
  })
  genderPreference: string;
}
