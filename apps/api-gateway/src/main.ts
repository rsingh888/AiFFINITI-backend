import { NestFactory } from '@nestjs/core';
import { ApiGatewayModule } from './api-gateway.module';
import * as cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';

const allowedOrigin = [
  'http://localhost:4000',
  'https://aiffiniti-frontend-testing.vercel.app',
];

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule);

  app.enableCors({
    origin: allowedOrigin,
    credentials: true,
  });

  app.use(cookieParser());

  // validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(3000);
  console.log('API Gateway is running on port 3000');
}

bootstrap();
