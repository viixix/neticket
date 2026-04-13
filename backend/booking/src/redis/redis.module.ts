import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PROVIDERS, CONFIG_PATHS } from '@neticket/shared-constants';
import { Redis } from 'ioredis';
import { RedisService } from './redis.service';
import { REDIS_COMMANDS } from './redis.commands';

@Global()
@Module({
  providers: [
    {
      provide: PROVIDERS.REDIS_CORE,
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>(CONFIG_PATHS.REDIS_CORE_HOST);
        const port = configService.get<number>(CONFIG_PATHS.REDIS_CORE_PORT);
        const password = configService.get<string>(
          CONFIG_PATHS.REDIS_CORE_PASSWORD,
        );

        const redis = new Redis({
          host,
          port,
          password,
          retryStrategy: (times) => Math.min(times * 50, 2000),
        });

        redis.defineCommand(REDIS_COMMANDS.ATOMIC_RESERVATION.name, {
          lua: REDIS_COMMANDS.ATOMIC_RESERVATION.lua,
        });

        return redis;
      },
      inject: [ConfigService],
    },
    {
      provide: PROVIDERS.REDIS_QUEUE,
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>(CONFIG_PATHS.REDIS_QUEUE_HOST);
        const port = configService.get<number>(CONFIG_PATHS.REDIS_QUEUE_PORT);
        const password = configService.get<string>(
          CONFIG_PATHS.REDIS_QUEUE_PASSWORD,
        );

        return new Redis({
          host,
          port,
          password,
          retryStrategy: (times) => Math.min(times * 50, 2000),
        });
      },
      inject: [ConfigService],
    },
    RedisService,
  ],
  exports: [PROVIDERS.REDIS_CORE, PROVIDERS.REDIS_QUEUE, RedisService],
})
export class RedisModule {}
