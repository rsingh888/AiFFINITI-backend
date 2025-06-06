import { IsArray, IsString } from 'class-validator';

export class UpdatePhotosDto {
  @IsArray()
  @IsString({ each: true })
  photos: string[];
}
