import { IsString } from 'class-validator';

export class UpdateMediaPreferenceDto {
  @IsString()
  mediaPreference: string;

  @IsString()
  mediaUrl: string;
}
