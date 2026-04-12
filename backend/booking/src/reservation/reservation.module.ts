import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { ReservationService } from './reservation.service';
import { ReservationController } from './reservation.controller';
import { TraceModule } from '@neticket/shared-nestjs';

@Module({
  imports: [RedisModule, AuthModule, TraceModule],
  controllers: [ReservationController],
  providers: [ReservationService],
  exports: [ReservationService],
})
export class ReservationModule {}
