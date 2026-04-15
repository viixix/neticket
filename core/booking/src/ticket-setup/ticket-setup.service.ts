import { Injectable, Logger } from '@nestjs/common';
import { REDIS_CHANNELS, REDIS_KEYS } from '@neticket/contracts';
import {
  TICKET_ERROR_CODES,
  TicketException,
  TraceService,
} from '@neticket/common';
import {
  PerformanceApiService,
  SessionResponse,
} from '../performance-api/performance-api.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class TicketSetupService {
  private readonly logger = new Logger(TicketSetupService.name);

  constructor(
    private readonly performanceApi: PerformanceApiService,
    private readonly redisService: RedisService,
    private readonly traceService: TraceService,
  ) {}

  async setup(): Promise<void> {
    await this.redisService.deleteAllExceptPrefix('config:');
    await this.redisService.deleteAllExceptPrefixQueue('config:');

    const performances = await this.performanceApi.getPerformances(1);
    if (performances.length === 0) {
      throw new TicketException(
        TICKET_ERROR_CODES.NO_PERFORMANCES_FOUND,
        '공연 정보가 존재하지 않습니다.',
        404,
      );
    }
    const performanceId = performances[0].performance_id;
    this.logger.log('티켓팅 셋업 진행 중', { performanceId });

    const sessions = await this.performanceApi.getSessions(performanceId);
    if (sessions.length === 0) {
      throw new TicketException(
        TICKET_ERROR_CODES.NO_SESSIONS_FOUND,
        '해당 공연에 해당하는 회차가 없습니다.',
        404,
      );
    }

    const sessionIds = sessions.map((session) => session.id.toString());
    await this.redisService.sadd(
      REDIS_KEYS.CURRENT_TICKETING_SESSIONS,
      ...sessionIds,
    );
    await this.redisService.saddQueue(
      REDIS_KEYS.CURRENT_TICKETING_SESSIONS,
      ...sessionIds,
    );

    await this.redisService.publishToQueue(
      REDIS_CHANNELS.TICKETING_STATE_CHANGED,
      'setup',
    );

    const registTasks = sessions.map((session) => this.registToRedis(session));

    await Promise.all(registTasks);
    this.logger.log('티켓팅 셋업 완료', { performanceId });
  }

  async openTicketing(): Promise<void> {
    try {
      await this.redisService.set(REDIS_KEYS.TICKETING_OPEN, 'true');
      await this.redisService.setQueue(REDIS_KEYS.TICKETING_OPEN, 'true');
      this.logger.log('티켓팅 상태 변경: OPEN');

      const payload = JSON.stringify({
        userId: 'open',
        traceId: this.traceService.getOrCreateTraceId(),
      });

      void this.redisService
        .publishToQueue(REDIS_CHANNELS.TICKETING_STATE_CHANGED, payload)
        .catch((e) => {
          this.logger.warn('오픈 이벤트 발행 실패', (e as Error).stack);
        });
    } catch (e) {
      const err = e as Error;
      this.logger.error('티켓팅 오픈 처리 실패', err.stack);
      const rollbackResults = await Promise.allSettled([
        this.redisService.set(REDIS_KEYS.TICKETING_OPEN, 'false'),
        this.redisService.setQueue(REDIS_KEYS.TICKETING_OPEN, 'false'),
      ]);
      const labels = ['core', 'queue'] as const;
      for (const [i, r] of rollbackResults.entries()) {
        if (r.status === 'rejected' && r.reason instanceof Error) {
          this.logger.warn(
            `오픈 실패 후 롤백 처리 실패 (${labels[i]})`,
            r.reason.stack,
          );
        }
      }
    }
  }

  async tearDown(): Promise<void> {
    try {
      await this.redisService.set(REDIS_KEYS.TICKETING_OPEN, 'false');
      await this.redisService.setQueue(REDIS_KEYS.TICKETING_OPEN, 'false');
      await this.redisService.del(REDIS_KEYS.CURRENT_TICKETING_SESSIONS);
      await this.redisService.delQueue(REDIS_KEYS.CURRENT_TICKETING_SESSIONS);
      await this.redisService.deleteAllExceptPrefix('config:');
      await this.redisService.deleteAllExceptPrefixQueue('config:');
      this.logger.log('티켓팅 종료 및 자원 정리 완료 (Tear-down)');

      const payload = JSON.stringify({
        userId: 'close',
        traceId: this.traceService.getOrCreateTraceId(),
      });

      void this.redisService
        .publishToQueue(REDIS_CHANNELS.TICKETING_STATE_CHANGED, payload)
        .catch((e) => {
          this.logger.warn('종료 이벤트 발행 실패', (e as Error).stack);
        });
    } catch (e) {
      this.logger.error('티켓팅 종료 처리(Tear-down) 실패', (e as Error).stack);
      throw e;
    }
  }

  private async registToRedis(session: SessionResponse): Promise<void> {
    const venue = await this.performanceApi.getVenueWithBlocks(session.venueId);
    if (venue.blocks.length === 0) {
      throw new TicketException(
        TICKET_ERROR_CODES.NO_BLOCKS_FOUND,
        '공연장의 블록 정보가 존재하지 않습니다.',
        404,
      );
    }

    const blockIds = venue.blocks.map((b) => b.id);
    await this.redisService.sadd(
      `session:${session.id}:blocks`,
      ...blockIds.map(String),
    );

    const blockTasks = venue.blocks.map((block) => {
      const data = JSON.stringify({
        rowSize: block.rowSize,
        colSize: block.colSize,
      });
      return this.redisService.set(`block:${block.id}`, data);
    });

    await Promise.all(blockTasks);
  }
}
