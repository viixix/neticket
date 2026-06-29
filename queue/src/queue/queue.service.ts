import { Inject, Injectable, Logger } from '@nestjs/common';
import { PROVIDERS, REDIS_KEYS, REDIS_KEY_PREFIXES } from '@neticket/contracts';
import { Redis } from 'ioredis';
import { randomBytes } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { QueueEntryResponse, QueueStatusResponse } from '@neticket/contracts';
import { HeartbeatService } from './heartbeat.service';
import { VirtualUserInjector } from './virtual-user.injector';
import { QueueConfigService } from './queue-config.service';
import { TicketingStateService } from './ticketing-state.service';
import { QUEUE_ERROR_CODES, QueueException } from '@neticket/common';
import { createQueueErrorHandler } from './utils/queue-error.util';
import { MetricsService } from '../metrics/metrics.service';

interface RedisWithCommands extends Redis {
  registerAndGetPosition(
    waitingQueue: string,
    heartbeatQueue: string,
    score: number,
    userId: string,
  ): Promise<number>;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private readonly handleError = createQueueErrorHandler(this.logger);
  private hasTriggeredInjection = false;

  constructor(
    @Inject(PROVIDERS.REDIS_QUEUE) private readonly redis: RedisWithCommands,
    private readonly jwtService: JwtService,
    private readonly heartbeatService: HeartbeatService,
    private readonly virtualUserInjector: VirtualUserInjector,
    private readonly configService: QueueConfigService,
    private readonly ticketingStateService: TicketingStateService,
    private readonly metricsService: MetricsService,
  ) {}

  async createEntry(userId?: string): Promise<QueueEntryResponse> {
    try {
      if (userId) {
        const position = await this.getPosition(userId);
        if (position !== null) {
          return { userId, position };
        }
      }

      await this.validateTicketingOpen();

      const newUserId = this.generateUserId();
      const newUserPos = await this.registerAndGetPosition(newUserId);

      if (newUserPos === 1) {
        this.hasTriggeredInjection = false;
      }
      void this.ensureVirtualInjectionStarted();

      return { userId: newUserId, position: newUserPos };
    } catch (e) {
      if (e instanceof QueueException) throw e;
      throw new QueueException(
        QUEUE_ERROR_CODES.QUEUE_REDIS_UNAVAILABLE,
        '대기열 서비스를 일시적으로 사용할 수 없습니다.',
        503,
      );
    }
  }

  async getStatus(userId: string | undefined): Promise<QueueStatusResponse> {
    try {
      const isOpen = await this.ticketingStateService.isOpen();
      const status = isOpen ? 'open' : 'closed';

      if (!userId) {
        return { position: null, status };
      }

      const isActive = await this.checkActiveStatus(userId);
      if (isActive) {
        const token = await this.generateAccessToken(userId);
        return { token, position: 0, status };
      }

      const position = await this.getPosition(userId);

      if (position !== null) {
        await this.updateHeartbeat(userId);
      }

      return { position, status };
    } catch (e) {
      if (e instanceof QueueException) throw e;
      throw new QueueException(
        QUEUE_ERROR_CODES.QUEUE_REDIS_UNAVAILABLE,
        '대기열 서비스를 일시적으로 사용할 수 없습니다.',
        503,
      );
    }
  }

  private generateUserId = () => randomBytes(12).toString('base64url');

  private async getPosition(userId: string) {
    const end = this.metricsService.redisCommandDuration.startTimer({
      command: 'zrank',
    });
    const rank = await this.redis.zrank(REDIS_KEYS.WAITING_QUEUE, userId);
    end();
    if (rank === null) {
      return null;
    }
    return rank + 1;
  }

  private async registerAndGetPosition(userId: string): Promise<number> {
    const end = this.metricsService.redisCommandDuration.startTimer({
      command: 'lua_register',
    });
    const rank = await this.redis.registerAndGetPosition(
      REDIS_KEYS.WAITING_QUEUE,
      REDIS_KEYS.HEARTBEAT_QUEUE,
      Date.now(),
      userId,
    );
    end();
    return rank + 1;
  }

  private async ensureVirtualInjectionStarted() {
    if (this.hasTriggeredInjection) {
      return;
    }

    try {
      await this.configService.sync();
      if (!this.configService.virtual.enabled) {
        return;
      }

      const lockKey = REDIS_KEYS.INJECTION_LOCK;
      const acquired = await this.redis.set(lockKey, 'OK', 'EX', 86400, 'NX');

      if (acquired === 'OK') {
        this.logger.log('🚀 가상 유저 주입 프로세스 시작');
        try {
          await this.virtualUserInjector.start();
        } catch (error) {
          await this.redis.del(lockKey);
          this.handleError(
            error,
            QUEUE_ERROR_CODES.QUEUE_INJECTION_START_FAILED,
            { lockKey },
          );
          return;
        }
      }
      this.hasTriggeredInjection = true;
    } catch (error) {
      this.logger.error(
        '가상 유저 주입 준비 중 오류가 발생했습니다.',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async checkActiveStatus(userId: string) {
    const exists = await this.redis.exists(
      `${REDIS_KEY_PREFIXES.ACTIVE_USER}${userId}`,
    );
    return exists > 0;
  }

  private generateAccessToken = async (userId: string) => {
    const sessionIdStrs = await this.redis.smembers(
      REDIS_KEYS.CURRENT_TICKETING_SESSIONS,
    );
    const sessionIds = sessionIdStrs.map(Number);
    return this.jwtService.signAsync({
      sub: userId,
      type: 'TICKETING',
      sessionIds,
    });
  };

  private updateHeartbeat = (userId: string) =>
    this.heartbeatService.update(userId);

  private async validateTicketingOpen(): Promise<void> {
    const isOpen = await this.ticketingStateService.isOpen();
    if (!isOpen) {
      throw new QueueException(
        QUEUE_ERROR_CODES.QUEUE_TICKETING_NOT_OPEN,
        '티켓팅이 진행 중이 아닙니다.',
        403,
      );
    }
  }
}
