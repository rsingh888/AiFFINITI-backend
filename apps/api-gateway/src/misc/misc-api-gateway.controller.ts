import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MiscApiGatewayService } from './misc-api-gateway.service';
import { AuthGuard } from '../common/guard/auth.guard';
import { profileView } from './dto/profile-view.dto';

@Controller()
export class MiscApiGatewayController {
  constructor(private readonly MiscApiGatewayService: MiscApiGatewayService) {}

  @Get('all-interests')
  getAllInterests() {
    return this.MiscApiGatewayService.getAllInterests();
  }

  @Get('matching-profiles')
  getAllMatchingProfiles(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(3), ParseIntPipe) limit: number,
  ) {
    return this.MiscApiGatewayService.getAllMatchingProfiles(page, limit);
  }

  @UseGuards(AuthGuard)
  @Post('profile-view/:viewedId')
  showProfileView(
    @Param('viewedId') viewedId: profileView,
    @Req() req: { user: { id: string } },
  ) {
    const userId = req.user.id;
    return this.MiscApiGatewayService.showProfileView(userId, viewedId);
  }
}
