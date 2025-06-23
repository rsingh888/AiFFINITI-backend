import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MiscApiGatewayService } from './misc-api-gateway.service';
import { AuthGuard } from '../common/guard/auth.guard';
// import { profileView } from './dto/profile-view.dto';

@Controller()
export class MiscApiGatewayController {
  constructor(private readonly MiscApiGatewayService: MiscApiGatewayService) {}

  @Get('all-interests')
  getAllInterests() {
    return this.MiscApiGatewayService.getAllInterests();
  }

  @UseGuards(AuthGuard)
  @Get('matching-profiles')
  getAllMatchingProfiles(
    @Req() req: { user: { id: string } },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(3), ParseIntPipe) limit: number,
  ) {
    const userId = req.user.id;
    return this.MiscApiGatewayService.getAllMatchingProfiles(userId, {
      page,
      limit,
    });
  }

  @UseGuards(AuthGuard)
  @Get('posts-suggestions')
  getPostsSuggestionsController(
    @Req() req: { user: { id: string } },
    @Query('limit', new DefaultValuePipe(3), ParseIntPipe) limit: number,
  ) {
    const userId = req.user.id;
    return this.MiscApiGatewayService.getPostsSuggestionsService(userId, {
      limit,
    });
  }

  // @UseGuards(AuthGuard)
  // @Post('profile-view/:viewedId')
  // showProfileView(
  //   @Param('viewedId') viewedId: profileView,
  //   @Req() req: { user: { id: string } },
  // ) {
  //   const userId = req.user.id;
  //   return this.MiscApiGatewayService.showProfileView(userId, viewedId);
  // }
}
