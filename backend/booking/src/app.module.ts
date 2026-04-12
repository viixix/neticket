import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import {
  jwtConfig,
  redisConfig,
  GlobalExceptionFilter,
  TraceMiddleware,
  TraceModule,
} from '@neticket/shared-nestjs';
import { ScheduleModule } from '@nestjs/schedule';
import { ReservationModule } from './reservation/reservation.module';
import { TicketSchedulerModule } from './ticket-scheduler/ticket-scheduler.module';
import { CaptchaModule } from './captcha/captcha.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { VirtualUserModule } from './virtual-user/virtual-user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [jwtConfig, redisConfig],
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    ReservationModule,
    TicketSchedulerModule,
    CaptchaModule,
    VirtualUserModule,
    TraceModule,
  ],
  controllers: [],
  providers: [
    GlobalExceptionFilter,
    TraceMiddleware,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
