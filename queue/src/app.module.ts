import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from './redis/redis.module';
import { QueueModule } from './queue/queue.module';
import { MetricsModule } from './metrics/metrics.module';
import { HttpMetricsInterceptor } from './metrics/http-metrics.interceptor';
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
    MetricsModule,
  ],
  providers: [
    GlobalExceptionFilter,
    TraceMiddleware,
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
  ],
})
export class AppModule {}
