import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { TraceModule } from '@neticket/common';
import { TicketSetupModule } from '../ticket-setup/ticket-setup.module';
import { TicketSchedulerService } from './ticket-scheduler.service';

@Module({
  imports: [
    TicketSetupModule,
    ScheduleModule.forRoot(),
    ConfigModule,
    TraceModule,
  ],
  providers: [TicketSchedulerService],
  exports: [TicketSchedulerService],
})
export class TicketSchedulerModule {}
