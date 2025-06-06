import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { MicroserviceMiscModule } from './misc.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    MicroserviceMiscModule,
    {
      transport: Transport.TCP,
      options: {
        port: 3002,
      },
    },
  );

  await app.listen();
  console.log('Misc Service is running on port 3002');
}
bootstrap();
