import { Module } from '@nestjs/common';
import { AuthApiGatewayModule } from './auth/auth-api-gateway.module';
import { MiscApiGatewayModule } from './misc/misc-api-gateway.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [AuthApiGatewayModule, MiscApiGatewayModule, ChatModule],
})
export class ApiGatewayModule {}
