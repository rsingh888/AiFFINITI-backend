import { Module } from '@nestjs/common';
import { AuthApiGatewayModule } from './auth/auth-api-gateway.module';
import { MiscApiGatewayModule } from './misc/misc-api-gateway.module';

@Module({
  imports: [AuthApiGatewayModule, MiscApiGatewayModule],
})
export class ApiGatewayModule {}
