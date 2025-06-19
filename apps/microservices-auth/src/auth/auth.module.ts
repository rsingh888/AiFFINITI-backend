import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { HttpModule } from '@nestjs/axios';
import { AuthService } from './auth.service';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../supabase/supabase.module';
import { DrizzleModule } from 'schema/drizzle.module';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { BestImageModule } from './best-image/best-image.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    BestImageModule,

    ClientsModule.register([
      {
        name: 'POST_SERVICE',
        transport: Transport.TCP,
        options: {
          // host: 'https://affinity-backend-testing-1.onrender.com',
          // host: 'localhost',
          port: 3004,
        },
      },
    ]),
    HttpModule,
    SupabaseModule,
    DrizzleModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
