import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import { schema } from '../../../schema/index';

const { user, userInfo, userLocation, post } = schema;

@Injectable()
export class MicroserviceMiscService {
  constructor(
    @Inject('DRIZZLE_CLIENT')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  private readonly interestList = [
    'Music',
    'Makeup & Beauty',
    'Movies & TV Shows',
    'Fitness & Gym',
    'Reading / Books',
    'Pets / Animals',
    'Foodie / Cooking',
    'Travel',
    'Tech & Gadgets',
    'Spirituality / Meditation',
    'Art & Creativity',
    'Photography',
    'Dancing',
    'Gaming',
    'Fashion & Style',
    'Social Causes',
    'Outdoor Activities',
    'Comedy/ Memes',
    'Adventure / Hiking',
    'Nightlife / Parties',
    'Board Games & Puzzles',
    'DIY & Crafting',
    'Karaoke',
  ];

  getAllInterests() {
    return this.interestList;
  }

  async getAllMatchingProfiles(
    userId: string,
    data: { skip: number; limit: number },
  ) {
    const { skip, limit } = data;

    const posts = await this.db
      .select({
        postId: post.postId,
        postMediaUrl: post.postMediaUrl,
        nickName: userInfo.nickName,
        city: userLocation.city,

        isLiked: sql`EXISTS (
          SELECT 1 FROM "post-likes"
          WHERE "post-likes"."post-id" = ${post.postId}
          AND "post-likes"."user-id" = ${sql.placeholder('viewerUserId')}
        )`.as('isLiked'),

        hasGivenAiffiniti: sql`EXISTS (
          SELECT 1 FROM "post-aiffinities"
          WHERE "post-aiffinities"."post-id" = ${post.postId}
          AND "post-aiffinities"."user-id" = ${userId}
        )`.as('hasGivenAiffiniti'),

        // Counts
        likesCount: sql`(
          SELECT COUNT(*) FROM "post-likes"
          WHERE "post-likes"."post-id" = ${post.postId}
        )`.as('likesCount'),

        viewsCount: sql`(
          SELECT COUNT(*) FROM "post-views"
          WHERE "post-views"."post-id" = ${post.postId}
        )`.as('viewsCount'),

        aiffinitiCount: sql`(
          SELECT COUNT(*) FROM "post-aiffinities"
          WHERE "post-aiffinities"."post-id" = ${post.postId}
        )`.as('aiffinitiCount'),
      })
      .from(post)
      .leftJoin(user, eq(user.id, post.userId))
      .leftJoin(userInfo, eq(userInfo.userId, user.id))
      .leftJoin(userLocation, eq(userLocation.userId, user.id))
      .limit(limit)
      .offset(skip)
      .execute({ viewerUserId: userId });

    const enriched = posts.map((p) => ({
      ...p,
      city: p.city || 'Delhi',
      hasViewed: false, // Default value, can be updated based on your logic
    }));

    return {
      isSuccess: true,
      message: 'Matching Profiles Retrieved Successfully',
      data: enriched,
    };
  }
}
