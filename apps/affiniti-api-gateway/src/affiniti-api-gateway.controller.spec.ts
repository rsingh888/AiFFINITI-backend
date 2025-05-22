import { Test, TestingModule } from '@nestjs/testing';
import { AffinitiApiGatewayController } from './affiniti-api-gateway.controller';
import { AffinitiApiGatewayService } from './affiniti-api-gateway.service';

describe('AffinitiApiGatewayController', () => {
  let affinitiApiGatewayController: AffinitiApiGatewayController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AffinitiApiGatewayController],
      providers: [AffinitiApiGatewayService],
    }).compile();

    affinitiApiGatewayController = app.get<AffinitiApiGatewayController>(
      AffinitiApiGatewayController,
    );
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(affinitiApiGatewayController.getHello()).toBe('Hello World!');
    });
  });
});
