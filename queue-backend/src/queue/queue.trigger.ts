import { PROVIDERS, REDIS_CHANNELS } from '@beastcamp/shared-constants';
import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import Redis from 'ioredis';
import { QueueWorker } from './queue.worker';
import { QueueConfigService } from './queue-config.service';
import {
  QUEUE_ERROR_CODES,
  runWithPubSubContext,
  TraceService,
} from '@beastcamp/shared-nestjs';
import { createQueueErrorHandler } from './utils/queue-error.util';

@Injectable()
export class QueueTrigger implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueTrigger.name);
  private readonly handleError = createQueueErrorHandler(this.logger);
  private subClient: Redis;
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    @Inject(PROVIDERS.REDIS_QUEUE) private readonly redis: Redis,
    private readonly worker: QueueWorker,
    private readonly configService: QueueConfigService,
    private readonly traceService: TraceService,
  ) {}

  async onModuleInit() {
    this.isRunning = true;
    this.subClient = this.redis.duplicate();
    await this.subClient.subscribe(REDIS_CHANNELS.QUEUE_EVENT_DONE);

    this.subClient.on('message', (channel: string, message: string) => {
      if (channel === REDIS_CHANNELS.QUEUE_EVENT_DONE) {
        void runWithPubSubContext(this.traceService, message, (payload) =>
          this.handleDoneEvent(payload.userId, Boolean(payload.isVirtual)),
        );
      }
    });

    void this.traceService.runWithTraceId(
      this.traceService.generateTraceId(),
      () => this.runTransferCycle(),
    );
  }

  private scheduleNextTransfer(): void {
    if (!this.isRunning) {
      return;
    }

    const intervalSec = this.configService.worker.transferIntervalSec;
    const delayMs = intervalSec * 1000;

    this.timer = setTimeout(() => {
      void this.traceService.runWithTraceId(
        this.traceService.generateTraceId(),
        () => this.runTransferCycle(),
      );
    }, delayMs);
  }

  private async runTransferCycle(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      await this.configService.sync();
      await this.worker.processQueueTransfer();
    } catch (error) {
      this.handleError(error, QUEUE_ERROR_CODES.QUEUE_TRIGGER_FAILED);
    } finally {
      this.scheduleNextTransfer();
    }
  }

  private async handleDoneEvent(userId: string, isVirtual: boolean) {
    try {
      const samplingRate = isVirtual ? 0.01 : 1.0;
      if (Math.random() < samplingRate) {
        this.logger.log(`🔔 티켓팅 완료 수신`, {
          userId,
          isVirtual,
          sampled: isVirtual,
        });
      }
      await this.worker.removeActiveUser(userId, isVirtual);
      await this.worker.processQueueTransfer();
    } catch (err) {
      this.handleError(err, QUEUE_ERROR_CODES.QUEUE_DONE_EVENT_FAILED, {
        userId,
      });
    }
  }

  async onModuleDestroy() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.subClient?.quit();
  }
}
