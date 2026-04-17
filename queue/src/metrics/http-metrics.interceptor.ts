import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';
import type { Request, Response } from 'express';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const start = Date.now();

    this.metricsService.activeRequests.inc();

    return next.handle().pipe(
      tap({
        next: () => this.record(req, res, start),
        error: () => this.record(req, res, start),
      }),
    );
  }

  private record(req: Request, res: Response, start: number) {
    this.metricsService.activeRequests.dec();
    const route: unknown = req.route;
    const routePath =
      route !== null &&
      typeof route === 'object' &&
      'path' in route &&
      typeof route.path === 'string'
        ? route.path
        : req.path;
    this.metricsService.httpDuration.observe(
      {
        method: req.method,
        route: routePath,
        status_code: String(res.statusCode),
      },
      (Date.now() - start) / 1000,
    );
  }
}
