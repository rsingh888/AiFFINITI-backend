import { Controller, Get } from '@nestjs/common';
import { MiscApiGatewayService } from './misc-api-gateway.service';

@Controller()
export class MiscApiGatewayController {
  constructor(private readonly MiscApiGatewayService: MiscApiGatewayService) {}

  @Get('all-interests')
  async getAllInterests() {
    return this.MiscApiGatewayService.getAllInterests();
  }
}
