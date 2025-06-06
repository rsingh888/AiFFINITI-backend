import { Module } from '@nestjs/common';
import { MiscApiGatewayController } from './misc-api-gateway.controller';
import { MiscApiGatewayService } from './misc-api-gateway.service';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'MISC_SERVICE',
        transport: Transport.TCP,
        options: {
          // host: 'https://affinity-backend-testing-1.onrender.com',
          host: 'localhost',
          port: 3002,
        },
      },
    ]), // Add other microservices here
  ],
  controllers: [MiscApiGatewayController],
  providers: [MiscApiGatewayService],
})
export class MiscApiGatewayModule {}
