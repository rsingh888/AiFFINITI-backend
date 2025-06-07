import {
  IsIn,
  IsOptional,
  ValidateNested,
  IsString,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ChatMessageType, ChatMessageTypeTypes } from 'schema/chatting_schemas';

class TextChatMessageDto {
  @IsString()
  message: string;
}

type ChatMessageTypeArr =
  (typeof ChatMessageType)[keyof typeof ChatMessageType];

class ChatMessageDto {
  @IsIn(Object.values(ChatMessageType))
  type: ChatMessageTypeArr;

  @ValidateIf((o: { type: string }) => o.type === ChatMessageType.TEXT)
  @IsOptional()
  @ValidateNested()
  @Type(() => TextChatMessageDto)
  textMessageData?: TextChatMessageDto;
}

class GameDto {
  @IsString()
  type: 'request' | 'accept' | 'reject';

  @IsString()
  gameId?: string;
}

export class SendP2PMessageDto {
  @IsString()
  conversationId: string;

  @IsIn(Object.values(ChatMessageType))
  type: ChatMessageTypeTypes;

  @ValidateIf((o: { type: string }) => o.type === ChatMessageType.TEXT)
  @IsOptional()
  @ValidateNested()
  @Type(() => ChatMessageDto)
  p2pChatData?: ChatMessageDto;

  @ValidateIf((o: { type: string }) => o.type === ChatMessageType.GAME)
  @IsOptional()
  @ValidateNested()
  @Type(() => GameDto)
  gameData?: GameDto;
}
