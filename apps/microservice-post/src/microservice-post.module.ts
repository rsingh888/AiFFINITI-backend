import { Module } from '@nestjs/common';
import { PostModule } from './post/post.module';
import { ConnectionRequestModule } from './connection-request/connection-request.module';

@Module({
  imports: [PostModule, ConnectionRequestModule],
})
export class MicroservicePostModule {}
