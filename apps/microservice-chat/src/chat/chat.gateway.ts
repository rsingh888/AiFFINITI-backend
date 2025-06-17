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
import {
  ForbiddenException,
  Inject,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Redis } from 'ioredis';

import { createAdapter } from '@socket.io/redis-adapter';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { schema } from '../../../../schema/index';
import { ChatMessageType } from 'schema/chatting_schemas';

import { and, desc, eq, sql } from 'drizzle-orm';
import { SupabaseUser } from 'apps/api-gateway/src/common/types/userInterface';
import { ChattingSocketService } from './chatting-socket.service';
import { GameService } from '../games/games.service';
// import { GameSessionRequestStatus, GameStatus } from 'schema/game_sessions';

const allowedOrigins = [
  'http://localhost:4000',
  'https://testing-aiffiniti-frontend-testing.vercel.app',
  'https://likhilesh.xyz',
];

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    rooms: Set<string>;
  };
}

interface IAuthClientUserInfo {
  id: string;
  email: string | null;
  intro: {
    nickName: string | null;
    dateOfBirth: Date | null;
  };
  location: {
    userId: string;
    longitude: number;
    latitude: number;
    street: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    zipcode: string | null;
  };
  gender: string | null;
  distancePreferredInKm: number | null;
  loginFormCheckPoint: string | null;
  photos: string[];
  videos: string[];
  interests: string[];
}

