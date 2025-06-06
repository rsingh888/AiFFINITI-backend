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
}
