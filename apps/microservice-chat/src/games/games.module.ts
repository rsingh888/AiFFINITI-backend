import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GameService } from './games.service';

@Module({
  imports: [HttpModule],
  providers: [GameService],
  exports: [GameService],
})
export class GameModule {}
