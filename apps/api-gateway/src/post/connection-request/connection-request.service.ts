import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { acceptConnectionRequestDto } from './dto/accept-request.dto';
import { rejectConnectionRequestDto } from './dto/reject-request.dto';
// import { CreatePostDto } from './dto/create-post.dto';

@Injectable()
export class ConnectionRequestService {
  constructor(
    @Inject('CONNECTION_SERVICE') private connectionService: ClientProxy,
  ) {}

  likeConnectionRequest(userId: string) {
    return this.connectionService.send(
      { cmd: 'like-connection-request' },
      { userId },
    );
  }

  aiffinitiConnectionRequest(userId: string) {
    return this.connectionService.send(
      { cmd: 'aiffiniti-connection-request' },
      { userId },
    );
  }

  acceptConnectionRequest(userId: string, data: acceptConnectionRequestDto) {
    const { requesterId, type } = data;
    return this.connectionService.send<{
      isSuccess: boolean;
      message: string;
      data?: {
        requesterId: string;
        receiverId: string;
        type: string;
        status: string;
      };
    }>(
      { cmd: 'accept-connection-request' },
      {
        userId,
        data: {
          requesterId,
          type,
        },
      },
    );
  }

  rejectConnectionRequest(userId: string, data: rejectConnectionRequestDto) {
    const { requesterId, type } = data;
    return this.connectionService.send(
      { cmd: 'reject-connection-request' },
      {
        userId,
        data: {
          requesterId,
          type,
        },
      },
    );
  }
}
