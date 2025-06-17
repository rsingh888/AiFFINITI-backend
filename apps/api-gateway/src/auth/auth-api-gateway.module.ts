import { Module } from '@nestjs/common';
import { AuthApiGatewayController } from './auth-api-gateway.controller';
import { AuthApiGatewayService } from './auth-api-gateway.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuthGuard } from '../common/guard/auth.guard';

@Module({
  imports: [
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
        name: 'POST_SERVICE',
        transport: Transport.TCP, // or Transport.RMQ or Transport.REDIS depending on your setup
        options: {
          host: 'localhost',
          port: 3004, // update this as per your post microservice port
        },
      },
    ]),
  ],
  controllers: [AuthApiGatewayController],
  providers: [AuthApiGatewayService, AuthGuard],
})
export class AuthApiGatewayModule {}
