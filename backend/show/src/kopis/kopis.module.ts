import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { KopisService } from './kopis.service';
import { KopisScheduler } from './kopis.scheduler';
import { KopisController } from './kopis.controller';
import { TraceModule } from '@neticket/shared-nestjs';
import { AxiosTraceInterceptor } from '@neticket/shared-nestjs';

@Module({
  imports: [HttpModule, TraceModule],
  controllers: [KopisController],
  providers: [KopisService, KopisScheduler, AxiosTraceInterceptor],
  exports: [KopisService],
})
export class KopisModule {}
