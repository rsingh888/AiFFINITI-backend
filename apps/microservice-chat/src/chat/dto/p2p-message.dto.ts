import {
  IsIn,
  IsOptional,
  ValidateNested,
  IsString,
  ValidateIf,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ChatMessageType, ChatMessageTypeTypes } from 'schema/chatting_schemas';

class TextChatMessageDto {
  @IsString()
  message: string;
}

const CHAT_MESSAGE_TYPES = { TEXT: 'text' } as const;

type ChatMessageType =
  (typeof CHAT_MESSAGE_TYPES)[keyof typeof CHAT_MESSAGE_TYPES];

class ChatMessageDto {
  @IsIn(Object.values(CHAT_MESSAGE_TYPES))
  type: ChatMessageType;

  @ValidateIf((o: { type: string }) => o.type === CHAT_MESSAGE_TYPES.TEXT)
  @IsOptional()
  @ValidateNested()
  @Type(() => TextChatMessageDto)
  textMessageData?: TextChatMessageDto;
}

class GameRequestDto {
  @IsString()
  gameId: string;

  @IsUUID()
  conversationId: string;
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

  @ValidateIf(
    (o: { type: string }) => o.type === ChatMessageType.GAME_REQUESTED,
  )
  @IsOptional()
  @ValidateNested()
  @Type(() => GameRequestDto)
  p2pGameRequest?: GameRequestDto;
}
