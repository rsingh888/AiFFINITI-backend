import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ChatApiGatewayService } from './chat.service';
import { GetConversationsDto } from './dto/get-conversations.dto';
import { GetChatMessagesDto } from './dto/get-chat-messages.dto';
import { GetUser } from '../decorators/user.decorator';
import { AuthGuard } from '../common/guard/auth.guard';
import { AppUser } from '../common/types/userInterface';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { GameEndedDto } from './dto/game-ended.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly ChatApiGatewayService: ChatApiGatewayService) {}

  @Get('conversations')
  @UseGuards(AuthGuard)
  getConversations(
    @GetUser() user: AppUser,
    @Query() dto: GetConversationsDto,
  ) {
    return this.ChatApiGatewayService.getConversationsForUser(user.id, dto);
  }

  @Get('messages')
  @UseGuards(AuthGuard)
  getMessages(@Query() dto: GetChatMessagesDto, @GetUser() user: AppUser) {
    return this.ChatApiGatewayService.getMessagesForConversation(user.id, dto);
  }

  @Post('personal-conversation')
  @UseGuards(AuthGuard)
  createPersonalConversation(
    @GetUser() user: AppUser,
    @Body() dto: CreateConversationDto,
  ) {
    return this.ChatApiGatewayService.createPersonalConversation(user.id, dto);
  }

  @Post('game-ended')
  updateGameStateToEnded(@Body() dto: GameEndedDto) {
    return this.ChatApiGatewayService.updateGameStateToEnded(dto);
  }

  @UseGuards(AuthGuard)
  @Get('get-last-message')
  getLastMessageForConversation(
    @GetUser() user: AppUser,
    @Query('conversationId') conversationId: string,
  ) {
    return this.ChatApiGatewayService.getLastMessageForConversation(
      user.id,
      conversationId,
    );
  }

  @UseGuards(AuthGuard)
  @Post('mark-all-read')
  markAllMessagesRead(
    @GetUser() user: AppUser,
    @Body() body: { conversationId: string },
  ) {
    return this.ChatApiGatewayService.markAllMessagesRead(
      user.id,
      body.conversationId,
    );
  }
}
