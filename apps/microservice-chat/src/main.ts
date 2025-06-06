import { NestFactory } from '@nestjs/core';
import { MicroserviceChatModule } from './microservice-chat.module';

async function bootstrap() {
  const app = await NestFactory.create(MicroserviceChatModule);
  await app.listen(3003);
  console.log('Microservice Chat is running on port 3003');
}

bootstrap();
