import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { schema } from '../../../schema/index';

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

  async getAllMatchingProfiles(skip: number, limit: number) {
    const allProfiles = await this.db
      .select()
      .from(schema.user)
      .limit(limit)
      .offset(skip);

    return {
      isSuccess: true,
      message: 'User Sent Successfully',
      data: {
        allProfiles,
      },
    };
  }

  showProfileView(userId: string, data: { viewedId: string }) {
    try {
      const { viewedId } = data;

      if (!viewedId) {
        throw new Error('viewedId is required');
      }

      if (viewedId === userId) {
        return {
          isSuccess: false,
          message: 'Cannot view your own profile',
          data: {},
        };
      }

      // You can insert logic here to track the view in a database if needed
      // await this.db.insert(...)

      return {
        isSuccess: true,
        message: 'Profile view recorded',
        data: {},
      };
    } catch (err: unknown) {
      console.error('Error in showProfileView:', err);

      let errorMessage = 'An unknown error occurred';
      if (err instanceof Error) {
        errorMessage = err.message;
      }

      return {
        isSuccess: false,
        message: 'Failed to record profile view',
        error: errorMessage,
      };
    }
  }
}
