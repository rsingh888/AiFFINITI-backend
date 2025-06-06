import { IsString } from 'class-validator';

export class UpdateUserVideoDto {
  @IsString()
  videoUrl: string;
}
