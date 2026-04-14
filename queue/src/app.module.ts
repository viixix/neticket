import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from './redis/redis.module';
import { QueueModule } from './queue/queue.module';
import {
  GlobalExceptionFilter,
  jwtConfig,
  redisConfig,
  TraceMiddleware,
  TraceModule,
} from '@neticket/common';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [redisConfig, jwtConfig],
    }),
    RedisModule,
    QueueModule,
    TraceModule,
  ],
  providers: [GlobalExceptionFilter, TraceMiddleware],
})
export class AppModule {}
