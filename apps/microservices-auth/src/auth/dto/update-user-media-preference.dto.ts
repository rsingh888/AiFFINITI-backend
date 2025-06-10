import { IsString } from 'class-validator';

export class UpdateUserMediaPreferenceDto {
  @IsString()
  mediaPreference: string;

  @IsString()
  mediaUrl: string;
}
