import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { schema } from '../../../schema/index';
import {
  userPostsScores,
  userProfilesScores,
} from 'schema/matching-profiles-schema';
import { postViews } from 'schema/post-views';
import { Cron, CronExpression } from '@nestjs/schedule';

const { user, userInfo, userLocation, post } = schema;

const RUNTIME_MATCHING_FILTER_SCORES = {
  PER_MATCHING_INTEREST: 100,
  LAT_DIFF: -1000,
  LONG_DIFF: -1000,
  AGE_YEAR_DIFF: -10,
};

@Injectable()
export class MicroserviceMiscService {
  private readonly logger = new Logger(MicroserviceMiscService.name);

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

  doSafeMaths(cb: () => number | string): number {
    const ans = Number(cb());
    if (!isNaN(ans)) return Math.round(ans);
    else return 0;
  }

  async getUserInfoForMatching(userId: string) {
    const [result] = await this.db
      .select({
        latitude: userPostsScores.latitude,
        longitude: userPostsScores.longitude,
        distancePreferredInKm: userPostsScores.distancePreferredInKm,
        dateOfBirth: userPostsScores.dateOfBirth,
        gender: userPostsScores.gender,
        genderPreference: userPostsScores.genderPreference,
        interests: userPostsScores.interests,
      })
      .from(userPostsScores)
      .where(eq(userPostsScores.userId, userId));

    return result;
  }

  async getViewedStatusForPosts(postIds: string[]) {
    return await this.db
      .selectDistinct({ postId: postViews.postId })
      .from(postViews)
      .where(inArray(postViews.postId, postIds));
  }

  async generatePostSuggestionsService(userId: string) {
    const targetUser = await this.getUserInfoForMatching(userId);

    if (!targetUser) {
      this.logger.log('UserInfo not found for user matching!');
      throw new InternalServerErrorException(
        'UserInfo not found for user matching!',
      );
    }

    const earthRadiusKm = 6371;

    const distanceExpression = sql<number>`
      ${earthRadiusKm} * acos(
        cos(radians(${targetUser.latitude})) * cos(radians(${userPostsScores.latitude})) *
        cos(radians(${userPostsScores.longitude} - ${targetUser.longitude})) +
        sin(radians(${targetUser.latitude})) * sin(radians(${userPostsScores.latitude}))
      )
    `;

    const interestOverlapCount = sql<number>`cardinality(${userPostsScores.interests} && ARRAY[${targetUser.interests?.map((interest) => `'${interest}'`).join(', ')}]::varchar[])`;

    const preliminaryFilteredResults = await this.db
      .select({
        // userId: userProfilesScores.userId,
        // userProfileBaseScore: userProfilesScores.userProfileBaseScore,
        // userPostBaseScore: userPostsScores.userPostBaseScore,
        // distancePreferredInKm: userPostsScores.distancePreferredInKm,
        // gender: userPostsScores.gender,
        // genderPreference: userPostsScores.genderPreference,
        // interests: userPostsScores.interests,
        postId: userPostsScores.postId,
        longitude: userPostsScores.longitude,
        latitude: userPostsScores.latitude,
        dateOfBirth: userPostsScores.dateOfBirth,
        totalScore: sql<number>`${userProfilesScores.userProfileBaseScore} + ${userPostsScores.userPostBaseScore}`,
        interestOverlapCount: interestOverlapCount,
      })
      .from(userProfilesScores)
      .innerJoin(
        userPostsScores,
        eq(userProfilesScores.userId, userPostsScores.userId),
      )
      .where(
        and(
          eq(userPostsScores.gender, targetUser.genderPreference),
          eq(userPostsScores.genderPreference, targetUser.gender),
          lt(distanceExpression, userPostsScores.distancePreferredInKm),
          lt(distanceExpression, userInfo.distancePreferredInKm),
        ),
      )
      .orderBy(
        sql`${userProfilesScores.userProfileBaseScore} + ${userPostsScores.userPostBaseScore} DESC`,
        interestOverlapCount,
      )
      .limit(1000);

    const viewedPosts = await this.getViewedStatusForPosts(
      preliminaryFilteredResults.map(({ postId }) => postId),
    );

    const viewedPostsSet = new Set(viewedPosts.map(({ postId }) => postId));

    const scoredResults = preliminaryFilteredResults.map(
      ({
        postId,
        longitude,
        latitude,
        dateOfBirth,
        interestOverlapCount,
        totalScore,
      }) => {
        totalScore += this.doSafeMaths(
          () =>
            Math.abs(targetUser.latitude - latitude) *
            RUNTIME_MATCHING_FILTER_SCORES.LAT_DIFF,
        );

        totalScore += this.doSafeMaths(
          () =>
            Math.abs(targetUser.longitude - longitude) *
            RUNTIME_MATCHING_FILTER_SCORES.LONG_DIFF,
        );

        totalScore += this.doSafeMaths(() => {
          const dob1 = new Date(targetUser.dateOfBirth);
          const dob2 = new Date(dateOfBirth);
          return (
            Math.abs(dob1.getFullYear() - dob2.getFullYear()) *
            RUNTIME_MATCHING_FILTER_SCORES.AGE_YEAR_DIFF
          );
        });

        totalScore += this.doSafeMaths(
          () =>
            interestOverlapCount *
            RUNTIME_MATCHING_FILTER_SCORES.PER_MATCHING_INTEREST,
        );

        if (viewedPostsSet.has(postId)) {
          totalScore += this.doSafeMaths(
            () =>
              interestOverlapCount *
              RUNTIME_MATCHING_FILTER_SCORES.PER_MATCHING_INTEREST,
          );
        }

        return {
          postId,
          totalScore,
        };
      },
    );

    const sortedPostsByFinalScore = scoredResults.sort(
      (a, b) => b.totalScore - a.totalScore,
    );
    console.log(
      '🟡 : MicroserviceMiscService : sortedPostsByFinalScore:',
      sortedPostsByFinalScore,
    );
  }

