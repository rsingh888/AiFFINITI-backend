import { IsArray, IsString } from 'class-validator';

export class UpdateUserPhotosDto {
  @IsArray()
  @IsString({ each: true })
  photos: string[];
}
