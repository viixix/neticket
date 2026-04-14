import { Module } from '@nestjs/common';
import { ReservationModule } from '../reservation/reservation.module';
import { VirtualUserWorker } from './virtual-user.worker';
import { RedisModule } from '../redis/redis.module';
import { TicketConfigService } from '../config/ticket-config.service';
import { TraceModule } from '@neticket/common';

@Module({
  imports: [ReservationModule, RedisModule, TraceModule],
  providers: [TicketConfigService, VirtualUserWorker],
})
export class VirtualUserModule {}
