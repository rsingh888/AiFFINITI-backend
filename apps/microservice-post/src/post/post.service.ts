import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { schema } from '../../../../schema/index';
import { and, eq, or, sql } from 'drizzle-orm';
import { CreatePostDto, PostType } from './dto/create-post.dto';

@Injectable()
export class MicroservicePostService {
  constructor(
    @Inject('DRIZZLE_CLIENT')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  // Create Post Endpoint

  async createPost(userId: string, data: CreatePostDto) {
    try {
      const {
        postMediaUrl,
        postType,
        isPublic = false,
        isDeleted = false,
      } = data;

      if (!Object.values(PostType).includes(postType)) {
        throw new BadRequestException(`Invalid post type: ${postType}`);
      }

      const [newPost] = await this.db
        .insert(schema.post)
        .values({
          userId,
          postMediaUrl,
          postType,
          isPublic,
          isDeleted,
        })
        .returning();

      return {
        isSuccess: true,
        message: 'Post created successfully',
        data: newPost,
      };
    } catch (err) {
      console.error('Create post error:', err);

      if (err instanceof BadRequestException) {
        throw err;
      }

      throw new InternalServerErrorException(
        err instanceof Error ? err.message : 'Failed to create post',
      );
    }
  }

  // like Post Endpoint
  async likePost(userId: string, data: { postId: string }) {
    const { postId } = data;

    try {
      const alreadyLiked = await this.db
        .select()
        .from(schema.postLikes)
        .where(
          and(
            eq(schema.postLikes.postId, postId),
            eq(schema.postLikes.userId, userId),
          ),
        );

      const isLiked = alreadyLiked.length > 0;
      const [post] = await this.db
        .select({ ownerId: schema.post.userId })
        .from(schema.post)
        .where(eq(schema.post.postId, postId));

      if (!post) {
        throw new BadRequestException('Post not found');
      }

      const isSelf = post.ownerId === userId;

      if (isLiked) {
        await this.db
          .delete(schema.postLikes)
          .where(
            and(
              eq(schema.postLikes.postId, postId),
              eq(schema.postLikes.userId, userId),
            ),
          );

        if (!isSelf) {
          await this.db
            .delete(schema.connectionRequest)
            .where(
              and(
                eq(schema.connectionRequest.requesterId, userId),
                eq(schema.connectionRequest.receiverId, post.ownerId),
                eq(schema.connectionRequest.status, 'pending'),
                eq(schema.connectionRequest.type, 'like'),
              ),
            );
        }
      } else {
        await this.db.insert(schema.postLikes).values({ postId, userId });

        if (!isSelf) {
          const existingConnection = await this.db
            .select()
            .from(schema.connectionRequest)
            .where(
              and(
                eq(schema.connectionRequest.requesterId, userId),
                eq(schema.connectionRequest.receiverId, post.ownerId),
                or(
                  and(
                    eq(schema.connectionRequest.type, 'like'),
                    eq(schema.connectionRequest.status, 'pending'),
                  ),
                  eq(schema.connectionRequest.status, 'accepted'),
                ),
              ),
            );

          if (existingConnection.length === 0) {
            await this.db.insert(schema.connectionRequest).values({
              requesterId: userId,
              receiverId: post.ownerId,
              type: 'like',
            });
          }
        }
      }

      //  return  count
      const [{ count }] = await this.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(schema.postLikes)
        .where(eq(schema.postLikes.postId, postId));

      return {
        isSuccess: true,
        message: isLiked ? 'Post unliked' : 'Post liked',
        data: {
          status: isLiked ? 'unliked' : 'liked',
          totalLikes: count,
        },
      };
    } catch (err) {
      console.error('Like post error:', err);
      throw new InternalServerErrorException(
        err instanceof Error
          ? err.message
          : 'Something went wrong while liking/unliking the post',
      );
    }
  }

  // Aiffiniti Post Endpoint

  async aiffinitiPost(userId: string, data: { postId: string }) {
    const { postId } = data;

    try {
      const alreadyAiffiniti = await this.db
        .select()
        .from(schema.postAiffinities)
        .where(
          and(
            eq(schema.postAiffinities.postId, postId),
            eq(schema.postAiffinities.userId, userId),
          ),
        );

      const isAiffiniti = alreadyAiffiniti.length > 0;

      const [post] = await this.db
        .select({ ownerId: schema.post.userId })
        .from(schema.post)
        .where(eq(schema.post.postId, postId));

      if (!post) {
        throw new BadRequestException('Post not found');
      }

      const isSelf = post.ownerId === userId;

      if (isAiffiniti) {
        // Remove aiffiniti
        await this.db
          .delete(schema.postAiffinities)
          .where(
            and(
              eq(schema.postAiffinities.postId, postId),
              eq(schema.postAiffinities.userId, userId),
            ),
          );

        if (!isSelf) {
          await this.db
            .delete(schema.connectionRequest)
            .where(
              and(
                eq(schema.connectionRequest.requesterId, userId),
                eq(schema.connectionRequest.receiverId, post.ownerId),
                eq(schema.connectionRequest.status, 'pending'),
                eq(schema.connectionRequest.type, 'aiffiniti'),
              ),
            );
        }
      } else {
        // Add aiffiniti
        await this.db.insert(schema.postAiffinities).values({ postId, userId });

        if (!isSelf) {
          const existingConnection = await this.db
            .select()
            .from(schema.connectionRequest)
            .where(
              and(
                eq(schema.connectionRequest.requesterId, userId),
                eq(schema.connectionRequest.receiverId, post.ownerId),
                or(
                  and(
                    eq(schema.connectionRequest.type, 'aiffiniti'),
                    eq(schema.connectionRequest.status, 'pending'),
                  ),
                  eq(schema.connectionRequest.status, 'accepted'),
                ),
              ),
            );

          if (existingConnection.length === 0) {
            await this.db.insert(schema.connectionRequest).values({
              requesterId: userId,
              receiverId: post.ownerId,
              type: 'aiffiniti',
            });
          }
        }
      }

      //  Always return correct count
      const [{ count }] = await this.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(schema.postAiffinities)
        .where(eq(schema.postAiffinities.postId, postId));

      return {
        isSuccess: true,
        message: isAiffiniti ? 'Aiffiniti removed' : 'Aiffiniti added',
        data: {
          status: isAiffiniti ? 'aiffiniti-removed' : 'aiffiniti-added',
          totalAiffiniti: count,
        },
      };
    } catch (err) {
      console.error('Affinity toggle error:', err);
      throw new InternalServerErrorException(
        err instanceof Error ? err.message : 'Failed to update affinity',
      );
    }
  }

  // View Post Endpoint

  async viewPost(userId: string, data: { postId: string }) {
    const { postId } = data;

    try {
      // Check if user has already viewed the post
      const alreadyViewed = await this.db
        .select()
        .from(schema.postViews)
        .where(
          and(
            eq(schema.postViews.userId, userId),
            eq(schema.postViews.postId, postId),
          ),
        );

      if (alreadyViewed.length === 0) {
        // Insert view record only if not already viewed
        await this.db.insert(schema.postViews).values({ userId, postId });
      }

      // Get total view count
      const [{ count }] = await this.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(schema.postViews)
        .where(eq(schema.postViews.postId, postId));

      return {
        isSuccess: true,
        message: 'View recorded',
        data: {
          totalViews: count,
        },
      };
    } catch (err) {
      console.error('View post error:', err);
      throw new InternalServerErrorException(
        err instanceof Error ? err.message : 'Failed to record view',
      );
    }
  }
}
