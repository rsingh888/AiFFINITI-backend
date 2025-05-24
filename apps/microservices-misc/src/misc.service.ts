import { Injectable } from '@nestjs/common';

@Injectable()
export class MicroserviceMiscService {
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
}
