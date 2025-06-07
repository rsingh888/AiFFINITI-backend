import {
  SubscribeMessage,
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
} from '@nestjs/websockets';

import { Server, Socket } from 'socket.io';
import { SendP2PMessageDto } from './dto/p2p-message.dto';
import { Inject, Logger, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';

import { createAdapter } from '@socket.io/redis-adapter';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { schema } from '../../../../schema/index';
import { ChatMessageType } from 'schema/chatting_schemas';

import { and, eq, sql } from 'drizzle-orm';
import { SupabaseUser } from 'apps/api-gateway/src/common/types/userInterface';
import { ChattingSocketService } from './chatting-socket.service';
// import { GameSessionRequestStatus, GameStatus } from 'schema/game_sessions';

const allowedOrigins = [
  'http://localhost:4000',
  'https://testing-aiffiniti-frontend-testing.vercel.app',
];

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    rooms: Set<string>;
  };
}

@WebSocketGateway({
  cors: {
    origin: [allowedOrigins],
  },
})
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
    @Inject('DRIZZLE_CLIENT')
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly chattingSocketService: ChattingSocketService,
  ) {}

  onModuleInit() {
    const pubClient = this.redisClient;
    const subClient = pubClient.duplicate();
    this.server.adapter(createAdapter(pubClient, subClient));
  }

  async handleConnection(client: AuthenticatedSocket) {
    this.logger.log(`Client connected: ${client.id}`);

    const token = client.handshake.auth.token as string;

    if (!token) {
      this.logger.warn(`Connection rejected: No token`);
      client.disconnect(true);
      return;
    }

    try {
      const user = await firstValueFrom<SupabaseUser>(
        this.authClient.send('auth-verify-token', token),
      );

      if (!user?.id) {
        throw new Error('Invalid auth token');
      }

      client.data.userId = user.id;
      client.data.rooms = new Set();
      await this.redisClient.set(user.id, client.id);

      this.logger.log(`Authenticated socket ${client.id} for user ${user.id}`);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Unknown error during authentication';

      this.logger.error(
        `Authentication failed for socket ${client.id}: ${errorMessage || ''}`,
      );
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.data.userId;

    if (client.data.rooms) {
      for (const room of client.data.rooms) {
        await client.leave(room);
        this.logger.log(`Socket ${client.id} left room ${room}`);
      }
    }

    await this.redisClient.del(userId);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /* NOTE: 
    the below code would also have worked but then NestJS injects the client socket first and the message payload second.
    it is less explicit -->

    @SubscribeMessage('private-message')
    handlePrivateMessage(client: Socket, payload: { to: string; message: string }) {
      // logic here
    }
  */

  @SubscribeMessage('outgoing-p2p-message')
  async handlePrivateMessage(
    @MessageBody()
    payload: SendP2PMessageDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    console.log(
      `Message from 
      socketId=${client.id}
      senderId=${client.data.userId}
      to 
      recipientId=${payload.conversationId}
      type=${payload.type}
      p2pChatData=${JSON.stringify(payload.p2pChatData)},
      gameData=${JSON.stringify(payload.gameData)}`,
    );

    const senderId = client.data.userId;
    const conversationId = payload.conversationId;
    const conversationType = payload.type;

    if (!client.data.rooms.has(conversationId)) {
      await client.join(conversationId);
      client.data.rooms.add(conversationId);
      this.logger.log(`Socket ${client.id} joined room ${conversationId}`);
    }

    // Step 1: Check for existing personal conversation
    const [conversation] = await this.db
      .select()
      .from(schema.conversations)
      .where(
        and(
          eq(schema.conversations.id, conversationId),
          sql`${schema.conversations.participants} @> ${JSON.stringify([senderId])}::jsonb`,
        ),
      );

    if (!conversation) {
      this.logger.log(
        `-------- Conversation doesn't exist for conversation=${conversationId} & userId=${senderId} `,
      );
      return;
    }

    const lastMessageId = conversation.lastMessageId;

    const messages = lastMessageId
      ? await this.db
          .select()
          .from(schema.chat)
          .where(eq(schema.chat.id, lastMessageId))
      : [];

    const lastMessage = messages.length > 0 ? messages[0] : undefined;

    console.log(lastMessage, conversationType);

    if (conversationType === ChatMessageType.TEXT) {
      const isPreviousGameSettled = lastMessage
        ? await this.chattingSocketService.checkIfPreviousGameIsSettled(
            lastMessage,
          )
        : true;

      console.log('isPreviousGameSettled', isPreviousGameSettled);

      if (!isPreviousGameSettled) {
        const rejectReason = 'Cannot send message: game in progress';
        this.logger.warn(rejectReason);
        return rejectReason;
      }

      const [newMessage] = await this.db
        .insert(schema.chat)
        .values({
          type: payload.type,
          senderId: senderId,
          message: payload.p2pChatData?.textMessageData?.message.trim(),
          conversationId: conversation.id,
        })
        .returning();

      await this.db
        .update(schema.conversations)
        .set({
          lastMessageId: newMessage.id,
        })
        .where(eq(schema.conversations.id, conversation.id));

      // for (let i = 0; i < conversation.participants.length; i++) {
      //   const participantId = conversation.participants[i];
      //   const socketId = await this.redisClient.get(participantId);
      //   if (socketId) {
      //     this.server.to(socketId).emit('incoming-p2p-message', {
      //       message: newMessage,
      //     });
      //   }
      // }
      this.server
        .to(conversationId)
        .emit('incoming-p2p-message', { message: newMessage });
    } else if (conversationType === ChatMessageType.GAME) {
      if (payload.gameData && payload.gameData.type === 'request') {
        const isPreviousGameSettled = lastMessage
          ? !(await this.chattingSocketService.checkIfPreviousGameIsSettled(
              lastMessage,
            ))
          : true;

        if (!isPreviousGameSettled) return 'Not allowed';

        const participantIds = conversation.participants;

        const [gameSession] = await this.db
          .insert(schema.gameSessions)
          .values({
            gameId: 'word-search-puzzle',
            requesterId: senderId,
            conversationId: conversationId,
            // requestStatus: GameSessionRequestStatus.PENDING,
            // gameStatus: GameStatus.NOT_STARTED,
          })
          .returning();

        await this.db.insert(schema.gameParticipants).values(
          participantIds.map((participantId) => ({
            gameSessionId: gameSession.id,
            participantId: participantId,
          })),
        );

        const [newMessage] = await this.db
          .insert(schema.chat)
          .values({
            type: conversationType,
            senderId: senderId,
            gameSessionId: gameSession.id,
            conversationId: conversation.id,
          })
          .returning();

        await this.db
          .update(schema.conversations)
          .set({
            lastMessageId: newMessage.id,
          })
          .where(eq(schema.conversations.id, conversation.id));

        // for (let i = 0; i < conversation.participants.length; i++) {
        //   const participantId = conversation.participants[i];
        //   const socketId = await this.redisClient.get(participantId);
        //   if (socketId) {
        //     this.server.to(socketId).emit('incoming-p2p-message', {
        //       message: { ...newMessage, gameSession },
        //     });
        //   }
        // }
        this.server.to(conversationId).emit('incoming-p2p-message', {
          message: { ...newMessage, gameSession },
        });
      } else if (payload.gameData && payload.gameData.type === 'accept') {
        if (lastMessage?.type !== ChatMessageType.GAME) {
          const rejectReason = 'Cannot accept: last message is not a game type';
          this.logger.warn(rejectReason);
          return rejectReason;
        }

        if (lastMessage?.senderId === senderId) {
          const rejectReason = 'Cannot accept:you are the requestor';
          this.logger.warn(rejectReason);
          return rejectReason;
        }

        if (lastMessage?.senderId === senderId) {
          const rejectReason = 'Cannot accept:you are the requestor';
          this.logger.warn(rejectReason);
          return rejectReason;
        }

        if (lastMessage?.gameSessionId) {
          const gameSession = await this.db.query.gameSessions.findFirst({
            where: eq(schema.gameSessions.id, lastMessage.gameSessionId),
          });

          if (gameSession?.requestStatus !== 'pending') {
            const rejectReason = 'Cannot accept: Request is not pending';
            this.logger.warn(rejectReason);
            return rejectReason;
          }

          const [newGameSession] = await this.db
            .update(schema.gameSessions)
            .set({
              acceptedAt: new Date(),
              acceptorId: senderId,
              requestStatus: 'accepted',
            })
            .where(eq(schema.gameSessions.id, lastMessage.gameSessionId))
            .returning();

          // for (let i = 0; i < conversation.participants.length; i++) {
          //   const participantId = conversation.participants[i];
          //   const socketId = await this.redisClient.get(participantId);
          //   if (socketId) {
          //     this.server.to(socketId).emit('incoming-p2p-message', {
          //       message: { ...lastMessage, gameSession: newGameSession },
          //     });
          //   }
          // }
          this.server.to(conversationId).emit('incoming-p2p-message', {
            message: { ...lastMessage, gameSession: newGameSession },
          });
        } else {
          const rejectReason = 'Cannot accept: no game session';
          this.logger.warn(rejectReason);
          return rejectReason;
        }
      } else if (payload.gameData?.type === 'reject') {
        if (lastMessage?.type !== ChatMessageType.GAME) {
          const rejectReason = 'Cannot reject: last message is not a game type';
          this.logger.warn(rejectReason);
          return rejectReason;
        }

        if (lastMessage?.gameSessionId) {
          const [newGameSession] = await this.db
            .update(schema.gameSessions)
            .set({
              rejectedAt: new Date(),
              rejectorId: senderId,
              requestStatus: 'rejected',
            })
            .where(eq(schema.gameSessions.id, lastMessage.gameSessionId))
            .returning();

          // for (let i = 0; i < conversation.participants.length; i++) {
          //   const participantId = conversation.participants[i];
          //   const socketId = await this.redisClient.get(participantId);
          //   if (socketId) {
          //     this.server.to(socketId).emit('incoming-p2p-message', {
          //       message: { ...lastMessage, gameSession: newGameSession },
          //     });
          //   }
          // }
          this.server.to(conversationId).emit('incoming-p2p-message', {
            message: { ...lastMessage, gameSession: newGameSession },
          });
        } else {
          const rejectReason = 'Cannot reject: no game session';
          this.logger.warn(rejectReason);
          return rejectReason;
        }
      }
    }
  }
}
