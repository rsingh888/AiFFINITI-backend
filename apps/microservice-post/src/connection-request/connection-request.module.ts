import { Module } from '@nestjs/common';
import { ConnectionRequestController } from './connection-request.controller';
import { ConnectionRequestService } from './connection-request.service';
import { DrizzleModule } from 'schema/drizzle.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DrizzleModule,
  ],
  controllers: [ConnectionRequestController],
  providers: [ConnectionRequestService],
})
export class ConnectionRequestModule {}
