import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { HttpModule } from '@nestjs/axios';
import { AuthService } from './auth.service';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../supabase/supabase.module';
import { DrizzleModule } from 'schema/drizzle.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    HttpModule,
    SupabaseModule,
    DrizzleModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
