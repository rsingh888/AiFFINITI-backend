import { IsArray, IsString } from 'class-validator';

export class UpdateInterestDto {
  @IsArray()
  @IsString({ each: true })
  interests: string[];
}
