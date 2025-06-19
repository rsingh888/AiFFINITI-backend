import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { MicroservicePostModule } from './microservice-post.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    MicroservicePostModule,
    {
      transport: Transport.TCP,
      options: {
        port: 3004,
      },
    },
  );

  await app.listen();
  console.log('Post Micro Service is running on port 3004');
}
bootstrap();
