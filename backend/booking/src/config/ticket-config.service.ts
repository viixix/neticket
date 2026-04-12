import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DynamicConfigManager } from '@neticket/shared-nestjs';
import { PROVIDERS, REDIS_KEYS } from '@neticket/shared-constants';
import { ChainableCommander, Redis } from 'ioredis';

@Injectable()
export class TicketConfigService implements OnModuleInit {
  private readonly logger = new Logger(TicketConfigService.name);
  private readonly ticketManager: DynamicConfigManager;
  private readonly queueManager: DynamicConfigManager;

  constructor(
    @Inject(PROVIDERS.REDIS_TICKET) private readonly ticketRedis: Redis,
    @Inject(PROVIDERS.REDIS_QUEUE) private readonly queueRedis: Redis,
  ) {
    this.ticketManager = new DynamicConfigManager(
      this.ticketRedis,
      REDIS_KEYS.CONFIG_TICKET,
    );
    this.queueManager = new DynamicConfigManager(
      this.queueRedis,
      REDIS_KEYS.CONFIG_QUEUE,
    );
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.seedTicketConfig();
      await this.syncAll();
      this.logger.log('Ticket/Queue Dynamic Config 초기화 완료');
    } catch (error) {
      this.logger.error(
        'Dynamic Config 초기화 실패',
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async syncAll(): Promise<void> {
    try {
      await Promise.all([
        this.ticketManager.refresh(),
        this.queueManager.refresh(),
      ]);
      this.logger.debug('Dynamic Config 동기화 성공');
    } catch (error) {
      this.logger.error(
        'Dynamic Config 동기화 실패',
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  isVirtualUserEnabled(): boolean {
    return this.queueManager.getBoolean('virtual.enabled', false);
  }

  getVirtualConfig(): {
    brpopTimeoutSeconds: number;
    maxSeatPickAttempts: number;
    errorDelayMs: number;
    processDelayMs: number;
    thinkingTimeMs: number;
    cancelRatio: number;
  } {
    /* eslint-disable prettier/prettier */
    const brpopTimeoutSeconds = this.ticketManager.getNumber('virtual.brpop_timeout_sec', 2, { min: 1 });
    const maxSeatPickAttempts = this.ticketManager.getNumber('virtual.max_seat_attempts', 10, { min: 1 });
    const errorDelayMs = this.ticketManager.getNumber('virtual.error_delay_ms', 500, { min: 0 });
    const processDelayMs = this.ticketManager.getNumber('virtual.process_delay_ms', 1000, { min: 0 });
    const thinkingTimeMs = this.ticketManager.getNumber('virtual.thinking_time_ms', 2000, { min: 0 });
    const cancelRatio = this.ticketManager.getNumber('virtual.cancel_ratio', 0.1, { min: 0, max: 1 });
    /* eslint-enable prettier/prettier */

    return {
      brpopTimeoutSeconds,
      maxSeatPickAttempts,
      errorDelayMs,
      processDelayMs,
      thinkingTimeMs,
      cancelRatio,
    };
  }

  private async seedTicketConfig(): Promise<void> {
    const env = process.env;
    const pipeline = this.ticketRedis.pipeline();

    this.applySeed(pipeline, REDIS_KEYS.CONFIG_TICKET, {
      'virtual.brpop_timeout_sec': [env.TICKET_VIRTUAL_BRPOP_TIMEOUT_SEC, '2'],
      'virtual.max_seat_attempts': [env.TICKET_VIRTUAL_MAX_SEAT_ATTEMPTS, '10'],
      'virtual.error_delay_ms': [env.TICKET_VIRTUAL_ERROR_DELAY_MS, '500'],
      'virtual.process_delay_ms': [env.TICKET_VIRTUAL_PROCESS_DELAY_MS, '1000'],
      'virtual.thinking_time_ms': [env.TICKET_VIRTUAL_THINKING_TIME_MS, '2000'],
      'virtual.cancel_ratio': [env.TICKET_VIRTUAL_CANCEL_RATIO, '0.1'],
    });

    try {
      await pipeline.exec();
      this.logger.debug('Ticket 설정 시드 주입 완료');
    } catch (error) {
      this.logger.error(
        'Ticket 설정 시드 주입 실패',
        error instanceof Error ? error.stack : undefined,
        {
          redisKey: REDIS_KEYS.CONFIG_TICKET,
        },
      );
      throw error;
    }
  }

  private applySeed(
    pipeline: ChainableCommander,
    key: string,
    config: Record<string, [string | undefined, string]>,
  ) {
    for (const [field, [envValue, defaultValue]] of Object.entries(config)) {
      if (envValue !== undefined && envValue !== '') {
        pipeline.hset(key, field, envValue);
      } else {
        pipeline.hsetnx(key, field, defaultValue);
      }
    }
  }
}
