import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { ReservationService } from '../reservation/reservation.service';
import { REDIS_CHANNELS, REDIS_KEYS } from '@neticket/contracts';
import { TicketConfigService } from '../config/ticket-config.service';
import {
  TICKET_ERROR_CODES,
  TicketException,
  TraceService,
} from '@neticket/common';

@Injectable()
export class VirtualUserWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VirtualUserWorker.name);
  private isRunning = false;

  constructor(
    private readonly redisService: RedisService,
    private readonly reservationService: ReservationService,
    private readonly configService: TicketConfigService,
    private readonly traceService: TraceService,
  ) {}

  onModuleInit() {
    this.isRunning = true;
    void this.consumeLoop();
  }

  onModuleDestroy() {
    this.isRunning = false;
  }

  private async consumeLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.configService.syncAll();

        const isEnabled = this.configService.isVirtualUserEnabled();
        if (!isEnabled) {
          const { errorDelayMs } = this.configService.getVirtualConfig();
          await this.delay(errorDelayMs);
          continue;
        }

        const config = this.configService.getVirtualConfig();

        const result = await this.redisService.brpopQueueList(
          REDIS_KEYS.VIRTUAL_ACTIVE_QUEUE,
          config.brpopTimeoutSeconds,
        );

        if (!this.isRunning || !result) {
          continue;
        }

        const [, userId] = result;

        void this.traceService.runWithTraceId(
          this.traceService.generateTraceId(),
          () => this.processVirtualUser(userId, config.maxSeatPickAttempts),
        );

        if (config.processDelayMs >= 0) {
          await this.delay(config.processDelayMs);
        }
      } catch (error: unknown) {
        const wrappedError =
          error instanceof TicketException
            ? error
            : new TicketException(
                TICKET_ERROR_CODES.VIRTUAL_USER_PROCESS_FAILED,
                '가상 유저 처리 중 오류가 발생했습니다.',
                500,
              );
        this.logger.error(
          wrappedError.message,
          error instanceof Error ? error.stack : undefined,
          {
            errorCode: wrappedError.errorCode,
          },
        );
        const { errorDelayMs } = this.configService.getVirtualConfig();
        await this.delay(errorDelayMs);
      }
    }
  }

  private async processVirtualUser(
    userId: string,
    maxSeatPickAttempts: number,
  ): Promise<void> {
    const { thinkingTimeMs } = this.configService.getVirtualConfig();

    if (thinkingTimeMs > 0) {
      const jitter = Math.random() * 0.5 + 0.75;
      await this.delay(thinkingTimeMs * jitter);
    }

    const sessionId = await this.redisService.srandmember(
      REDIS_KEYS.CURRENT_TICKETING_SESSIONS,
    );
    if (!sessionId) {
      this.logger.warn('현재 티켓팅 회차가 설정되지 않음', { userId });
      await this.releaseActiveUser(userId, 'no_session');
      return;
    }

    const blockId = await this.redisService.srandmember(
      `session:${sessionId}:blocks`,
    );
    if (!blockId) {
      this.logger.warn('회차 내 블록들 정보 없음', {
        sessionId,
        userId,
      });
      await this.releaseActiveUser(userId, 'no_block');
      return;
    }

    const blockData = await this.redisService.get(`block:${blockId}`);
    if (!blockData) {
      this.logger.warn('블록 정보 조회 실패', {
        blockId,
        userId,
      });
      await this.releaseActiveUser(userId, 'no_block_data');
      return;
    }

    const { rowSize, colSize } = JSON.parse(blockData) as {
      rowSize: number;
      colSize: number;
    };

    for (let attempt = 0; attempt < maxSeatPickAttempts; attempt++) {
      const row = Math.floor(Math.random() * rowSize);
      const col = Math.floor(Math.random() * colSize);

      try {
        const seats = [{ block_id: Number(blockId), row, col }];
        await this.reservationService.reserve(
          { session_id: Number(sessionId), seats },
          userId,
          true,
        );

        const samplingRate = 0.01;
        if (Math.random() < samplingRate) {
          this.logger.log('가상 유저 예약 성공', {
            userId,
            sessionId,
            blockId,
            row,
            col,
            sampled: true,
          });
        }

        await this.handleVirtualCancellation(userId, sessionId, seats);

        return;
      } catch (error: unknown) {
        if (error instanceof TicketException) {
          if (error.errorCode === TICKET_ERROR_CODES.TICKETING_NOT_OPEN) {
            this.logger.debug('티켓팅 미오픈으로 가상 예약 건너뜀');
            await this.releaseActiveUser(userId, 'ticketing_closed');
            return;
          }
          if (error.getStatus() < 500) {
            continue;
          }
        }

        const wrappedError =
          error instanceof TicketException
            ? error
            : new TicketException(
                TICKET_ERROR_CODES.VIRTUAL_USER_PROCESS_FAILED,
                '가상 유저 예약 중 오류가 발생했습니다.',
                500,
              );
        this.logger.error(
          wrappedError.message,
          error instanceof Error ? error.stack : undefined,
          {
            errorCode: wrappedError.errorCode,
            userId,
            isVirtual: true,
          },
        );
        await this.releaseActiveUser(userId, 'unexpected_error');
        return;
      }
    }

    this.logger.warn('가상 유저 예약 실패: 재시도 한도 초과', {
      userId,
    });
    await this.releaseActiveUser(userId, 'max_attempts');
  }

  private async handleVirtualCancellation(
    userId: string,
    sessionId: string,
    seats: { block_id: number; row: number; col: number }[],
  ): Promise<void> {
    const config = this.configService.getVirtualConfig();

    // 1. 취소 여부 결정 (예: cancelRatio가 0.3이면 30% 확률로 취소)
    const shouldCancel = Math.random() < config.cancelRatio;
    if (!shouldCancel) {
      return;
    }

    // 2. 실제 유저처럼 고민 후 취소 (예: 5~10초 후)
    const cancelDelay = Math.random() * 5000 + 5000;
    await this.delay(cancelDelay);

    // 3. Redis에서 좌석 키 삭제 (취소 실행)
    const pipeline = this.redisService.pipeline();
    for (const seat of seats) {
      const seatKey = `reservation:session:${sessionId}:block:${seat.block_id}:row:${seat.row}:col:${seat.col}`;
      pipeline.del(seatKey);
    }

    await pipeline.exec();
    const samplingRate = 0.1;
    if (Math.random() < samplingRate) {
      this.logger.log('가상 유저 예약 취소(취소표 발생)', {
        userId,
        seats,
        sampled: true,
      });
    }
  }

  private async releaseActiveUser(
    userId: string,
    reason: string,
  ): Promise<void> {
    try {
      await this.redisService.publishToQueue(
        REDIS_CHANNELS.QUEUE_EVENT_DONE,
        userId,
      );
      this.logger.debug('가상 유저 활성 해제 요청', { userId, reason });
    } catch (error: unknown) {
      const wrappedError =
        error instanceof TicketException
          ? error
          : new TicketException(
              TICKET_ERROR_CODES.VIRTUAL_USER_RELEASE_FAILED,
              '가상 유저 활성 해제에 실패했습니다.',
              500,
            );
      this.logger.error(
        wrappedError.message,
        error instanceof Error ? error.stack : undefined,
        {
          errorCode: wrappedError.errorCode,
          userId,
        },
      );
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
