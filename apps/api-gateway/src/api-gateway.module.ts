import { Module } from '@nestjs/common';
import { AuthApiGatewayModule } from './auth/auth-api-gateway.module';
import { MiscApiGatewayModule } from './misc/misc-api-gateway.module';
import { ChatModule } from './chat/chat.module';
import { PostApiGatewayModule } from './post/post-api-gateway.module';

@Module({
  imports: [
    AuthApiGatewayModule,
    MiscApiGatewayModule,
    ChatModule,
    PostApiGatewayModule,
  ],
})
export class ApiGatewayModule {}
