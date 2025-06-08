import { IsArray, IsString, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class UpdateInterestDto {
  @IsArray({ message: 'Interests must be an array' })
  @ArrayMinSize(1, { message: 'At least 1 interest must be provided' })
  @ArrayMaxSize(15, { message: 'You can provide a maximum of 15 interests' })
  @IsString({ each: true, message: 'Each interest must be a string' })
  interests: string[];
}
