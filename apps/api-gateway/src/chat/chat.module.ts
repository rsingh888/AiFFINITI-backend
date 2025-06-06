import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatApiGatewayService } from './chat.service';
import { DrizzleModule } from 'schema/drizzle.module';
import { AuthGuard } from '../common/guard/auth.guard';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
    }),
    DrizzleModule,
    ClientsModule.register([
      {
        name: 'AUTH_SERVICE',
        transport: Transport.TCP, // or Transport.RMQ or Transport.REDIS depending on your setup
        options: {
          host: 'localhost',
          port: 3001, // update this as per your auth microservice port
        },
      },
    ]),
  ],
  controllers: [ChatController],
  providers: [ChatApiGatewayService, AuthGuard],
})
export class ChatModule {}
