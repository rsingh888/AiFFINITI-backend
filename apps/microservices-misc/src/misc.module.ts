import { Module } from '@nestjs/common';
import { MicroserviceMiscController } from './misc.controller';
import { MicroserviceMiscService } from './misc.service';
import { DrizzleModule } from 'schema/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [MicroserviceMiscController],
  providers: [MicroserviceMiscService],
})
export class MicroserviceMiscModule {}
