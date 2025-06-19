import { Controller } from '@nestjs/common';
import { ConnectionRequestService } from './connection-request.service';
import { MessagePattern } from '@nestjs/microservices';
import { acceptConnectionRequestDto } from './dto/accept-connection.dto';
import { rejectConnectionRequestDto } from './dto/reject-connection.dto';

@Controller()
export class ConnectionRequestController {
  constructor(
    private readonly connectionRequestService: ConnectionRequestService,
  ) {}

  @MessagePattern({ cmd: 'like-connection-request' })
  likeConnectionRequest(payload: { userId: string }) {
    return this.connectionRequestService.likeConnectionRequest(payload.userId);
  }

  @MessagePattern({ cmd: 'aiffiniti-connection-request' })
  aiffinitiConnectionRequest(payload: { userId: string }) {
    return this.connectionRequestService.aiffinitiConnectionRequest(
      payload.userId,
    );
  }

  @MessagePattern({ cmd: 'accept-connection-request' })
  acceptConnectionRequest(payload: {
    userId: string;
    data: acceptConnectionRequestDto;
  }) {
    return this.connectionRequestService.acceptConnectionRequest(
      payload.userId,
      payload.data,
    );
  }

  @MessagePattern({ cmd: 'reject-connection-request' })
  rejectConnectionRequest(payload: {
    userId: string;
    data: rejectConnectionRequestDto;
  }) {
    return this.connectionRequestService.rejectConnectionRequest(
      payload.userId,
      payload.data,
    );
  }
}
