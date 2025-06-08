import { IsArray, IsString, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class UpdatePhotosDto {
  @IsArray({ message: 'Photos must be an array' })
  @ArrayMinSize(1, { message: 'Minimum 1 photos are required' })
  @ArrayMaxSize(4, { message: 'Maximum 4 photos are required' })
  @IsString({ each: true, message: 'Each photo must be a string (URL)' })
  photos: string[];
}
