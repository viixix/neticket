import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { ChainableCommander, Redis } from 'ioredis';
import { DynamicConfigManager } from '@beastcamp/shared-nestjs';
import { PROVIDERS, REDIS_KEYS } from '@beastcamp/shared-constants';
import { QUEUE_ERROR_CODES } from '@beastcamp/shared-nestjs';
import { createQueueErrorHandler } from './utils/queue-error.util';

@Injectable()
export class QueueConfigService implements OnModuleInit {
  private readonly logger = new Logger(QueueConfigService.name);
  private readonly handleError = createQueueErrorHandler(this.logger);
  private readonly manager: DynamicConfigManager;

  constructor(@Inject(PROVIDERS.REDIS_QUEUE) private readonly redis: Redis) {
    this.manager = new DynamicConfigManager(
      this.redis,
      REDIS_KEYS.CONFIG_QUEUE,
    );
  }

  async onModuleInit() {
    try {
      await this.seedConfig();
      await this.manager.refresh(true);
      this.logger.log('Queue Dynamic Config 초기화 완료');
    } catch (error) {
      this.logger.error(
        'Queue Dynamic Config 초기화 실패',
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async sync() {
    try {
      await this.manager.refresh();
      this.logger.debug('Queue Dynamic Config 동기화 완료');
    } catch (error) {
      this.logger.error(
        'Queue Dynamic Config 동기화 실패',
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private async seedConfig() {
    const env = process.env;
    const pipeline = this.redis.pipeline();

    /* eslint-disable prettier/prettier */
    const workerMap: Record<string, [string | undefined, string]> = {
      'worker.max_capacity': [env.QUEUE_MAX_CAPACITY, '10'],
      'worker.heartbeat_timeout_ms': [env.QUEUE_HEARTBEAT_TIMEOUT_MS, '60000'],
      'worker.active_ttl_ms': [env.QUEUE_ACTIVE_TTL_MS, '60000'],
      'worker.transfer_interval_sec': [env.QUEUE_SCHEDULE_TRANSFER_INTERVAL_SEC, '3',],
    };

    const heartbeatMap: Record<string, [string | undefined, string]> = {
      'heartbeat.enabled': [env.QUEUE_HEARTBEAT_ENABLED, 'true'],
      'heartbeat.throttle_ms': [env.QUEUE_HEARTBEAT_THROTTLE_MS, '1000'],
      'heartbeat.cache_max_size': [env.QUEUE_HEARTBEAT_CACHE_MAX_SIZE, '150000'],
    };

    const virtualMap: Record<string, [string | undefined, string]> = {
      'virtual.enabled': [env.QUEUE_VIRTUAL_ENABLED, 'false'],
      'virtual.target_total': [env.QUEUE_VIRTUAL_TARGET_TOTAL, '100'],
      'virtual.initial_jump_ratio': [env.QUEUE_VIRTUAL_INITIAL_JUMP_RATIO, '0.3'],
      'virtual.burst_duration_sec': [env.QUEUE_VIRTUAL_BURST_DURATION_SEC, '30'],
      'virtual.inject_batch_size': [env.QUEUE_VIRTUAL_INJECT_BATCH_SIZE, '10'],
      'virtual.inject_batch_delay_ms': [env.QUEUE_VIRTUAL_INJECT_BATCH_DELAY_MS, '1000'],
      'virtual.tick_interval_ms': [env.QUEUE_VIRTUAL_TICK_INTERVAL_MS, '1000'],
    };

    this.applySeed(pipeline, REDIS_KEYS.CONFIG_QUEUE, {
      ...workerMap,
      ...heartbeatMap,
      ...virtualMap,
    });
    

    try {
      const results = await pipeline.exec();

      const firstError = results?.find(([err]) => err)?.[0];
      if (firstError) {
        throw firstError instanceof Error ? firstError : new Error(String(firstError));
      }

      this.logger.log('Queue Config 시딩 성공');
    } catch (error) {
      throw this.handleError(error, QUEUE_ERROR_CODES.QUEUE_CONFIG_SEED_FAILED, {
        redisKey: REDIS_KEYS.CONFIG_QUEUE,
        isSystem: true,
      });
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

  get worker() {
    return {
      maxCapacity: this.manager.getNumber('worker.max_capacity', 10, { min: 1 }),
      heartbeatTimeoutMs: this.manager.getNumber('worker.heartbeat_timeout_ms', 60000, { min: 1000 }),
      activeTTLMs: this.manager.getNumber('worker.active_ttl_ms', 60000, { min: 1000 }),
      transferIntervalSec: this.manager.getNumber('worker.transfer_interval_sec', 3, { min: 1 }),
    };
  }

  get heartbeat() {
    return {
      enabled: this.manager.getBoolean('heartbeat.enabled', true),
      throttleMs: this.manager.getNumber('heartbeat.throttle_ms', 1000, { min: 0 }),
      cacheMaxSize: this.manager.getNumber('heartbeat.cache_max_size', 150000, { min: 1 }),
    };
  }

  get virtual() {
    return {
      enabled: this.manager.getBoolean('virtual.enabled', false),
      targetTotal: this.manager.getNumber('virtual.target_total', 100, { min: 0 }),
      initialJumpRatio: this.manager.getNumber('virtual.initial_jump_ratio', 0.3, { min: 0, max: 1 }),
      burstDurationSec: this.manager.getNumber('virtual.burst_duration_sec', 30, { min: 1 }),
      injectBatchSize: this.manager.getNumber('virtual.inject_batch_size', 10, { min: 1 }),
      injectBatchDelayMs: this.manager.getNumber('virtual.inject_batch_delay_ms', 1000, { min: 0 }),
      tickIntervalMs: this.manager.getNumber('virtual.tick_interval_ms', 1000, { min: 100 }),
    };
  }
  /* eslint-enable prettier/prettier */
}
