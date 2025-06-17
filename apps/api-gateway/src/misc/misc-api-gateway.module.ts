import { Module } from '@nestjs/common';
import { MiscApiGatewayController } from './misc-api-gateway.controller';
import { MiscApiGatewayService } from './misc-api-gateway.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuthModule } from 'apps/microservices-auth/src/auth/auth.module';

@Module({
  imports: [
    AuthModule,
    ClientsModule.register([
      {
        name: 'AUTH_SERVICE',
        transport: Transport.TCP,
        options: {
          port: 3001,
        },
      },
      {
        name: 'MISC_SERVICE',
        transport: Transport.TCP,
        options: {
          port: 3002,
        },
      },
    ]),
  ],
  controllers: [MiscApiGatewayController],
  providers: [MiscApiGatewayService],
})
export class MiscApiGatewayModule {}
