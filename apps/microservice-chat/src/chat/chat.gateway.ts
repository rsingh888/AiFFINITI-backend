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

import { eq } from 'drizzle-orm';
import { SupabaseUser } from 'apps/api-gateway/src/common/types/userInterface';

const allowedOrigins = [
  'http://localhost:4000',
  'https://testing-aiffiniti-frontend-testing.vercel.app',
];

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
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
    const userId = client.data['userId'];
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
      p2pGameData=${JSON.stringify(payload.p2pGameRequest)}`,
    );

    const senderId = client.data.userId;
    const conversationId = payload.conversationId;
    const conversationType = payload.type;

    // Step 1: Check for existing personal conversation
    const [conversation] = await this.db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, conversationId));

    if (!conversation) {
      console.log("!!!--------!!! Conversation doesn't exist! ");
      return;
    }

    if (conversationType === ChatMessageType.TEXT) {
      const [newMessage] = await this.db
        .insert(schema.chat)
        .values({
          type: payload.type,
          senderId: senderId,
          messageData: {
            message: payload.p2pChatData?.textMessageData?.message,
          },
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
        const socketId = await this.redisClient.get(participantId);
        if (socketId) {
          this.server.to(socketId).emit('incoming-p2p-message', {
            message: newMessage,
          });
        }
      }
    }
  }
}
