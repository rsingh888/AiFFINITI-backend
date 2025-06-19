import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { schema } from '../../../../schema/index';
import { and, eq, sql } from 'drizzle-orm';

@Injectable()
export class ConnectionRequestService {
  constructor(
    @Inject('DRIZZLE_CLIENT')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async likeConnectionRequest(userId: string) {
    try {
      const likeRequests = await this.db
        .select({
          requesterId: schema.connectionRequest.requesterId,
          type: schema.connectionRequest.type,
          status: schema.connectionRequest.status,
        })
        .from(schema.connectionRequest)
        .where(
          and(
            eq(schema.connectionRequest.receiverId, userId),
            eq(schema.connectionRequest.type, 'like'),
            eq(schema.connectionRequest.status, 'pending'),
          ),
        );

      return {
        isSuccess: true,
        message: 'Like connection requests fetched successfully',
        data: likeRequests,
      };
    } catch (err) {
      console.error('likeConnectionRequest error:', err);
      throw new InternalServerErrorException(
        err instanceof Error
          ? err.message
          : 'Failed to fetch like connection requests',
      );
    }
  }

  async aiffinitiConnectionRequest(userId: string) {
    try {
      const aiffinitiRequests = await this.db
        .select({
          requesterId: schema.connectionRequest.requesterId,
          type: schema.connectionRequest.type,
          status: schema.connectionRequest.status,
        })
        .from(schema.connectionRequest)
        .where(
          and(
            eq(schema.connectionRequest.receiverId, userId),
            eq(schema.connectionRequest.type, 'aiffiniti'),
          ),
        );

      return {
        isSuccess: true,
        message: 'Aiffiniti connection requests fetched successfully',
        data: aiffinitiRequests,
      };
    } catch (err) {
      console.error('aiffinitiConnectionRequest error:', err);
      throw new InternalServerErrorException(
        err instanceof Error
          ? err.message
          : 'Failed to fetch aiffiniti connection requests',
      );
    }
  }

  async acceptConnectionRequest(
    userId: string,
    data: { requesterId: string; type: string },
  ) {
    try {
      const { requesterId, type } = data;

      const [request] = await this.db
        .select()
        .from(schema.connectionRequest)
        .where(
          and(
            eq(schema.connectionRequest.requesterId, requesterId),
            eq(schema.connectionRequest.receiverId, userId),
            eq(schema.connectionRequest.status, 'pending'),
            eq(schema.connectionRequest.type, type),
          ),
        );

      if (!request) {
        throw new InternalServerErrorException('Connection request not found');
      }

      await this.db
        .update(schema.connectionRequest)
        .set({ status: 'accepted' })
        .where(
          and(
            eq(schema.connectionRequest.requesterId, requesterId),
            eq(schema.connectionRequest.receiverId, userId),
            eq(schema.connectionRequest.type, type),
          ),
        );

      await this.db
        .delete(schema.connectionRequest)
        .where(
          and(
            eq(schema.connectionRequest.requesterId, requesterId),
            eq(schema.connectionRequest.receiverId, userId),
            eq(schema.connectionRequest.status, 'pending'),
            sql`type != ${type}`,
          ),
        );

      return {
        isSuccess: true,
        message: `Connection request accepted successfully`,
        data: {
          requesterId,
          receiverId: userId,
          type,
          status: 'accepted',
        },
      };
    } catch (err) {
      console.error('acceptConnectionRequest error:', err);
      throw new InternalServerErrorException(
        err instanceof Error
          ? err.message
          : 'Failed to accept connection request',
      );
    }
  }

  async rejectConnectionRequest(
    userId: string,
    data: { requesterId: string; type: string },
  ) {
    try {
      const { requesterId, type } = data;

      const [request] = await this.db
        .select()
        .from(schema.connectionRequest)
        .where(
          and(
            eq(schema.connectionRequest.requesterId, requesterId),
            eq(schema.connectionRequest.receiverId, userId),
            eq(schema.connectionRequest.status, 'pending'),
            eq(schema.connectionRequest.type, type),
          ),
        );

      if (!request) {
        throw new InternalServerErrorException('Connection request not found');
      }

      await this.db
        .update(schema.connectionRequest)
        .set({ status: 'rejected' })
        .where(
          and(
            eq(schema.connectionRequest.requesterId, requesterId),
            eq(schema.connectionRequest.receiverId, userId),
            eq(schema.connectionRequest.type, type),
          ),
        );

      return {
        isSuccess: true,
        message: `Connection request rejected successfully`,
        data: {
          requesterId,
          receiverId: userId,
          type,
          status: 'rejected',
        },
      };
    } catch (err) {
      console.error('rejectConnectionRequest error:', err);
      throw new InternalServerErrorException(
        err instanceof Error
          ? err.message
          : 'Failed to reject connection request',
      );
    }
  }
}
