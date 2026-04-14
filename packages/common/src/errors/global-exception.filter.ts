import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from "@nestjs/common";
import { BaseException } from "./base.exception";
import { TraceService } from "../trace/trace.service";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly traceService: TraceService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<any>();
    const request = ctx.getRequest<any>();

    const traceId = this.traceService.getOrCreateTraceId();
    const timestamp = new Date().toISOString();

    let statusCode = 500;
    let message = "서버 내부 오류 발생";
    let errorCode = "INTERNAL_ERROR";

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse() as
        | { error?: string; message?: any }
        | string;

      if (exception instanceof BaseException) {
        errorCode = exception.errorCode;
        message = exception.message;
      } else {
        if (res && typeof res === "object") {
          errorCode = res.error || "HTTP_EXCEPTION";
          message = Array.isArray(res.message)
            ? res.message.join(", ")
            : res.message || exception.message;
        } else {
          message = res;
          errorCode = "HTTP_EXCEPTION";
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const logMsg = `[${request?.method}] ${request?.url} -> ${message}`;

    const logMetadata = {
      errorCode,
      statusCode,
      path: request?.url,
      method: request?.method,
      ip: request?.ip,
      userId: request?.user?.id,
    };

    if (statusCode >= 500) {
      this.logger.error(
        logMsg,
        exception instanceof Error ? exception.stack : undefined,
        logMetadata
      );
    } else {
      this.logger.warn(logMsg, logMetadata);
    }

    response.status(statusCode).json({
      success: false,
      errorCode,
      message,
      traceId,
      timestamp,
    });
  }
}
