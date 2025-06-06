import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

const SupabaseProvider = {
  provide: 'SUPABASE_CLIENT',
  useFactory: (configService: ConfigService): SupabaseClient => {
    const supabaseUrl = configService.get<string>('SUPABASE_URL') || '';
    const supabaseKey = configService.get<string>('SUPABASE_KEY') || '';
    return createClient(supabaseUrl, supabaseKey);
  },
  inject: [ConfigService],
};

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  providers: [SupabaseProvider],
  exports: [SupabaseProvider], // make it available outside this module
})
export class SupabaseModule {}
