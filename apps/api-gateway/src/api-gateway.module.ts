import { Module } from '@nestjs/common';
import { AuthApiGatewayModule } from './auth/auth-api-gateway.module';
import { MiscApiGatewayModule } from './misc/misc-api-gateway.module';
import { ChatModule } from './chat/chat.module';
import { PostApiGatewayModule } from './post/post/post-api-gateway.module';
import { ConnectionRequestModule } from './post/connection-request/connection-request.module';

@Module({
  imports: [
    AuthApiGatewayModule,
    MiscApiGatewayModule,
    ChatModule,
    PostApiGatewayModule,
    ConnectionRequestModule,
  ],
})
export class ApiGatewayModule {}
