import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { RedisModule } from '../redis/redis.module';
import { ConfigModule } from '@nestjs/config';
import { DrizzleModule } from 'schema/drizzle.module';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ChattingSocketService } from './chatting-socket.service';
import { GameModule } from '../games/games.module';

@Module({
  imports: [
    RedisModule,
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
    }),
    DrizzleModule,
    ClientsModule.register([
      {
        name: 'AUTH_SERVICE',
        transport: Transport.TCP,
        options: {
          // host: 'https://affinity-backend-testing-1.onrender.com',
          // host: 'localhost',
          port: 3001,
        },
      },
    ]), // Add other microservices here
    ClientsModule.register([
      {
        name: 'CHAT_API_SERVICE',
        transport: Transport.TCP,
        options: {
          // host: 'https://affinity-backend-testing-1.onrender.com',
          // host: 'localhost',
          port: 3000,
        },
      },
    ]), // Add other microservices here
    GameModule,
  ],
  providers: [ChatGateway, ChattingSocketService],
})
export class ChatModule {}
