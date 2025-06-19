import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { PostApiGatewayService } from './post-api-gateway.service';
import { AuthGuard } from '../../common/guard/auth.guard';
// import { CreatePostDto } from './dto/create-post.dto';

@Controller('posts')
export class PostApiGatewayController {
  constructor(private readonly PostApiGatewayService: PostApiGatewayService) {}

  // @UseGuards(AuthGuard)
  // @Post('create-post')
  // postCreatePost(
  //   @Req() req: { user: { id: string } },
  //   @Body() body: CreatePostDto,
  // ) {
  //   const userId = req.user.id;
  //   return this.PostApiGatewayService.createPost(userId, body);
  // }

  @UseGuards(AuthGuard)
  @Post('likes/:postId')
  postLikePost(
    @Req() req: { user: { id: string } },
    @Param('postId') postId: string,
  ) {
    const userId = req.user.id;
    return this.PostApiGatewayService.likePost(userId, { postId });
  }

  @UseGuards(AuthGuard)
  @Post('aiffinities/:postId')
  postAiffinitiPost(
    @Req() req: { user: { id: string } },
    @Param('postId') postId: string,
  ) {
    const userId = req.user.id;
    return this.PostApiGatewayService.aiffinitiPost(userId, { postId });
  }

  @UseGuards(AuthGuard)
  @Post('views/:postId')
  postViewPost(
    @Req() req: { user: { id: string } },
    @Param('postId') postId: string,
  ) {
    const userId = req.user.id;
    return this.PostApiGatewayService.viewPost(userId, { postId });
  }
}
