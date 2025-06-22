import { userInfo, genderType, genderPreferenceType } from './user-info';
import { user, loginFormCheckPointEnum } from './user';
import { userLocation } from './user-location';
import { userInterestMapping, allInterest } from './user-interest-mapping';
import { userMedia } from './user-media';
import { chat, conversations } from './chatting_schemas';
import { gameParticipants, gameSessions } from './game_sessions';
import { postLikes } from './post-likes';
import { postViews } from './post-views';
import { post } from './post';
import { postAiffinities } from './post-aiffiniti';
import { connectionRequest } from './connection-request';
import {
  userChatStatistics,
  userPostsScores,
  userPostsSuggestionsStore,
  userProfilesScores,
} from './matching-profiles-schema';

export const schema = {
  user,
  loginFormCheckPointEnum,
  userInfo,
  genderType,
  genderPreferenceType,
  userInterestMapping,
  allInterest,
  userMedia,
  userLocation,
  conversations,
  chat,
  gameParticipants,
  gameSessions,
  postLikes,
  postViews,
  post,
  postAiffinities,
  connectionRequest,
  userChatStatistics,
  userProfilesScores,
  userPostsScores,
  userPostsSuggestionsStore,
};
