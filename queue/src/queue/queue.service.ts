import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  PROVIDERS,
  REDIS_KEYS,
  REDIS_KEY_PREFIXES,
} from '@neticket/shared-constants';
import { Redis } from 'ioredis';
import { randomBytes } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import {
  QueueEntryResponse,
  QueueStatusResponse,
} from '@neticket/shared-types';
import { HeartbeatService } from './heartbeat.service';
import { VirtualUserInjector } from './virtual-user.injector';
import { QueueConfigService } from './queue-config.service';
import { TicketingStateService } from './ticketing-state.service';
import { QUEUE_ERROR_CODES, QueueException } from '@neticket/shared-nestjs';
import { createQueueErrorHandler } from './utils/queue-error.util';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private readonly handleError = createQueueErrorHandler(this.logger);
  private hasTriggeredInjection = false;

  constructor(
    @Inject(PROVIDERS.REDIS_QUEUE) private readonly redis: Redis,
    private readonly jwtService: JwtService,
    private readonly heartbeatService: HeartbeatService,
    private readonly virtualUserInjector: VirtualUserInjector,
    private readonly configService: QueueConfigService,
    private readonly ticketingStateService: TicketingStateService,
  ) {}

  /**
   * [Public] 대기열 진입
   * - 기존 유저인지 확인 후, 아니면 신규 생성 및 하트비트 초기화
   */
  async createEntry(userId?: string): Promise<QueueEntryResponse> {
    // 1. 기존 유저 확인
    if (userId) {
      const position = await this.getPosition(userId);
      if (position) {
        return { userId, position };
      }
    }

    await this.validateTicketingOpen();

    const newUserId = this.generateUserId();
    await this.registerUser(newUserId);

    const newUserPos = await this.getPosition(newUserId);

    if (newUserPos === 1) {
      this.hasTriggeredInjection = false;
    }
    void this.ensureVirtualInjectionStarted();

    return {
      userId: newUserId,
      position: newUserPos,
    };
  }

  /**
   * [Public] 상태 확인 및 토큰 발행
   */
  async getStatus(userId: string | undefined): Promise<QueueStatusResponse> {
    const isOpen = await this.ticketingStateService.isOpen();

    const status = isOpen ? 'open' : 'closed';

    if (!userId) {
      return { position: null, status };
    }

    // 1. 활성 상태 확인
    const isActive = await this.checkActiveStatus(userId);
    if (isActive) {
      const token = await this.generateAccessToken(userId);
      return { token, position: 0, status };
    }

    // 2. 대기 순번 확인
    const position = await this.getPosition(userId);

    // 3. 대기 중인 유저라면 하트비트 갱신
    if (position !== null) {
      await this.updateHeartbeat(userId);
    }

    return { position, status };
  }

  // [Private] 세부 구현

  private generateUserId = () => randomBytes(12).toString('base64url');

  private async getPosition(userId: string) {
    const rank = await this.redis.zrank(REDIS_KEYS.WAITING_QUEUE, userId);
    if (rank === null) {
      return null;
    }
    return rank + 1;
  }

  private async registerUser(userId: string) {
    const score = Date.now();
    await this.redis
      .multi()
      .zadd(REDIS_KEYS.WAITING_QUEUE, 'NX', score, userId)
      .zadd(REDIS_KEYS.HEARTBEAT_QUEUE, 'NX', score, userId)
      .exec();
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

      const lockKey = 'queue:started:ticketing';
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
    return this.jwtService.signAsync({ sub: userId, type: 'TICKETING' });
  };

  private updateHeartbeat = async (userId: string) =>
    await this.heartbeatService.update(userId);

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
