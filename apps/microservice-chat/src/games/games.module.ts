import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GameService } from './games.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    HttpModule,
  ],
  providers: [GameService],
  exports: [GameService],
})
export class GameModule {}
