import { IsObject, IsNumber } from 'class-validator';

class LocationDto {
  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;
}

export class UpdateLocationDto {
  @IsObject()
  location: LocationDto;
}
