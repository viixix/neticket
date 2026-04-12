import { PROVIDERS, REDIS_KEYS } from '@neticket/shared-constants';
import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { QueueConfigService } from './queue-config.service';
import { QUEUE_ERROR_CODES } from '@neticket/shared-nestjs';
import { createQueueErrorHandler } from './utils/queue-error.util';

@Injectable()
export class HeartbeatService {
  private readonly logger = new Logger(HeartbeatService.name);
  private readonly handleError = createQueueErrorHandler(this.logger);
  private readonly heartbeatCache = new Map<string, number>();

  constructor(
    @Inject(PROVIDERS.REDIS_QUEUE) private readonly redis: Redis,
    private readonly configService: QueueConfigService,
  ) {}

  async update(userId: string): Promise<void> {
    const { heartbeat } = this.configService;

    if (!heartbeat.enabled) {
      return;
    }

    const now = Date.now();
    const lastUpdate = this.heartbeatCache.get(userId);

    if (lastUpdate && now - lastUpdate < heartbeat.throttleMs) {
      return;
    }

    try {
      await this.redis.zadd(REDIS_KEYS.HEARTBEAT_QUEUE, now, userId);

      this.heartbeatCache.set(userId, now);

      if (this.heartbeatCache.size > heartbeat.cacheMaxSize) {
        this.heartbeatCache.clear();
        this.logger.debug('캐시 최대치 도달로 초기화');
      }
    } catch (error) {
      // 💡 NOTE: 하트비트 업데이트는 부수적인 작업이므로 실패가 메인 로직(조회)에 영향을 주지 않도록 함.
      // 실패 시 에러를 던지지 않고 로그만 남겨 관측성을 유지함.
      this.handleError(error, QUEUE_ERROR_CODES.QUEUE_HEARTBEAT_UPDATE_FAILED, {
        userId,
      });
    }
  }
}
