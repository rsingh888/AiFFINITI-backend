import { Controller } from '@nestjs/common';
import { MicroserviceMiscService } from './misc.service';
import { MessagePattern } from '@nestjs/microservices';

@Controller()
export class MicroserviceMiscController {
  constructor(
    private readonly microserviceMiscService: MicroserviceMiscService,
  ) {}

  @MessagePattern({ cmd: 'get-all-interests' })
  getAllInterests() {
    return this.microserviceMiscService.getAllInterests();
  }

  @MessagePattern({ cmd: 'get-all-matching-profiles' })
  getAllMatchingProfiles(payload: {
    userId: string;
    data: { skip: number; limit: number };
  }) {
    return this.microserviceMiscService.getAllMatchingProfiles(
      payload.userId,
      payload.data,
    );
  }

  @MessagePattern({ cmd: 'get-posts-suggestions' })
  getPostsSuggestionsController(payload: {
    userId: string;
    data: { limit: number };
  }) {
    return this.microserviceMiscService.getPostsSuggestionsService(
      payload.userId,
      payload.data,
    );
  }

  // @MessagePattern({ cmd: 'show-profile-view' })
  // showProfileView(payload: { userId: string; data: showProfileView }) {
  //   return this.microserviceMiscService.showProfileView(
  //     payload.userId,
  //     payload.data,
  //   );
  // }
}