  async getPostsSuggestionsService(userId: string, data: { limit: number }) {
    const limit = Math.min(data.limit, 10);
    console.log('🟡 : MicroserviceMiscService : limit:', limit);

    const [suggestions] = await this.db
      .select()
      .from(schema.userPostsSuggestionsStore)
      .where(eq(schema.userPostsSuggestionsStore.userId, userId));

    if (!suggestions) {
      // suggestions =
      await this.generatePostSuggestionsService(userId);
    }
    console.log('🟡 : MicroserviceMiscService : suggestions:', suggestions);
  }

  async getImagesCount(userIds: string[]) {
    return this.db
      .select({
        userId: schema.userMedia.userId,
        imageCount: sql`COUNT(*)`.as('imageCount'),
      })
      .from(schema.userMedia)
      .where(inArray(schema.userMedia.userId, userIds))
      .groupBy(schema.userMedia.userId);
  }

  async getJoiningDates(userIds: string[]) {
    return this.db
      .select({
        userId: schema.user.id,
        joiningDate: schema.user.createdAt,
      })
      .from(schema.user)
      .where(
        inArray(
          schema.user.id,
          userIds.filter((id): id is string => id !== null),
        ),
      );
  }

  async getGamesPlayed(userIds: string[]) {
    return this.db
      .select({
        userId: schema.gameParticipants.participantId,
        gamesPlayed: sql`COUNT(*)`.as('gamesPlayed'),
      })
      .from(schema.gameParticipants)
      .innerJoin(
        schema.gameSessions,
        eq(schema.gameParticipants.gameSessionId, schema.gameSessions.id),
      )
      .where(
        and(
          inArray(
            schema.gameParticipants.participantId,
            userIds.filter((id): id is string => id !== null),
          ),
          eq(schema.gameSessions.requestStatus, 'accepted'),
          eq(schema.gameSessions.gameStatus, 'ended'),
        ),
      )
      .groupBy(schema.gameParticipants.participantId);
  }

  async getSenderStats(userIds: string[]) {
    return this.db
      .select({
        userId: schema.chat.senderId,
        lastChatTime: sql`MAX(${schema.chat.createdAt})`.as('lastChatTime'),
        totalSent: sql`COUNT(*)`.as('totalSent'),
        //     avgDelay: sql`
        // AVG(EXTRACT(EPOCH FROM ${schema.chat.createdAt} - LAG(${schema.chat.createdAt}) OVER (
        //   PARTITION BY ${schema.chat.senderId} ORDER BY ${schema.chat.createdAt}
        // )) / 3600)`.as('avgDelayHours'),
      })
      .from(schema.chat)
      .where(
        inArray(
          schema.chat.senderId,
          userIds.filter((id): id is string => id !== null),
        ),
      )
      .groupBy(schema.chat.senderId);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processProfileAndPostsScores() {
    this.logger.log('------- CRON:: processProfileAndPostsScores ------');

    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(userPostsScores);

    const pageSize = 100;
    const totalPages = Math.ceil(count / pageSize);

    for (let page = 0; page < totalPages; page++) {
      const posts = await this.db
        .select()
        .from(userPostsScores)
        .limit(pageSize)
        .offset(page * pageSize);

      const usersArr = new Set(
        posts.flatMap(({ userId }) => (userId === null ? [] : userId)),
      );

      const userIds = [...usersArr];

      const senderStats = await this.getSenderStats(userIds);
      console.log('🟡 : MicroserviceMiscService : senderStats:', senderStats);

      const gamesPlayed = await this.getGamesPlayed(userIds);
      console.log('🟡 : MicroserviceMiscService : gamesPlayed:', gamesPlayed);

      const joiningDates = await this.getJoiningDates(userIds);
      console.log('🟡 : MicroserviceMiscService : joiningDates:', joiningDates);

      const imageCounts = await this.getImagesCount(userIds);
      console.log('🟡 : MicroserviceMiscService : imageCounts:', imageCounts);

      const mapByUserId = <T extends { userId: string }>(arr: T[]) =>
        Object.fromEntries(arr.map((row) => [row.userId, row]));

      const data = userIds.map((userId) => ({
        ...mapByUserId(senderStats)[userId],
        ...mapByUserId(gamesPlayed)[userId],
        ...mapByUserId(joiningDates)[userId],
        ...mapByUserId(imageCounts)[userId],
      }));

      console.log('🟡 : MicroserviceMiscService : data:', data);
    }
  }
}
