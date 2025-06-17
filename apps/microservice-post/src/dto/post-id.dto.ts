import { IsString } from 'class-validator';

export class PostIdDto {
  @IsString()
  postId: string;
}
