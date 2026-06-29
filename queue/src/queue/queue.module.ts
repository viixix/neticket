import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { QueueConfigService } from './queue-config.service';
import { QueueController } from './queue.controller';
import { QueueWorker } from './queue.worker';
import { QueueTrigger } from './queue.trigger';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { JwtSignOptions } from '@nestjs/jwt';
import { HeartbeatService } from './heartbeat.service';
import { VirtualUserInjector } from './virtual-user.injector';
import { TicketingStateService } from './ticketing-state.service';
import { TraceModule } from '@neticket/common';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [
    TraceModule,
    MetricsModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('jwt.secret');
        const expiresIn =
          configService.get<JwtSignOptions['expiresIn']>('jwt.expiresIn');

        if (!secret || !expiresIn) {
          throw new Error(
            'JWT_SECRET or JWT_EXPIRES_IN가 설정되지 않았습니다.',
          );
        }

        return {
          secret,
          signOptions: { expiresIn },
        };
      },
    }),
  ],
  providers: [
    QueueService,
    QueueConfigService,
    QueueWorker,
    QueueTrigger,
    HeartbeatService,
    VirtualUserInjector,
    TicketingStateService,
  ],
  controllers: [QueueController],
})
export class QueueModule {}
