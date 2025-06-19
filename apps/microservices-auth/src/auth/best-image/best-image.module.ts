import { Module } from '@nestjs/common';
import { BestImageService } from './best-image.service';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    HttpModule,
  ],
  providers: [BestImageService],
  exports: [BestImageService],
})
export class BestImageModule {}
