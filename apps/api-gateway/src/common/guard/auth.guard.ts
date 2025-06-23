import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { AppUser } from '../types/userInterface';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    interface RequestWithUser {
      headers: Record<string, string | undefined>;
      user?: AppUser;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();

    const authHeader = request.headers?.authorization;

    // console.log('---> "authHeader"', authHeader);

    if (
      !authHeader ||
      (!authHeader.startsWith('Bearer ') && !authHeader.startsWith('Bearer%20'))
    ) {
      throw new UnauthorizedException('No token provided');
    }

    let token = '';

    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (authHeader.startsWith('Bearer%20')) {
      token = authHeader.split('Bearer%20')[1];
    }

    // console.log('---> "token"', token);

    try {
      const user = await firstValueFrom<AppUser>(
        this.authClient.send({ cmd: 'auth-verify-token' }, token),
      );

      request.user = { ...user };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
