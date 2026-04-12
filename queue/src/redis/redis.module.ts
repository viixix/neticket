import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PROVIDERS, CONFIG_PATHS } from '@neticket/shared-constants';
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
      provide: PROVIDERS.REDIS_TICKET,
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>(CONFIG_PATHS.REDIS_TICKET_HOST);
        const port = configService.get<number>(CONFIG_PATHS.REDIS_TICKET_PORT);
        const password = configService.get<string>(
          CONFIG_PATHS.REDIS_TICKET_PASSWORD,
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
  ],
  exports: [PROVIDERS.REDIS_QUEUE, PROVIDERS.REDIS_TICKET],
})
export class RedisModule {}
