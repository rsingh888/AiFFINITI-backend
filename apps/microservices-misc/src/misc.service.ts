import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, inArray, lt, or, sql } from 'drizzle-orm';
import { schema } from '../../../schema/index';
import {
  IUserPostsScores,
  userPostsScores,
  userProfilesScores,
} from 'schema/matching-profiles-schema';
import { postViews } from 'schema/post-views';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GENDER_PREFERENCE_OPTIONS } from 'schema/user-info';

const { user, userInfo, userLocation, post } = schema;

const PROFILE_SCORES = {
  LAST_CHAT_TIME_IN_MINS_FROM_NOW: -0.01,
  GAME_PLAYED: 2,
  JOINING_DATE_IN_MINS_FROM_NOW: -0.1,
  IMAGES_COUNT: 100,
  TOTAL_CHAT_MESSAGES_SENT: 0.1,
};

const POST_SCORES = {
  LIKES: 15,
  VIEWS: 1,
  AIFFINITES: 25,
  CREATION_DATE_IN_MINS_FROM_NOW: -0.25,
};

const RUNTIME_MATCHING_FILTER_SCORES = {
  PER_MATCHING_INTEREST: 100,
  LAT_DIFF: -1000,
  LONG_DIFF: -1000,
  AGE_YEAR_DIFF: -10,
  VIEWED_POST: -1000,
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
        postId: schema.post.postId,
        postMediaUrl: schema.post.postMediaUrl,
        nickName: userInfo.nickName,
        city: userLocation.city,

        isLiked: sql<boolean>`EXISTS (
          SELECT 1 FROM "post-likes"
          WHERE  ${schema.postLikes.postId} = ${schema.post.postId}
          AND ${schema.postLikes.userId} = ${sql.placeholder('viewerUserId')}
        )`.as('isLiked'),

        hasGivenAiffiniti: sql<boolean>`EXISTS (
          SELECT 1 FROM "post-aiffinities"
          WHERE ${schema.postAiffinities.postId} = ${schema.post.postId}
          AND ${schema.postAiffinities.userId} = ${userId}
        )`.as('hasGivenAiffiniti'),

        likesCount: sql<number>`(
          SELECT COUNT(*) FROM "post-likes"
          WHERE ${schema.postLikes.postId} = ${schema.post.postId}
        )`.as('likesCount'),

        viewsCount: sql<number>`(
          SELECT COUNT(*) FROM "post-views"
          WHERE  ${schema.postViews.postId} = ${schema.post.postId}
        )`.as('viewsCount'),

        aiffinitiCount: sql<number>`(
          SELECT COUNT(*) FROM "post-aiffinities"
          WHERE  ${schema.postAiffinities.postId} = ${schema.post.postId}
        )`.as('aiffinitiCount'),
      })
      .from(post)
      .leftJoin(user, eq(user.id, schema.post.userId))
      .leftJoin(userInfo, eq(userInfo.userId, user.id))
      .leftJoin(userLocation, eq(userLocation.userId, user.id))
      .limit(limit)
      .offset(skip)
      .execute({ viewerUserId: userId });

    const enriched = posts.map((p) => ({
      ...p,
      city: p.city || ' ',
      hasViewed: false, // Default value, can be updated based on your logic
    }));

    return {
      isSuccess: true,
      message: 'Matching Profiles Retrieved Successfully',
      data: enriched,
    };
  }

  private doSafeMaths(cb: () => number | string): number {
    const ans = Number(cb());
    if (!isNaN(ans)) return Math.round(ans);
    else return 0;
  }

  private async getUserInfoForMatching(userId: string) {
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

  private async getViewedStatusForPosts(postIds: string[], userId: string) {
    return await this.db
      .selectDistinct({ postId: postViews.postId })
      .from(postViews)
      .where(
        and(inArray(postViews.postId, postIds), eq(postViews.userId, userId)),
      );
  }

  private async generatePostSuggestionsService(userId: string) {
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

    // const interestOverlapCount = sql<number>`cardinality(${userPostsScores.interests} && ARRAY[${targetUser.interests?.map((interest) => `'${interest}'`).join(', ')}]::varchar[])`;

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
        // interestOverlapCount: interestOverlapCount,
      })
      .from(userProfilesScores)
      .innerJoin(
        userPostsScores,
        eq(userProfilesScores.userId, userPostsScores.userId),
      )
      .where(
        and(
          or(
            eq(
              userPostsScores.gender,
              targetUser.genderPreference === GENDER_PREFERENCE_OPTIONS.BOTH
                ? GENDER_PREFERENCE_OPTIONS.MALE
                : targetUser.genderPreference,
            ),
            eq(
              userPostsScores.gender,
              targetUser.genderPreference === GENDER_PREFERENCE_OPTIONS.BOTH
                ? GENDER_PREFERENCE_OPTIONS.FEMALE
                : targetUser.genderPreference,
            ),
          ),
          or(
            eq(userPostsScores.genderPreference, targetUser.gender),
            eq(
              userPostsScores.genderPreference,
              GENDER_PREFERENCE_OPTIONS.BOTH,
            ),
          ),
          lt(distanceExpression, userPostsScores.distancePreferredInKm),
          lt(distanceExpression, targetUser.distancePreferredInKm),
        ),
      )
      .orderBy(
        sql`${userProfilesScores.userProfileBaseScore} + ${userPostsScores.userPostBaseScore} DESC`,
        // interestOverlapCount,
      )
      .limit(1000);

    const viewedPosts = await this.getViewedStatusForPosts(
      preliminaryFilteredResults.map(({ postId }) => postId),
      userId,
    );

    const viewedPostsSet = new Set(viewedPosts.map(({ postId }) => postId));

    const scoredResults = preliminaryFilteredResults.map(
      ({
        postId,
        longitude,
        latitude,
        dateOfBirth,
        // interestOverlapCount,
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

        // totalScore += this.doSafeMaths(
        //   () =>
        //     interestOverlapCount *
        //     RUNTIME_MATCHING_FILTER_SCORES.PER_MATCHING_INTEREST,
        // );

        if (viewedPostsSet.has(postId)) {
          totalScore += RUNTIME_MATCHING_FILTER_SCORES.VIEWED_POST;
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

    const suggestedPosts = sortedPostsByFinalScore.map(({ postId }) => postId);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);

    const [suggestions] = await this.db
      .insert(schema.userPostsSuggestionsStore)
      .values({
        userId: userId,
        postIds: suggestedPosts,
        pickedProfilesCount: suggestedPosts.length,
        createdAt: new Date(),
        expiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [schema.userPostsSuggestionsStore.userId],
        set: {
          postIds: sql`excluded.${sql.identifier(schema.userPostsSuggestionsStore.postIds.name)}`,
          pickedProfilesCount: sql`excluded.${sql.identifier(schema.userPostsSuggestionsStore.pickedProfilesCount.name)}`,
          updatedAt: sql`excluded.${sql.identifier(schema.userPostsSuggestionsStore.updatedAt.name)}`,
          expiresAt: sql`excluded.${sql.identifier(schema.userPostsSuggestionsStore.expiresAt.name)}`,
        },
      })
      .returning();

    return suggestions;
  }

  async getPostsSuggestionsService(userId: string, data: { limit: number }) {
    const limit = Math.min(data.limit, 5);
    console.log('🟡 : MicroserviceMiscService : limit:', limit);

    let [suggestions] = await this.db
      .select()
      .from(schema.userPostsSuggestionsStore)
      .where(eq(schema.userPostsSuggestionsStore.userId, userId));

    if (
      !suggestions ||
      !suggestions.postIds ||
      suggestions.postIds.length === 0
    ) {
      console.log('------ INITIATING for first time !!! -----', suggestions);
      suggestions = await this.generatePostSuggestionsService(userId);
    }

    console.log('🟡 : MicroserviceMiscService : suggestions:', suggestions);

    const currentSuggestions = suggestions.postIds?.slice(0, limit);

    const postsSize = suggestions.postIds?.length;
    console.log('🟡 : MicroserviceMiscService : postsSize:', postsSize);
    const shift = limit % (postsSize || 1);

    const newPostIds =
      suggestions.postIds
        ?.slice(shift)
        .concat(suggestions.postIds?.slice(0, shift)) || [];

    await this.db
      .update(schema.userPostsSuggestionsStore)
      .set({
        postIds: newPostIds,
        updatedAt: new Date(),
        pickedProfilesCount: (suggestions.pickedProfilesCount || 0) + shift,
      })
      .where(eq(schema.userPostsSuggestionsStore.userId, userId));

    const expiresAtTime = new Date(suggestions.expiresAt || '');
    console.log('🟡 : MicroserviceMiscService : expiresAtTime:', expiresAtTime);
    if (
      expiresAtTime.getTime() < Date.now() ||
      (suggestions.pickedProfilesCount || 0) + shift >= (postsSize || 1)
    ) {
      console.log('------ RESETTING for expired !!! -----', suggestions);
      this.generatePostSuggestionsService(userId).catch((err) => {
        this.logger.fatal(
          `--------- USER POSTS Suggestions Failed for userId=${userId}\n\nError: ${(err as { message: string }).message}`,
        );
      });
    }

    if (!currentSuggestions) {
      return {
        isSuccess: true,
        message: 'Suggestions fetched',
        data: {
          posts: [],
        },
      };
    }

    const postsWithAllInfo = await this.getPostDetails(
      currentSuggestions,
      userId,
    );

    return {
      isSuccess: true,
      message: 'Suggestions fetched',
      data: {
        posts: postsWithAllInfo,
      },
    };
  }

  private async getPostDetails(postIds: string[], userId: string) {
    /* Caution: need to use fully aware ORM way */
    const posts = await this.db
      .select({
        postId: post.postId,
        postMediaUrl: post.postMediaUrl,
        nickName: userInfo.nickName,
        city: userLocation.city,

        isLiked: sql<boolean>`EXISTS (
          SELECT 1 FROM "post-likes"
          WHERE  ${schema.postLikes.postId} = ${schema.post.postId}
          AND ${schema.postLikes.userId} = ${sql.placeholder('viewerUserId')}
        )`.as('isLiked'),

        hasGivenAiffiniti: sql<boolean>`EXISTS (
          SELECT 1 FROM "post-aiffinities"
          WHERE ${schema.postAiffinities.postId} = ${schema.post.postId}
          AND ${schema.postAiffinities.userId} = ${userId}
        )`.as('hasGivenAiffiniti'),

        hasViewed: sql<boolean>`EXISTS (
          SELECT 1 FROM "post-views"
          WHERE ${schema.postViews.postId} = ${post.postId}
          AND ${schema.postViews.userId} = ${sql.placeholder('viewerUserId')}
        )`.as('hasViewed'),

        likesCount: sql<number>`(
          SELECT COUNT(*) FROM "post-likes"
          WHERE ${schema.postLikes.postId} = ${schema.post.postId}
        )`.as('likesCount'),

        viewsCount: sql<number>`(
          SELECT COUNT(*) FROM "post-views"
          WHERE  ${schema.postViews.postId} = ${schema.post.postId}
        )`.as('viewsCount'),

        aiffinitiCount: sql<number>`(
          SELECT COUNT(*) FROM "post-aiffinities"
          WHERE  ${schema.postAiffinities.postId} = ${schema.post.postId}
        )`.as('aiffinitiCount'),
      })
      .from(post)
      .leftJoin(user, eq(user.id, post.userId))
      .leftJoin(userInfo, eq(userInfo.userId, user.id))
      .leftJoin(userLocation, eq(userLocation.userId, user.id))
      .where(inArray(schema.post.postId, postIds))
      .execute({ viewerUserId: userId });

    const enriched = posts.map((p) => ({
      ...p,
      city: p.city || ' ',
    }));

    return enriched;
  }

  private async getImagesCount(userIds: string[]) {
    return this.db
      .select({
        userId: schema.userMedia.userId,
        imageCount: sql<number>`COUNT(*)`.as('imageCount'),
      })
      .from(schema.userMedia)
      .where(inArray(schema.userMedia.userId, userIds))
      .groupBy(schema.userMedia.userId);
  }

  private async getJoiningDates(userIds: string[]) {
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

  private async getGamesPlayed(userIds: string[]) {
    return this.db
      .select({
        userId: schema.gameParticipants.participantId,
        gamesPlayed: sql<number>`COUNT(*)`.as('gamesPlayed'),
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

  private async getSenderStats(userIds: string[]) {
    return this.db
      .select({
        userId: schema.chat.senderId,
        lastChatTime: sql<Date | string>`MAX(${schema.chat.createdAt})`.as(
          'lastChatTime',
        ),
        totalChatMessagesSent: sql<number>`COUNT(*)`.as(
          'totalChatMessagesSent',
        ),
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

  private getScoreForDateDiffInMin(
    previousDate: string | Date,
    laterDate: string | Date,
    maxScore: number,
    decrementalFactor: number, // should be negative
    minimumScore: number = 0, // should be negative
  ) {
    const prev = new Date(previousDate);
    const later = new Date(laterDate);
    const diffMins = (later.getTime() - prev.getTime()) / (1000 * 60);
    return Math.max(maxScore + diffMins * decrementalFactor, minimumScore);
  }

  private async processProfileScores(userIds: string[]) {
    const senderStats = await this.getSenderStats(userIds);

    const gamesPlayed = await this.getGamesPlayed(userIds);

    const joiningDates = await this.getJoiningDates(userIds);

    const imageCounts = await this.getImagesCount(userIds);

    const mapByUserId = <T extends { userId: string }>(arr: T[]) =>
      Object.fromEntries(arr.map((row) => [row.userId, row]));

    const data = userIds.map((userId) => ({
      ...mapByUserId(senderStats)[userId],
      ...mapByUserId(gamesPlayed)[userId],
      ...mapByUserId(joiningDates)[userId],
      ...mapByUserId(imageCounts)[userId],
    }));

    const timeNow = new Date();

    const profileScores = data.map(
      ({
        userId,
        imageCount,
        joiningDate,
        gamesPlayed,
        lastChatTime,
        totalChatMessagesSent,
      }) => {
        let userProfileBaseScore = imageCount * PROFILE_SCORES.IMAGES_COUNT;

        if (joiningDate) {
          // const joinDate = new Date(joiningDate);
          // const today = new Date();
          // const diffMins = (today.getTime() - joinDate.getTime()) / (1000 * 60);
          // userProfileBaseScore += Math.max(
          //   1000 + diffMins * PROFILE_SCORES.JOINING_DATE_IN_MINS_FROM_NOW,
          //   0,
          // );
          userProfileBaseScore += this.getScoreForDateDiffInMin(
            joiningDate,
            new Date(),
            1000,
            PROFILE_SCORES.JOINING_DATE_IN_MINS_FROM_NOW,
          );
        }

        if (gamesPlayed) {
          userProfileBaseScore += gamesPlayed * PROFILE_SCORES.GAME_PLAYED;
        }

        if (lastChatTime && typeof lastChatTime === 'string') {
          // const lastChatDate = new Date(lastChatTime);
          // const today = new Date();
          // const diffMins =
          //   (today.getTime() - lastChatDate.getTime()) / (1000 * 60);
          // userProfileBaseScore += Math.max(
          //   diffMins * PROFILE_SCORES.LAST_CHAT_TIME_IN_MINS_FROM_NOW,
          //   -1000,
          // );
          userProfileBaseScore += this.getScoreForDateDiffInMin(
            lastChatTime,
            new Date(),
            0,
            PROFILE_SCORES.LAST_CHAT_TIME_IN_MINS_FROM_NOW,
            -1000,
          );
        }

        if (totalChatMessagesSent) {
          userProfileBaseScore +=
            totalChatMessagesSent * PROFILE_SCORES.TOTAL_CHAT_MESSAGES_SENT;
        }

        return {
          userId,
          userProfileBaseScore: Math.round(userProfileBaseScore),
          createdAt: timeNow,
          updatedAt: timeNow,
        };
      },
    );

    await this.db
      .insert(userProfilesScores)
      .values(profileScores)
      .onConflictDoUpdate({
        target: [userProfilesScores.userId],
        set: {
          userProfileBaseScore: sql`excluded.${sql.identifier(userProfilesScores.userProfileBaseScore.name)}`,
          updatedAt: sql`excluded.${sql.identifier(userProfilesScores.updatedAt.name)}`,
        },
      })
      .returning();
  }

  private async processPostsScores(posts: IUserPostsScores[]) {
    const postIds = [...new Set(posts.map(({ postId }) => postId))];

    const likesCounts = await this.db
      .select({
        postId: schema.postLikes.postId,
        likesCount: sql<number>`COUNT(*)`.as('likesCount'),
      })
      .from(schema.postLikes)
      .where(inArray(schema.postLikes.postId, postIds))
      .groupBy(schema.postLikes.postId);

    const viewsCounts = await this.db
      .select({
        postId: schema.postViews.postId,
        viewsCount: sql<number>`COUNT(*)`.as('viewsCount'),
      })
      .from(schema.postViews)
      .where(inArray(schema.postViews.postId, postIds))
      .groupBy(schema.postViews.postId);

    const affinitiesCounts = await this.db
      .select({
        postId: schema.postAiffinities.postId,
        affinitiesCount: sql<number>`COUNT(*)`.as('affinitiesCount'),
      })
      .from(schema.postAiffinities)
      .where(inArray(schema.postAiffinities.postId, postIds))
      .groupBy(schema.postAiffinities.postId);

    const mapByPostId = <T extends { postId: string }>(rows: T[]) =>
      Object.fromEntries(rows.map((r) => [r.postId, r]));

    const likesMap = mapByPostId(likesCounts);
    const viewsMap = mapByPostId(viewsCounts);
    const affinitiesMap = mapByPostId(affinitiesCounts);

    const postsWithScores = posts.map(({ postId, createdAt, ...restPost }) => {
      let userPostBaseScore = 0;

      const likesCount = likesMap[postId]?.likesCount ?? 0;
      const viewsCount = viewsMap[postId]?.viewsCount ?? 0;
      const affinitiesCount = affinitiesMap[postId]?.affinitiesCount ?? 0;

      if (likesCount) {
        userPostBaseScore += likesCount * POST_SCORES.LIKES;
      }
      if (viewsCount) {
        userPostBaseScore += viewsCount * POST_SCORES.VIEWS;
      }
      if (affinitiesCount) {
        userPostBaseScore += affinitiesCount * POST_SCORES.AIFFINITES;
      }
      if (createdAt) {
        userPostBaseScore += this.getScoreForDateDiffInMin(
          createdAt,
          new Date(),
          2000,
          POST_SCORES.CREATION_DATE_IN_MINS_FROM_NOW,
          0,
        );
      }

      return {
        ...restPost,
        postId,
        userPostBaseScore: Math.round(userPostBaseScore),
      };
    });

    // This logic is not good we need to optimize it

    await this.db
      .insert(schema.userPostsScores)
      .values(postsWithScores)
      .onConflictDoUpdate({
        target: [schema.userPostsScores.postId], // conflict target is postId (primary key)
        set: {
          userPostBaseScore: sql`excluded.${sql.identifier(schema.userPostsScores.userPostBaseScore.name)}`,
          updatedAt: sql`excluded.${sql.identifier(schema.userPostsScores.updatedAt.name)}`,
        },
      })
      .returning();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  private async processProfileAndPostsScores() {
    this.logger.log('------- CRON:: processProfileAndPostsScores ------');

    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(userPostsScores)
      .where(eq(schema.userPostsScores.isPublic, true));

    const pageSize = 100;
    const totalPages = Math.ceil(count / pageSize);

    for (let page = 0; page < totalPages; page++) {
      const posts = await this.db
        .select()
        .from(userPostsScores)
        .where(eq(schema.userPostsScores.isPublic, true))
        .limit(pageSize)
        .offset(page * pageSize);

      const usersArr = new Set(
        posts.flatMap(({ userId }) => (userId === null ? [] : userId)),
      );

      const userIds = [...usersArr];

      await this.processProfileScores(userIds);

      await this.processPostsScores(posts);
    }
  }
}
