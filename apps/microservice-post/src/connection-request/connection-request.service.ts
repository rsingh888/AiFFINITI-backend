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

  async getPendingLikeConnectionRequest(userId: string) {
    try {
      const [receiverLocation] = await this.db
        .select({
          latitude: schema.userLocation.latitude,
          longitude: schema.userLocation.longitude,
        })
        .from(schema.userLocation)
        .where(eq(schema.userLocation.userId, userId));

      if (!receiverLocation) {
        throw new InternalServerErrorException('User location not found');
      }

      const { latitude: lat2, longitude: lon2 } = receiverLocation;

      const likeRequests = await this.db.execute(
        sql`
        SELECT 
          cr."requester-id" AS "requesterId",
          cr."type",
          cr."status",
          ui."nick-name" AS "nickname",
          DATE_PART('year', AGE(ui."date-of-birth")) AS "age",
          ROUND(
            6371 * acos(
              cos(radians(${lat2}))
              * cos(radians(ul.latitude))
              * cos(radians(ul.longitude) - radians(${lon2}))
              + sin(radians(${lat2}))
              * sin(radians(ul.latitude))
            )::numeric, 2
          ) AS "distanceInKm"
        FROM "connection-request" cr
        JOIN "user-info" ui ON ui."user-id" = cr."requester-id"
        JOIN "location" ul ON ul."user-id" = cr."requester-id"
        WHERE 
          cr."receiver-id" = ${userId}
          AND cr."type" = 'like'
          AND cr."status" = 'pending'
      `,
      );

      return {
        isSuccess: true,
        message: 'Like connection requests fetched successfully',
        data: likeRequests.rows,
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

  async getPendingAiffinitiConnectionRequest(userId: string) {
    try {
      const [currentUserLocation] = await this.db
        .select({
          latitude: schema.userLocation.latitude,
          longitude: schema.userLocation.longitude,
        })
        .from(schema.userLocation)
        .where(eq(schema.userLocation.userId, userId));

      if (!currentUserLocation) {
        throw new InternalServerErrorException('User location not found');
      }

      const lat2 = currentUserLocation.latitude;
      const lon2 = currentUserLocation.longitude;

      const aiffinitiRequests = await this.db.execute(
        sql`
      SELECT 
        cr."requester-id" AS "requesterId",
        cr."type",
        cr."status",
        ui."nick-name" AS "nickName",
        DATE_PART('year', AGE(ui."date-of-birth")) AS "age",
        ROUND(
          6371 * acos(
            cos(radians(${lat2}))
            * cos(radians(ul.latitude))
            * cos(radians(ul.longitude) - radians(${lon2}))
            + sin(radians(${lat2}))
            * sin(radians(ul.latitude))
          )::numeric, 2
        ) AS "distanceInKm"
      FROM "connection-request" cr
      JOIN "user-info" ui ON cr."requester-id" = ui."user-id"
      JOIN "location" ul ON cr."requester-id" = ul."user-id"
      WHERE cr."receiver-id" = ${userId}
        AND cr."type" = 'aiffiniti'
        AND cr."status" = 'pending'
    `,
      );

      return {
        isSuccess: true,
        message: 'Aiffiniti connection requests fetched successfully',
        data: aiffinitiRequests.rows,
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
            eq(schema.connectionRequest.status, 'pending'),
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
            eq(schema.connectionRequest.status, 'pending'),
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
