import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    interface RequestWithUser {
      headers: Record<string, string | undefined>;
      user?: {
        id?: string;
        email?: string;
        phone?: string;
      };
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();

    const authHeader = request.headers?.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided');
    }

    const token = authHeader.split(' ')[1];

    try {
      interface UserPayload {
        id?: string;
        email?: string;
        phone?: string;
      }

      const user = await firstValueFrom<UserPayload>(
        this.authClient.send('auth-verify-token', token),
      );

      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
