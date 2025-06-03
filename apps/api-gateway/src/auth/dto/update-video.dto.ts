import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateVideoDto {
  @IsString({ message: 'Video URL must be a string' })
  @IsNotEmpty({ message: 'Video URL is required' })
  videoUrl: string;
}
