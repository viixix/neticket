import { Injectable, NestMiddleware } from "@nestjs/common";
import { TraceService } from "./trace.service";

@Injectable()
export class TraceMiddleware implements NestMiddleware {
  constructor(private readonly traceService: TraceService) {}

  use(req: any, res: any, next: () => void): void {
    const incomingTraceId =
      req.header("X-Trace-Id") || req.header("x-trace-id");
    const traceId = incomingTraceId || this.traceService.generateTraceId();

    this.traceService.runWithTraceId(traceId, () => {
      res.setHeader("X-Trace-Id", traceId);
      next();
    });
  }
}
