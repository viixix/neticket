import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PerformanceApiService } from './performance-api.service';
import { AxiosTraceInterceptor, TraceModule } from '@neticket/common';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
    TraceModule,
  ],
  providers: [PerformanceApiService, AxiosTraceInterceptor],
  exports: [PerformanceApiService],
})
export class PerformanceApiModule {}
