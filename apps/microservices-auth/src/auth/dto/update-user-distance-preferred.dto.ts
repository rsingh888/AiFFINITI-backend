import { IsNumber } from 'class-validator';

export class UpdateUserDistancePreferredDto {
  @IsNumber()
  distancePreferred: number;
}
