import { Controller } from '@nestjs/common';
import { MicroserviceMiscService } from './misc.service';
import { MessagePattern } from '@nestjs/microservices';
import { showProfileView } from './dto/show-profile-view.dto';

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
  getAllMatchingProfiles(skip: number, limit: number) {
    return this.microserviceMiscService.getAllMatchingProfiles(skip, limit);
  }

  @MessagePattern({ cmd: 'show-profile-view' })
  showProfileView(payload: { userId: string; data: showProfileView }) {
    return this.microserviceMiscService.showProfileView(
      payload.userId,
      payload.data,
    );
  }
}
