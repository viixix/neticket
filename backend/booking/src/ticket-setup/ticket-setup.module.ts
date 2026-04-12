import { Module } from '@nestjs/common';
import { PerformanceApiModule } from '../performance-api/performance-api.module';
import { RedisModule } from '../redis/redis.module';
import { TicketSetupService } from './ticket-setup.service';
import { TraceModule } from '@neticket/shared-nestjs';

@Module({
  imports: [PerformanceApiModule, RedisModule, TraceModule],
  providers: [TicketSetupService],
  exports: [TicketSetupService],
})
export class TicketSetupModule {}
