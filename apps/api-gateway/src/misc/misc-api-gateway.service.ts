import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class MiscApiGatewayService {
  constructor(@Inject('MISC_SERVICE') private miscService: ClientProxy) {}

  getAllInterests() {
    return this.miscService.send<string[]>({ cmd: 'get-all-interests' }, {});
  }

  getAllMatchingProfiles(
    userId: string,
    data: { page: number; limit: number },
  ) {
    const { page, limit } = data;
    const skip = (page - 1) * limit;
    return this.miscService.send<string>(
      { cmd: 'get-all-matching-profiles' },
      { userId, data: { skip, limit } },
    );
  }

  // showProfileView(userId: string, data: { viewedId: string }) {
  //   const { viewedId } = data;
  //   return this.miscService.send<string>(
  //     { cmd: 'show-profile-view' },
  //     { userId, data: { viewedId } },
  //   );
  // }
}
