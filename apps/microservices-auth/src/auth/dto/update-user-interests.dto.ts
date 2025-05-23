import { IsArray, IsString } from 'class-validator';

export class UpdateUserInterestDto {
  @IsArray()
  @IsString({ each: true })
  interests: string[];
}
