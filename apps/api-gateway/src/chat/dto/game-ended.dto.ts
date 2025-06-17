import { Type } from 'class-transformer';
import {
  IsString,
  IsDate,
  IsArray,
  ValidateNested,
  IsEnum,
  IsNumber,
  IsOptional,
} from 'class-validator';

enum GameState {
  //   STARTED = 'started',
  //   IN_PROGRESS = 'in_progress',
  ENDED = 'ended',
}

class PlayerDto {
  @IsString()
  userId: string;

  @IsNumber()
  score: number;

  @IsOptional()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  avatarUrl: string;
}

class GameSessionDto {
  @IsString()
  sessionId: string;

  @IsDate()
  @Type(() => Date)
  gameEndTime: Date;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlayerDto)
  players: PlayerDto[];
}

export class GameEndedDto {
  @IsEnum(GameState)
  state: GameState;

  @ValidateNested()
  @Type(() => GameSessionDto)
  gameSession: GameSessionDto;
}
