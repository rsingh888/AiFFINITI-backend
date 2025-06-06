import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { SupabaseUser } from '../types/userInterface';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    interface RequestWithUser {
      headers: Record<string, string | undefined>;
      user?: SupabaseUser;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();

    const authHeader = request.headers?.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided');
    }

    const token = authHeader.split(' ')[1];

    try {
      const user = await firstValueFrom<SupabaseUser>(
        this.authClient.send('auth-verify-token', token),
      );

      request.user = { ...user, accessToken: token };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
