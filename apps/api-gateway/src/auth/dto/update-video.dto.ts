import { IsString } from 'class-validator';

export class UpdateVideoDto {
  @IsString()
  videoUrl: string;
}
