import { userInfo } from './user-info';
import { user } from './user';
import { userLocation } from './user-location';
import { userInterests, userInterestMapping } from './user-interest-mapping';
import { userMedia } from './user-media';
import { chat, conversations } from './chatting_schemas';

export const schema = {
  user,
  userInfo,
  userInterests,
  userInterestMapping,
  userMedia,
  userLocation,
  conversations,
  chat,
};
