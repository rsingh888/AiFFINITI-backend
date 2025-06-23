import { Module } from '@nestjs/common';
import { MicroserviceMiscController } from './misc.controller';
import { MicroserviceMiscService } from './misc.service';
import { DrizzleModule } from 'schema/drizzle.module';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DrizzleModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [MicroserviceMiscController],
  providers: [MicroserviceMiscService],
})
export class MicroserviceMiscModule {}
