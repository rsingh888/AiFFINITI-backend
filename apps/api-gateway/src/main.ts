import { NestFactory } from '@nestjs/core';
import { ApiGatewayModule } from './api-gateway.module';
import * as cookieParser from 'cookie-parser';

// import { Transport } from '@nestjs/microservices';

// allowedOrigin will be set after ConfigService is available
const allowedOrigin = [
  'http://localhost:5173',
  'https://aiffiniti-frontend-testing.vercel.app',
];
async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule);
  app.enableCors({
    origin: allowedOrigin,
    credentials: true,
  });

  app.use(cookieParser());

  // app.connectMicroservice({
  //   transport: Transport.TCP,
  //   options: { port: 3001 },
  // });
  // await app.startAllMicroservices();
  await app.listen(3000);
}
bootstrap();
