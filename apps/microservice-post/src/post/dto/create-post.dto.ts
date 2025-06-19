import { IsUrl, IsEnum, IsBoolean, IsOptional } from 'class-validator';

export enum PostType {
  PhotoSlideShow = 'PhotoSlideShow',
  AiVideo = 'AiVideo',
}

export class CreatePostDto {
  @IsUrl()
  postMediaUrl: string;

  @IsEnum(PostType)
  postType: PostType;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  isDeleted?: boolean;
}
