import { IsString } from 'class-validator';

export class UpdateUserVideoDto {
  @IsString()
  Video: string;
}
