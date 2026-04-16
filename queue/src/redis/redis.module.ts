import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PROVIDERS, CONFIG_PATHS } from '@neticket/contracts';
import { Redis } from 'ioredis';
import { REDIS_COMMANDS } from './redis.commands';

@Global()
@Module({
  providers: [
    {
      provide: PROVIDERS.REDIS_QUEUE,
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>(CONFIG_PATHS.REDIS_QUEUE_HOST);
        const port = configService.get<number>(CONFIG_PATHS.REDIS_QUEUE_PORT);
        const password = configService.get<string>(
          CONFIG_PATHS.REDIS_QUEUE_PASSWORD,
        );

        const redis = new Redis({
          host,
          port,
          password,
          retryStrategy: (times) => Math.min(times * 50, 2000),
          commandTimeout: 5000,
          connectTimeout: 10000,
          maxRetriesPerRequest: 2,
        });

        redis.defineCommand(REDIS_COMMANDS.SYNC_AND_PROMOTE_WAITERS.name, {
          numberOfKeys: REDIS_COMMANDS.SYNC_AND_PROMOTE_WAITERS.numberOfKeys,
          lua: REDIS_COMMANDS.SYNC_AND_PROMOTE_WAITERS.lua,
        });

        return redis;
      },
      inject: [ConfigService],
    },
    {
      provide: PROVIDERS.REDIS_CORE,
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>(CONFIG_PATHS.REDIS_CORE_HOST);
        const port = configService.get<number>(CONFIG_PATHS.REDIS_CORE_PORT);
        const password = configService.get<string>(
          CONFIG_PATHS.REDIS_CORE_PASSWORD,
        );

        return new Redis({
          host,
          port,
          password,
          retryStrategy: (times) => Math.min(times * 50, 2000),
          commandTimeout: 5000,
          connectTimeout: 10000,
          maxRetriesPerRequest: 2,
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [PROVIDERS.REDIS_QUEUE, PROVIDERS.REDIS_CORE],
})
export class RedisModule {}
