import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SupabaseUser } from '../common/types/userInterface';

interface AuthenticatedRequest extends Request {
  user?: SupabaseUser;
  cookies?: {
    accessToken?: string;
    // other cookies if needed
  };
}

export const GetUser = createParamDecorator((_, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  const user = request.user;
  // const accessToken = request.cookies?.accessToken;
  return {
    ...user,
    // accessToken,
  };
});
