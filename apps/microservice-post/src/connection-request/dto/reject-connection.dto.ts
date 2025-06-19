import { IsString } from 'class-validator';

export class rejectConnectionRequestDto {
  @IsString({ message: 'RequesterId must be a string' })
  requesterId: string;

  @IsString()
  type: string;
}
