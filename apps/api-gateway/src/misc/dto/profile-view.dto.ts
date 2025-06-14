import { IsString } from 'class-validator';

export class profileView {
  @IsString({ message: 'viewedId must be a string' })
  viewedId: string;
}
