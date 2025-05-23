import { Module } from '@nestjs/common';
import { AuthApiGatewayModule } from './auth/auth-api-gateway.module';

@Module({
  imports: [AuthApiGatewayModule],
})
export class ApiGatewayModule {}
