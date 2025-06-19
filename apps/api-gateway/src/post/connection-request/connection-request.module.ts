import { Module } from '@nestjs/common';
import { ConnectionRequestController } from './connection-request.controller';
import { ConnectionRequestService } from './connection-request.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuthGuard } from '../../common/guard/auth.guard';
import { ChatModule } from '../../chat/chat.module';
@Module({
  imports: [
    ChatModule,
    ClientsModule.register([
      {
        name: 'CONNECTION_SERVICE',
        transport: Transport.TCP,
        options: {
          port: 3004,
        },
      },
      {
        name: 'AUTH_SERVICE',
        transport: Transport.TCP,
        options: {
          port: 3001,
        },
      },
    ]),
  ],
  controllers: [ConnectionRequestController],
  providers: [ConnectionRequestService, AuthGuard],
})
export class ConnectionRequestModule {}
