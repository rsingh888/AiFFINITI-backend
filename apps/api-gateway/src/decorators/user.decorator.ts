import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AppUser } from '../common/types/userInterface';

interface AuthenticatedRequest extends Request {
  user?: AppUser;
  cookies?: {
    accessToken?: string;
    // other cookies if needed
  };
}

export const GetUser = createParamDecorator((_, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  const user = request.user;

  return {
    ...user,
  };
});
