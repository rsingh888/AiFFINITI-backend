import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { schema } from '../../../../schema/index';

import { eq, desc, sql, and, asc, inArray, ne } from 'drizzle-orm';
import { GetChatMessagesDto } from './dto/get-chat-messages.dto';
import { GetConversationsDto } from './dto/get-conversations.dto';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ConversationType } from 'schema/chatting_schemas';
import { GameEndedDto } from './dto/game-ended.dto';

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
          message: schema.chat.message,
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

    const allParticipantIds = Array.from(
      new Set(allConversations.flatMap((c) => c.participants)),
    );

    const users = await this.db
      .select({
        userId: schema.userInfo.userId,
        nickName: schema.userInfo.nickName,
        photos: schema.userMedia.photos,
      })
      .from(schema.userInfo)
      .leftJoin(
        schema.userMedia,
        eq(schema.userInfo.userId, schema.userMedia.userId),
      )
      .where(inArray(schema.userInfo.userId, allParticipantIds));

    const usersMap = new Map(users.map((user) => [user.userId, user]));

    const allConversationsWithConversationTitle = allConversations.map(
      ({ id, participants, ...rest }) => {
        return {
          id,
          ...rest,
          conversationTitle: usersMap.get(
            participants.find((participantId) => participantId !== userId) ||
              '',
          )?.nickName,
          conversationDisplayPictures: usersMap.get(
            participants.find((participantId) => participantId !== userId) ||
              '',
          )?.photos?.[0],
          participants: participants.map((participantId) => ({
            participantId,
            name: usersMap.get(participantId)?.nickName,
          })),
        };
      },
    );

    return {
      isSuccess: true,
      message: 'Conversations fetched successfully',
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
        message: schema.chat.message,
        gameSessionId: schema.chat.gameSessionId,
        imageUrl: schema.chat.imageUrl,
        createdAt: schema.chat.createdAt,
        readAt: schema.chat.readAt,
        conversationId: schema.chat.conversationId,
        gameSession: schema.gameSessions,
      })
      .from(schema.chat)
      .where(eq(schema.chat.conversationId, dto.conversationId))
      .leftJoin(
        schema.gameSessions,
        eq(schema.chat.gameSessionId, schema.gameSessions.id),
      )
      .orderBy(asc(schema.chat.createdAt))
      .offset(dto.offset);
    // .limit(dto.limit);

    const gameSessionIds = [
      ...new Set(
        messages
          .map((msg) => msg.gameSessionId)
          .filter((id): id is string => !!id),
      ),
    ];

    const gameSessionParticipants = await this.db
      .select({
        gameSessionId: schema.gameParticipants.gameSessionId,
        participantId: schema.gameParticipants.participantId,
        score: schema.gameParticipants.score,
        result: schema.gameParticipants.result,
        gameToken: schema.gameParticipants.gameToken,
        createdAt: schema.gameParticipants.createdAt,
      })
      .from(schema.gameParticipants)
      .where(inArray(schema.gameParticipants.gameSessionId, gameSessionIds));

    const participantsMap = new Map<string, typeof gameSessionParticipants>();

    for (const gameSessionParticipant of gameSessionParticipants) {
      const current =
        participantsMap.get(gameSessionParticipant.gameSessionId) || [];
      if (gameSessionParticipant.participantId !== userId) {
        gameSessionParticipant.gameToken = '';
      }
      current.push(gameSessionParticipant);
      participantsMap.set(gameSessionParticipant.gameSessionId, current);
    }

    const messagesWithGameSessionAndParticipants = messages.map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ conversationId, ...msg }) => {
        if (msg.gameSessionId && msg.gameSession) {
          return {
            ...msg,
            gameSession: {
              ...msg.gameSession,
              participants: participantsMap.get(msg.gameSessionId) || [],
            },
          };
        }
        return msg;
      },
    );

    return {
      isSuccess: true,
      data: { messages: messagesWithGameSessionAndParticipants },
    };
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

    return { isSuccess: true, data: { conversation: inserted[0] } };
  }

  async updateGameStateToEnded(dto: GameEndedDto) {
    console.log('🟡 : ChatApiGatewayService : dto:', dto);

    const result = await this.db
      .select({ gameStatus: schema.gameSessions.gameStatus })
      .from(schema.gameSessions)
      .where(eq(schema.gameSessions.id, dto.gameSession.sessionId))
      .limit(1);

    if (result.length > 0 && result[0].gameStatus !== 'ended') {
      await this.db
        .update(schema.gameSessions)
        .set({
          gameStatus: 'ended',
          gameEndedAt: new Date(dto.gameSession.gameEndTime),
        })
        .where(
          and(
            eq(schema.gameSessions.id, dto.gameSession.sessionId),
            ne(schema.gameSessions.gameStatus, 'ended'),
          ),
        );

      const resultArr: string[] = [];
      if (
        dto.gameSession.players[0].score === dto.gameSession.players[1].score
      ) {
        resultArr.push('tie');
        resultArr.push('tie');
      } else if (
        dto.gameSession.players[0].score > dto.gameSession.players[1].score
      ) {
        resultArr.push('win');
        resultArr.push('lose');
      } else {
        resultArr.push('lose');
        resultArr.push('win');
      }

      await this.db
        .update(schema.gameParticipants)
        .set({
          score: dto.gameSession.players[0].score.toString(),
          result: resultArr[0] as 'win' | 'lose' | 'tie',
        })
        .where(
          and(
            eq(
              schema.gameParticipants.gameSessionId,
              dto.gameSession.sessionId,
            ),
            eq(
              schema.gameParticipants.participantId,
              dto.gameSession.players[0].userId,
            ),
          ),
        );

      await this.db
        .update(schema.gameParticipants)
        .set({
          score: dto.gameSession.players[1].score.toString(),
          result: resultArr[1] as 'win' | 'lose' | 'tie',
        })
        .where(
          and(
            eq(
              schema.gameParticipants.gameSessionId,
              dto.gameSession.sessionId,
            ),
            eq(
              schema.gameParticipants.participantId,
              dto.gameSession.players[1].userId,
            ),
          ),
        );
    }
  }

  async getLastMessageForConversation(userId: string, conversationId: string) {
    const [conversation] = await this.db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, conversationId))
      .limit(1);

    if (!conversation) throw new NotFoundException('Conversation not found');

    if (!conversation.participants.includes(userId)) {
      throw new ForbiddenException(
        'You are not a participant of this conversation',
      );
    }

    const lastMessageArr = await this.db
      .select({
        id: schema.chat.id,
        type: schema.chat.type,
        senderId: schema.chat.senderId,
        message: schema.chat.message,
        gameSessionId: schema.chat.gameSessionId,
        imageUrl: schema.chat.imageUrl,
        createdAt: schema.chat.createdAt,
        readAt: schema.chat.readAt,
        conversationId: schema.chat.conversationId,
        gameSession: schema.gameSessions,
      })
      .from(schema.chat)
      .where(eq(schema.chat.conversationId, conversationId))
      .leftJoin(
        schema.gameSessions,
        eq(schema.chat.gameSessionId, schema.gameSessions.id),
      )
      .orderBy(desc(schema.chat.createdAt))
      .offset(0)
      .limit(1);

    if (lastMessageArr.length > 0 && lastMessageArr[0].type === 'game') {
      const lastMessage = lastMessageArr[0];

      if (!lastMessage.gameSessionId)
        throw new NotFoundException('gameSessionId not found for last message');

      const gameSessionParticipants = await this.db
        .select({
          gameSessionId: schema.gameParticipants.gameSessionId,
          participantId: schema.gameParticipants.participantId,
          score: schema.gameParticipants.score,
          result: schema.gameParticipants.result,
          gameToken: schema.gameParticipants.gameToken,
          createdAt: schema.gameParticipants.createdAt,
        })
        .from(schema.gameParticipants)
        .where(
          eq(schema.gameParticipants.gameSessionId, lastMessage.gameSessionId),
        );

      for (const gameSessionParticipant of gameSessionParticipants) {
        if (gameSessionParticipant.participantId !== userId) {
          gameSessionParticipant.gameToken = '';
        }
      }

      const lastMessagesWithGameSessionAndParticipants = {
        ...lastMessage,
        gameSession: {
          ...lastMessage.gameSession,
          participants: gameSessionParticipants,
        },
      };

      return {
        isSuccess: true,
        message: 'Last message fetched!',
        data: {
          lastMessage: lastMessagesWithGameSessionAndParticipants,
        },
      };
    }
  }
}
