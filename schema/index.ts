import { userInfo, genderType } from './user-info';
import { user } from './user';
import { userLocation } from './user-location';
import {
  userInterests,
  userInterestMapping,
  allInterest,
} from './user-interest-mapping';
import { userMedia } from './user-media';
import { chat, conversations } from './chatting_schemas';
import { gameParticipants, gameSessions } from './game_sessions';

export const schema = {
  user,
  userInfo,
  genderType,
  userInterests,
  userInterestMapping,
  allInterest,
  userMedia,
  userLocation,
  conversations,
  chat,
  gameParticipants,
  gameSessions,
};