@WebSocketGateway({
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
  path: '/socket.io',
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
    private readonly gameService: GameService,
  ) {}

  onModuleInit() {
    const pubClient = this.redisClient;
    const subClient = pubClient.duplicate();
    this.server.adapter(createAdapter(pubClient, subClient));
  }

  async handleConnection(client: AuthenticatedSocket) {
    this.logger.log(`Client connected: ${client.id}`);

    const token = client.handshake.auth.token as string;
    console.log('🟡 : token:', token);

    if (!token) {
      this.logger.warn(`Connection rejected: No token`);
      client.disconnect(true);
      return;
    }

    try {
      const user = await firstValueFrom<SupabaseUser>(
        this.authClient.send({ cmd: 'auth-verify-token' }, token),
      );
      console.log('🟡 : handleConnection: user:', user);

      if (!user?.id) {
        throw new Error('Invalid auth token');
      }

      client.data.userId = user.id;
      // client.data.rooms = new Set();
      // await this.redisClient.set(user.id, client.id);

      // Support multiple devices per user
      await this.redisClient.sadd(user.id, client.id);

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

    // if (client.data.rooms) {
    //   for (const room of client.data.rooms) {
    //     await client.leave(room);
    //     this.logger.log(`Socket ${client.id} left room ${room}`);
    //   }
    // }
    // await this.redisClient.del(userId);

    if (userId) {
      await this.redisClient.srem(userId, client.id);
      const remainingSockets = await this.redisClient.scard(userId);
      if (remainingSockets === 0) {
        await this.redisClient.del(userId);
      }
    }

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
      `🟡🟠🟡🟠
      Message from 
      socketId=${client.id}
      senderId=${client.data.userId}
      to 
      recipientId=${payload.conversationId}
      type=${payload.type}
      p2pChatData=${JSON.stringify(payload.p2pChatData)},
      p2pGameData=${JSON.stringify(payload.p2pGameData)}
      🟡🟠`,
    );

    const senderId = client.data.userId;
    const conversationId = payload.conversationId;
    const conversationType = payload.type;

    // if (!client.data.rooms.has(conversationId)) {
    //   await client.join(conversationId);
    //   client.data.rooms.add(conversationId);
    // }

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

    console.log('🟡 lastMessage', lastMessage);
    console.log('🟡 conversationType', conversationType);

    if (conversationType === ChatMessageType.TEXT) {
      const isPreviousGameSettled = lastMessage
        ? await this.chattingSocketService.checkIfPreviousGameIsSettled(
            lastMessage,
          )
        : true;

      console.log('🟡 isPreviousGameSettled', isPreviousGameSettled);

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

      for (let i = 0; i < conversation.participants.length; i++) {
        const participantId = conversation.participants[i];
        // const socketId = await this.redisClient.get(participantId);
        const recipientSockets = await this.redisClient.smembers(participantId);
        for (const socketId of recipientSockets) {
          this.server.to(socketId).emit('incoming-p2p-message', {
            message: newMessage,
          });
        }
      }

      // this.server
      //   .to(conversationId)
      //   .emit('incoming-p2p-message', { message: newMessage });
    } else if (conversationType === ChatMessageType.GAME) {
      if (payload.p2pGameData && payload.p2pGameData.type === 'request') {
        let isPreviousGameSettled = true;

        if (lastMessage !== undefined && lastMessage !== null) {
          isPreviousGameSettled =
            await this.chattingSocketService.checkIfPreviousGameIsSettled(
              lastMessage,
            );
        }

        console.log('🟡 : isPreviousGameSettled:', isPreviousGameSettled);

        if (!isPreviousGameSettled) {
          this.logger.warn(
            'Cannot send text message: Previous game is not settled',
          );
          return 'Cannot send text message: Previous game is not settled';
        }

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

        for (let i = 0; i < conversation.participants.length; i++) {
          const participantId = conversation.participants[i];
          // const socketId = await this.redisClient.get(participantId);
          const recipientSockets =
            await this.redisClient.smembers(participantId);
          for (const socketId of recipientSockets) {
            this.server.to(socketId).emit('incoming-p2p-message', {
              message: { ...newMessage, gameSession },
            });
          }
        }
        // this.server.to(conversationId).emit('incoming-p2p-message', {
        //   message: { ...newMessage, gameSession },
        // });
      } else if (payload.p2pGameData && payload.p2pGameData.type === 'accept') {
        if (lastMessage?.type !== ChatMessageType.GAME) {
          const rejectReason = 'Cannot accept: last message is not a game type';
          this.logger.warn(rejectReason);
          return rejectReason;
        }

        if (lastMessage?.senderId === senderId) {
          const rejectReason = 'Cannot accept: you are the requestor';
          this.logger.warn(rejectReason);
          return rejectReason;
        }

        if (lastMessage?.gameSessionId) {
          const [gameSession] = await this.db
            .select()
            .from(schema.gameSessions)
            .where(eq(schema.gameSessions.id, lastMessage.gameSessionId));

          if (!gameSession) {
            const rejectReason = 'Cannot accept: no game session found';
            this.logger.fatal(rejectReason);
            return rejectReason;
          }

          if (gameSession?.requestStatus !== 'pending') {
            const rejectReason = 'Cannot accept: Request is not pending';
            this.logger.warn(rejectReason);
            return rejectReason;
          }

          let user1: IAuthClientUserInfo | undefined;
          let user2: IAuthClientUserInfo | undefined;

          try {
            const [u1, u2] = await Promise.all([
              firstValueFrom<IAuthClientUserInfo>(
                this.authClient.send(
                  { cmd: 'get-user-details' },
                  {
                    userId: conversation.participants.find(
                      (p) => p === senderId,
                    ),
                  },
                ),
              ),
              firstValueFrom<IAuthClientUserInfo>(
                this.authClient.send(
                  { cmd: 'get-user-details' },
                  {
                    userId: conversation.participants.find(
                      (p) => p !== senderId,
                    ),
                  },
                ),
              ),
            ]);
            user1 = u1;
            user2 = u2;
          } catch (err) {
            this.logger.fatal(
              `Error during getting user information for game token --> ${(err as { message: string }).message}`,
            );
            throw new Error('Error during getting user information for game');
          }

          const [token1, token2] = await Promise.all([
            this.gameService.getExternalData({
              player1: {
                id: user1?.id || 'User 1',
                name: user1?.intro.nickName || 'User 1',
                avatarUrl:
                  'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&w=200',
              },
              player2: {
                id: user2?.id || 'User 1',
                name: user2?.intro.nickName || 'User 1',
                avatarUrl:
                  'https://cdn2.iconfinder.com/data/icons/circle-avatars-1/128/050_girl_avatar_profile_woman_suit_student_officer-512.png',
              },
              sessionId: gameSession.id,
            }),
            this.gameService.getExternalData({
              player2: {
                id: user1?.id || 'User 1',
                name: user1?.intro.nickName || 'User 1',
                avatarUrl:
                  'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&w=200',
              },
              player1: {
                id: user2?.id || 'User 1',
                name: user2?.intro.nickName || 'User 1',
                avatarUrl:
                  'https://cdn2.iconfinder.com/data/icons/circle-avatars-1/128/050_girl_avatar_profile_woman_suit_student_officer-512.png',
              },
              sessionId: gameSession.id,
            }),
          ]);

          if (!token1 || !token2) {
            const rejectReason = 'Cannot accept: Failed to get game tokens';
            this.logger.fatal(rejectReason);
            return rejectReason;
          }

          const data2 = await this.chattingSocketService.updateTwoGameTokens({
            id1: user1?.id,
            id2: user2?.id,
            token1: token1 || '',
            token2: token2 || '',
            gameSessionId: lastMessage.gameSessionId,
          });

          console.log('🟡🟡🟡🟡🟡🟡');
          console.log('🟡🟡🟡🟡🟡🟡 : data2:', data2);

          const [newGameSession] = await this.db
            .update(schema.gameSessions)
            .set({
              acceptedAt: new Date(),
              acceptorId: senderId,
              requestStatus: 'accepted',
            })
            .where(eq(schema.gameSessions.id, lastMessage.gameSessionId))
            .returning();

          const participantsInfoArr =
            await this.chattingSocketService.getGameSessionParticipantsWithBothTokens(
              { gameSessionId: gameSession.id },
            );

          // for (let i = 0; i < conversation.participants.length; i++) {
          //   const participantId = conversation.participants[i];
          //   const socketId = await this.redisClient.get(participantId);
          //   if (socketId) {
          //     this.server.to(socketId).emit('incoming-p2p-message', {
          //       message: { ...lastMessage, gameSession: newGameSession },
          //     });
          //   }
          // }

          for (let i = 0; i < conversation.participants.length; i++) {
            const participantId = conversation.participants[i];
            // const socketId = await this.redisClient.get(participantId);
            const recipientSockets =
              await this.redisClient.smembers(participantId);
            for (const socketId of recipientSockets) {
              const participantsArrayWithUserToken = participantsInfoArr.map(
                (participantInfoObj) => {
                  if (participantInfoObj.participantId !== participantId) {
                    return {
                      ...participantInfoObj,
                      gameToken: '',
                    };
                  } else {
                    return participantInfoObj;
                  }
                },
              );

              this.server.to(socketId).emit('incoming-p2p-message', {
                message: {
                  ...lastMessage,
                  gameSession: {
                    ...newGameSession,
                    participants: participantsArrayWithUserToken,
                  },
                },
              });
            }
          }

          // this.server.to(conversationId).emit('incoming-p2p-message', {
          //   message: { ...lastMessage, gameSession: newGameSession },
          // });
        } else {
          const rejectReason = 'Cannot accept: no game session';
          this.logger.warn(rejectReason);
          return rejectReason;
        }
      } else if (payload.p2pGameData?.type === 'reject') {
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

          for (let i = 0; i < conversation.participants.length; i++) {
            const participantId = conversation.participants[i];
            // const socketId = await this.redisClient.get(participantId);
            const recipientSockets =
              await this.redisClient.smembers(participantId);
            for (const socketId of recipientSockets) {
              this.server.to(socketId).emit('incoming-p2p-message', {
                message: { ...lastMessage, gameSession: newGameSession },
              });
            }
          }

          // this.server.to(conversationId).emit('incoming-p2p-message', {
          //   message: { ...lastMessage, gameSession: newGameSession },
          // });
        } else {
          const rejectReason = 'Cannot reject: no game session';
          this.logger.warn(rejectReason);
          return rejectReason;
        }
      }
    }
  }

  @SubscribeMessage('game-state-refresh')
  async handleGameSessionRefresh(
    @MessageBody()
    payload: { conversationId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    console.log(
      `🟡🟠🟡🟠
      Game State Refresh
      socketId=${client.id}
      senderId=${client.data.userId}
      recipientId=${payload.conversationId}
      🟡🟠`,
    );

    const [conversation] = await this.db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, payload.conversationId))
      .limit(1);

    if (!conversation) throw new NotFoundException('Conversation not found');

    const senderId = client.data.userId;

    if (!conversation.participants.includes(senderId)) {
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
      .where(eq(schema.chat.conversationId, payload.conversationId))
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
        if (gameSessionParticipant.participantId !== senderId) {
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

      for (let i = 0; i < conversation.participants.length; i++) {
        const participantId = conversation.participants[i];
        // const socketId = await this.redisClient.get(participantId);
        const recipientSockets = await this.redisClient.smembers(participantId);
        for (const socketId of recipientSockets) {
          this.server.to(socketId).emit('incoming-p2p-message', {
            message: lastMessagesWithGameSessionAndParticipants,
          });
        }
      }
    }
  }
}
