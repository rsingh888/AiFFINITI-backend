import { Controller } from '@nestjs/common';
import { MicroservicePostService } from './post.service';
import { MessagePattern } from '@nestjs/microservices';
import { PostIdDto } from './dto/post-id.dto';
import { CreatePostDto } from './dto/create-post.dto';

@Controller()
export class MicroservicePostController {
  constructor(private readonly postService: MicroservicePostService) {}

  @MessagePattern({ cmd: 'post-create-post' })
  postCreatePost(payload: { userId: string; data: CreatePostDto }) {
    return this.postService.createPost(payload.userId, payload.data);
  }

  @MessagePattern({ cmd: 'post-like-post' })
  postLikePost(payload: { userId: string; data: PostIdDto }) {
    return this.postService.likePost(payload.userId, payload.data);
  }

  @MessagePattern({ cmd: 'post-aiffiniti-post' })
  postAiffinitiPost(payload: { userId: string; data: PostIdDto }) {
    return this.postService.aiffinitiPost(payload.userId, payload.data);
  }

  @MessagePattern({ cmd: 'post-view-post' })
  postViewPost(payload: { userId: string; data: PostIdDto }) {
    return this.postService.viewPost(payload.userId, payload.data);
  }
}
