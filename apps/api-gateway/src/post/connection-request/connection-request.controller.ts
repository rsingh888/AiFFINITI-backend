import { AuthGuard } from '../../common/guard/auth.guard';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConnectionRequestService } from './connection-request.service';
import { acceptConnectionRequestDto } from './dto/accept-request.dto';
import { rejectConnectionRequestDto } from './dto/reject-request.dto';
import { ChatApiGatewayService } from '../../chat/chat.service';
import { firstValueFrom } from 'rxjs';

@Controller('connection-requests')
export class ConnectionRequestController {
  constructor(
    private readonly connectionRequestService: ConnectionRequestService,
    private readonly chatApiGatewayService: ChatApiGatewayService,
  ) {}

  @UseGuards(AuthGuard)
  @Get('likes')
  allLikeConnectionRequest(@Req() req: { user: { id: string } }) {
    console.log('hello');
    const userId = req.user.id;
    return this.connectionRequestService.likeConnectionRequest(userId);
  }

  @UseGuards(AuthGuard)
  @Get('aiffinities')
  allAiffinitiConnectionRequest(@Req() req: { user: { id: string } }) {
    const userId = req.user.id;
    return this.connectionRequestService.aiffinitiConnectionRequest(userId);
  }

  @UseGuards(AuthGuard)
  @Post('accept-request')
  async acceptConnectionRequest(
    @Req() req: { user: { id: string } },
    @Body() body: acceptConnectionRequestDto,
  ) {
    const userId = req.user.id;

    const data = await firstValueFrom<{
      isSuccess: boolean;
      message: string;
      data?: {
        requesterId: string;
        receiverId: string;
        type: string;
        status: string;
      };
    }>(this.connectionRequestService.acceptConnectionRequest(userId, body));

    if (data.isSuccess === true) {
      const conversation =
        await this.chatApiGatewayService.createPersonalConversation(userId, {
          recipientId: body.requesterId,
        });

      return {
        isSuccess: true,
        data: {
          conversation,
        },
      };
    }

    throw new BadRequestException(data.message || 'Failed to accept request');
  }

  @UseGuards(AuthGuard)
  @Post('reject-request')
  rejectConnectionRequest(
    @Req() req: { user: { id: string } },
    @Body() body: rejectConnectionRequestDto,
  ) {
    const userId = req.user.id;

    return this.connectionRequestService.rejectConnectionRequest(userId, body);
  }
}
