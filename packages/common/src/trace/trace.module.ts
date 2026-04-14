import { Module } from "@nestjs/common";
import { TraceService } from "./trace.service";
import { AxiosTraceInterceptor } from "./axios-trace.interceptor";

@Module({
  providers: [TraceService, AxiosTraceInterceptor],
  exports: [TraceService, AxiosTraceInterceptor],
})
export class TraceModule {}
