import { NestFactory } from '@nestjs/core';
import { MicroservicePostModule } from './post.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

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
