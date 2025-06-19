import { Module } from '@nestjs/common';
import { PostApiGatewayController } from './post-api-gateway.controller';
import { PostApiGatewayService } from './post-api-gateway.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuthGuard } from '../../common/guard/auth.guard';
@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'POST_SERVICE',
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
  controllers: [PostApiGatewayController],
  providers: [PostApiGatewayService, AuthGuard],
})
export class PostApiGatewayModule {}
