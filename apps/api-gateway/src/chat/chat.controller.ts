import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ChatApiGatewayService } from './chat.service';
import { GetConversationsDto } from './dto/get-conversations.dto';
import { GetChatMessagesDto } from './dto/get-chat-messages.dto';
import { GetUser } from '../decorators/user.decorator';
import { AuthGuard } from '../common/guard/auth.guard';
import { SupabaseUser } from '../common/types/userInterface';
import { CreateConversationDto } from './dto/create-conversation.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly ChatApiGatewayService: ChatApiGatewayService) {}

  @Get('conversations')
  @UseGuards(AuthGuard)
  getConversations(
    @GetUser() user: SupabaseUser,
    @Query() dto: GetConversationsDto,
  ) {
    return this.ChatApiGatewayService.getConversationsForUser(user.id, dto);
  }

  @Get('messages')
  @UseGuards(AuthGuard)
  getMessages(@Query() dto: GetChatMessagesDto, @GetUser() user: SupabaseUser) {
    return this.ChatApiGatewayService.getMessagesForConversation(user.id, dto);
  }

  @Post('personal-conversation')
  @UseGuards(AuthGuard)
  createPersonalConversation(
    @GetUser() user: SupabaseUser,
    @Body() dto: CreateConversationDto,
  ) {
    return this.ChatApiGatewayService.createPersonalConversation(user.id, dto);
  }
}
