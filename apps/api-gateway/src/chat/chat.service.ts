import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { schema } from '../../../../schema/index';

import { eq, desc, sql, and, asc } from 'drizzle-orm';
import { GetChatMessagesDto } from './dto/get-chat-messages.dto';
import { GetConversationsDto } from './dto/get-conversations.dto';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ConversationType } from 'schema/chatting_schemas';

@Injectable()
export class ChatApiGatewayService {
  constructor(
    @Inject('DRIZZLE_CLIENT')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}
  async getConversationsForUser(userId: string, dto: GetConversationsDto) {
    const allConversations = await this.db
      .select({
        id: schema.conversations.id,
        participants: schema.conversations.participants,
        type: schema.conversations.type,
        // lastMessageId: schema.conversations.lastMessageId,
        // unreadMessagesCount: schema.conversations.unreadMessagesCount,
        lastMessage: {
          id: schema.chat.id,
          messageData: schema.chat.messageData,
          createdAt: schema.chat.createdAt,
          senderId: schema.chat.senderId,
        },
      })
      .from(schema.conversations)
      .leftJoin(
        schema.chat,
        eq(schema.conversations.lastMessageId, schema.chat.id),
      )
      .where(
        sql`${schema.conversations.participants} @> ${JSON.stringify([userId])}::jsonb`,
      )
      .orderBy(desc(schema.chat.createdAt))
      .offset(dto.offset)
      .limit(dto.limit);

    // const allParticipantIds = Array.from(
    //   new Set(allConversations.flatMap((c) => c.participants)),
    // );

    // const users = await this.db
    //   .select()
    //   .from(schema.userInfo)
    //   .where(inArray(schema.userInfo.userId, allParticipantIds));
    // const usersMap = new Map(users.map((user) => [user.userId, user]));
    // const enrichedConversations = allConversations.map((conv) => ({
    //   ...conv,
    //   participantDetails: conv.participants.map((userId) =>
    //     usersMap.get(userId),
    //   ),
    // }));

    const allConversationsWithConversationTitle = allConversations.map(
      ({ id, participants, ...rest }) => {
        return {
          id,
          ...rest,
          conversationTitle: `Dummy_Title_${id.substring(3, 7)}`,
          participants: participants.map((participantId) => ({
            participantId,
            name: `Dummy_Name_${participantId.substring(3, 7)}`,
          })),
        };
      },
    );

    return {
      isSuccess: true,
      data: { conversations: allConversationsWithConversationTitle },
    };
  }

  async getMessagesForConversation(userId: string, dto: GetChatMessagesDto) {
    const [conversation] = await this.db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, dto.conversationId))
      .limit(1);

    if (!conversation) throw new NotFoundException('Conversation not found');

    if (!conversation.participants.includes(userId)) {
      throw new ForbiddenException(
        'You are not a participant of this conversation',
      );
    }

    const messages = await this.db
      .select({
        id: schema.chat.id,
        type: schema.chat.type,
        senderId: schema.chat.senderId,
        messageData: schema.chat.messageData,
        createdAt: schema.chat.createdAt,
        readAt: schema.chat.readAt,
      })
      .from(schema.chat)
      .where(eq(schema.chat.conversationId, dto.conversationId))
      .orderBy(asc(schema.chat.createdAt))
      .offset(dto.offset)
      .limit(dto.limit);

    return { isSuccess: true, data: { messages } };
  }

  async createPersonalConversation(userId: string, dto: CreateConversationDto) {
    // Ordering the IDs to ensure consistent matching
    const sortedParticipants = [userId, dto.recipientId].sort();

    const existing = await this.db
      .select()
      .from(schema.conversations)
      .where(
        and(
          eq(schema.conversations.type, ConversationType.PERSONAL),
          sql`${schema.conversations.participants} @> ${JSON.stringify(sortedParticipants)}::jsonb`,
          sql`jsonb_array_length(${schema.conversations.participants}) = 2`,
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    // Create new conversation
    const inserted = await this.db
      .insert(schema.conversations)
      .values({
        type: ConversationType.PERSONAL,
        participants: sortedParticipants,
      })
      .returning();

    return inserted[0];
  }
}
