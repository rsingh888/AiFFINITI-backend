import { IsNumber } from 'class-validator';

export class UpdateDistanceDto {
  @IsNumber()
  distancePreferred: number;
}
