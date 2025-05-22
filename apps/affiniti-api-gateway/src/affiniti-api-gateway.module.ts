import { Module } from '@nestjs/common';
import { AffinitiApiGatewayController } from './affiniti-api-gateway.controller';
import { AffinitiApiGatewayService } from './affiniti-api-gateway.service';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'AUTH_SERVICE',
        transport: Transport.TCP,
        options: {
          // host: 'https://affinity-backend-testing-1.onrender.com',
          host: 'localhost',
          port: 3001,
        },
      },
    ]), // Add other microservices here
  ],
  controllers: [AffinitiApiGatewayController],
  providers: [AffinitiApiGatewayService],
})
export class AffinitiApiGatewayModule {}
