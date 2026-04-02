import { Injectable, Inject, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import {
  REDIS_KEYS,
  PROVIDERS,
  REDIS_KEY_PREFIXES,
} from '@beastcamp/shared-constants';
import { QueueConfigService } from './queue-config.service';
import { QUEUE_ERROR_CODES } from '@beastcamp/shared-nestjs';
import { createQueueErrorHandler } from './utils/queue-error.util';

interface RedisWithCommands extends Redis {
  syncAndPromoteWaiters(
    waitQ: string,
    activeQ: string,
    heartbeatQ: string,
    virtualActiveQ: string,
    maxCapacity: number,
    now: number,
    heartbeatTimeoutMs: number,
    activeTTLMs: number,
    activeUserPrefix: string,
    heartbeatEnabled: boolean,
  ): Promise<string[]>;
}

@Injectable()
export class QueueWorker {
  private readonly logger = new Logger(QueueWorker.name);
  private readonly handleError = createQueueErrorHandler(this.logger);
  private isProcessing = false;

  constructor(
    @Inject(PROVIDERS.REDIS_QUEUE) private readonly redis: RedisWithCommands,
    private readonly configService: QueueConfigService,
  ) {}

  async processQueueTransfer() {
    if (this.isProcessing) {
      this.logger.debug('🚫 이미 활성 큐 처리 중');
      return;
    }

    this.isProcessing = true;

    try {
      const { worker, heartbeat } = this.configService;

      const movedUsers = await this.redis.syncAndPromoteWaiters(
        REDIS_KEYS.WAITING_QUEUE,
        REDIS_KEYS.ACTIVE_QUEUE,
        REDIS_KEYS.HEARTBEAT_QUEUE,
        REDIS_KEYS.VIRTUAL_ACTIVE_QUEUE,
        worker.maxCapacity,
        Date.now(),
        worker.heartbeatTimeoutMs,
        worker.activeTTLMs,
        REDIS_KEY_PREFIXES.ACTIVE_USER,
        heartbeat.enabled,
      );

      if (movedUsers.length > 0) {
        this.logger.debug('🚀 유저 활성 큐 이동 완료', {
          count: movedUsers.length,
          userIds: movedUsers,
        });
      }
    } catch (error) {
      this.handleError(error, QUEUE_ERROR_CODES.QUEUE_TRANSFER_FAILED);
    } finally {
      this.isProcessing = false;
    }
  }

  async removeActiveUser(userId: string, isVirtual: boolean) {
    if (!userId) {
      return;
    }

    const statusKey = `${REDIS_KEY_PREFIXES.ACTIVE_USER}${userId}`;
    try {
      const results = await this.redis
        .pipeline()
        .zrem(REDIS_KEYS.ACTIVE_QUEUE, userId)
        .del(statusKey)
        .exec();

      const removed = (results?.[0]?.[1] as number) ?? 0;
      if (removed > 0) {
        const samplingRate = isVirtual ? 0.01 : 1.0;
        if (Math.random() < samplingRate) {
          this.logger.log('🛑 유저 퇴장 완료', {
            userId,
            isVirtual,
            sampled: isVirtual,
          });
        }
      }
    } catch (error) {
      this.handleError(error, QUEUE_ERROR_CODES.QUEUE_REMOVE_ACTIVE_FAILED, {
        userId,
      });
    }
  }
}
