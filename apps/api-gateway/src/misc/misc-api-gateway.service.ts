import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class MiscApiGatewayService {
  constructor(@Inject('MISC_SERVICE') private miscService: ClientProxy) {}

  async getAllInterests() {
    const allInterest = await firstValueFrom(
      this.miscService.send<string[]>({ cmd: 'get-all-interests' }, {}),
    );

    return allInterest;
  }
}
