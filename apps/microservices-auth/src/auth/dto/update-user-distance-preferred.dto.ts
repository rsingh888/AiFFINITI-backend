import { IsNumber } from 'class-validator';

export class UpdateUserDistancePreferredInKmDto {
  @IsNumber()
  distancePreferredInKm: number;
}
