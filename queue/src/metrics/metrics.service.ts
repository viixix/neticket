import { Injectable, OnModuleInit } from '@nestjs/common';
import { collectDefaultMetrics, Histogram, Gauge, Registry } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry();

  readonly httpDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP 요청 처리 시간',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.005, 0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
    registers: [this.registry],
  });

  readonly activeRequests = new Gauge({
    name: 'http_active_requests',
    help: '처리 중인 HTTP 요청 수',
    registers: [this.registry],
  });

  readonly redisCommandDuration = new Histogram({
    name: 'queue_redis_duration_seconds',
    help: 'Redis 명령어별 실행 시간',
    labelNames: ['command'],
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
    registers: [this.registry],
  });

  readonly waitingQueueLength = new Gauge({
    name: 'queue_waiting_length',
    help: '대기 중인 유저 수',
    registers: [this.registry],
  });

  readonly activeCount = new Gauge({
    name: 'queue_active_count',
    help: '활성 유저 수',
    registers: [this.registry],
  });

  onModuleInit() {
    collectDefaultMetrics({ register: this.registry });
  }
}
