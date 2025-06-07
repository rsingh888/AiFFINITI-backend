import { ChatMessageType, ISelectChat } from 'schema/chatting_schemas';
import { Injectable, Inject, Logger } from '@nestjs/common';
import { schema } from '../../../../schema/index';

import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';

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
      const gameSession = await this.db.query.gameSessions.findFirst({
        where: eq(schema.gameSessions.id, lastMessage.gameSessionId),
      });

      const isRejected = gameSession?.requestStatus === 'rejected';

      const isAcceptedAndEnded =
        gameSession?.requestStatus === 'accepted' &&
        gameSession?.gameStatus === 'ended';

      if (!isRejected && !isAcceptedAndEnded) {
        this.logger.error('Previous game session is still active or pending');
        return false;
      }
    }

    return true;
  }
}
