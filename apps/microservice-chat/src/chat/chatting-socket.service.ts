import { ChatMessageType, ISelectChat } from 'schema/chatting_schemas';
import { Injectable, Inject, Logger } from '@nestjs/common';
import { schema } from '../../../../schema/index';

import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, or } from 'drizzle-orm';

@Injectable()
export class ChattingSocketService {
  private readonly logger = new Logger(ChattingSocketService.name);

  constructor(
    @Inject('DRIZZLE_CLIENT')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async checkIfPreviousGameIsSettled(lastMessage: ISelectChat) {
    if (
      lastMessage &&
      lastMessage?.type === ChatMessageType.GAME &&
      lastMessage?.gameSessionId
    ) {
      const [gameSession] = await this.db
        .select()
        .from(schema.gameSessions)
        .where(eq(schema.gameSessions.id, lastMessage.gameSessionId));
      console.log('🟡 : ChattingSocketService : gameSession:', gameSession);

      const isRejected = gameSession?.requestStatus === 'rejected';
      console.log('🟡 : ChattingSocketService : isRejected:', isRejected);

      const isAcceptedAndEnded =
        gameSession?.requestStatus === 'accepted' &&
        gameSession?.gameStatus === 'ended';

      console.log(
        '🟡 : ChattingSocketService : isAcceptedAndEnded:',
        isAcceptedAndEnded,
      );
      if (!isRejected && !isAcceptedAndEnded) {
        this.logger.error('Previous game session is still active or pending');
        return false;
      }
    }

    return true;
  }

  async updateTwoGameTokens({
    id1,
    token1,
    id2,
    token2,
    gameSessionId,
  }: {
    id1: string;
    token1: string;
    id2: string;
    token2: string;
    gameSessionId: string;
  }) {
    return await this.db.transaction(async (tx) => {
      await tx
        .update(schema.gameParticipants)
        .set({ gameToken: token1 })
        .where(
          and(
            eq(schema.gameParticipants.participantId, id1),
            eq(schema.gameParticipants.gameSessionId, gameSessionId),
          ),
        );

      await tx
        .update(schema.gameParticipants)
        .set({ gameToken: token2 })
        .where(
          and(
            eq(schema.gameParticipants.participantId, id2),
            eq(schema.gameParticipants.gameSessionId, gameSessionId),
          ),
        );

      return tx
        .select()
        .from(schema.gameParticipants)
        .where(
          and(
            eq(schema.gameParticipants.gameSessionId, gameSessionId),
            or(
              eq(schema.gameParticipants.participantId, id1),
              eq(schema.gameParticipants.participantId, id2),
            ),
          ),
        );
    });
  }

  async getGameSessionParticipantsWithBothTokens({
    gameSessionId,
  }: {
    gameSessionId: string;
  }) {
    const gameSessionParticipants = await this.db
      .select({
        gameSessionId: schema.gameParticipants.gameSessionId,
        participantId: schema.gameParticipants.participantId,
        score: schema.gameParticipants.score,
        result: schema.gameParticipants.result,
        gameToken: schema.gameParticipants.gameToken,
        createdAt: schema.gameParticipants.createdAt,
      })
      .from(schema.gameParticipants)
      .where(eq(schema.gameParticipants.gameSessionId, gameSessionId));

    return gameSessionParticipants;
  }
}
