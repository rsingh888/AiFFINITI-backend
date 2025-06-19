import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
// import { CreatePostDto } from './dto/create-post.dto';

@Injectable()
export class PostApiGatewayService {
  constructor(@Inject('POST_SERVICE') private postService: ClientProxy) {}

  // createPost(userId: string, data: CreatePostDto) {
  //   const { postMediaUrl, postType, isPublic, isDeleted } = data;
  //   return this.postService.send<string>(
  //     { cmd: 'post-create-post' },
  //     {
  //       userId,
  //       data: {
  //         postMediaUrl,
  //         postType,
  //         isPublic,
  //         isDeleted,
  //       },
  //     },
  //   );
  // }

  // Likes post Endpoint
  likePost(userId: string, data: { postId: string }) {
    const { postId } = data;
    return this.postService.send<string>(
      { cmd: 'post-like-post' },
      {
        userId,
        data: {
          postId,
        },
      },
    );
  }

  // Aiffinities post Endpoint

  aiffinitiPost(userId: string, data: { postId: string }) {
    const { postId } = data;
    return this.postService.send<string>(
      { cmd: 'post-aiffiniti-post' },
      {
        userId,
        data: {
          postId,
        },
      },
    );
  }

  // View post Endpoint
  viewPost(userId: string, data: { postId: string }) {
    const { postId } = data;
    return this.postService.send<string>(
      { cmd: 'post-view-post' },
      {
        userId,
        data: {
          postId,
        },
      },
    );
  }
}
