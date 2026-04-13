import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  PROVIDERS,
  REDIS_CHANNELS,
  REDIS_KEYS,
} from '@neticket/shared-constants';
import Redis from 'ioredis';
import { runWithPubSubContext, TraceService } from '@neticket/shared-nestjs';

@Injectable()
export class TicketingStateService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TicketingStateService.name);

  private cachedIsOpen: boolean | undefined = undefined;

  private lastSyncAt = 0;
  private readonly CACHE_TTL = 1000;
  private refreshPromise: Promise<void> | null = null;
  private subscriber: Redis | null = null;

  constructor(
    @Inject(PROVIDERS.REDIS_CORE) private readonly coreRedis: Redis,
    private readonly traceService: TraceService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.subscriber = this.coreRedis.duplicate();
    await this.subscriber.subscribe(REDIS_CHANNELS.TICKETING_STATE_CHANGED);

    this.logger.log('티켓팅 상태 동기화 구독 시작', {
      channel: REDIS_CHANNELS.TICKETING_STATE_CHANGED,
    });

    this.subscriber.on('message', (channel: string, message: string) => {
      if (channel === REDIS_CHANNELS.TICKETING_STATE_CHANGED) {
        void runWithPubSubContext(
          this.traceService,
          message,
          async (payload) => {
            this.logger.log('티켓팅 상태 변경 알림 수신 -> 로컬 캐시 무효화', {
              receivedState: payload.userId,
            });
            this.lastSyncAt = 0;
            await this.refreshIfNeeded();
          },
        );
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }
  }

  /**
   * 상태 동기화 (내부 전용)
   * 1초가 지났을 때만 Redis에서 최신 정보를 가져옵니다.
   */
  private async refreshIfNeeded(): Promise<void> {
    const now = Date.now();

    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    if (now - this.lastSyncAt < this.CACHE_TTL) {
      return;
    }

    this.refreshPromise = (async () => {
      try {
        const isOpen = await this.coreRedis.get(REDIS_KEYS.TICKETING_OPEN);
        const newState = isOpen === 'true';

        this.logger.debug('티켓팅 상태 캐시 갱신 완료', { isOpen: newState });

        this.cachedIsOpen = newState;
        this.lastSyncAt = Date.now();
      } catch (error) {
        this.logger.error(
          '티켓팅 상태 동기화 실패',
          error instanceof Error ? error.stack : undefined,
          {
            redisKey: REDIS_KEYS.TICKETING_OPEN,
          },
        );
        this.lastSyncAt = 0;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * 티켓팅 오픈 여부 반환
   */
  async isOpen(): Promise<boolean> {
    await this.refreshIfNeeded();
    return this.cachedIsOpen ?? false;
  }
}
