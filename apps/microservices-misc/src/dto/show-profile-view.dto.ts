import { IsString } from 'class-validator';

export class showProfileView {
  @IsString({ message: 'viewedId must be a string' })
  viewedId: string;
}
