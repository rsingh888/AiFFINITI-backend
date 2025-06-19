import { Module } from '@nestjs/common';
import { MicroservicePostController } from './post.controller';
import { MicroservicePostService } from './post.service';
import { DrizzleModule } from 'schema/drizzle.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DrizzleModule,
  ],
  controllers: [MicroservicePostController],
  providers: [MicroservicePostService],
})
export class PostModule {}
