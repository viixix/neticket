import { LoggerService } from "@nestjs/common";
import { WinstonModule } from "nest-winston";
import * as winston from "winston";
import { TraceService } from "../trace/trace.service";

/**
 * 모든 서버에서 공통으로 사용할 Winston 로거 설정을 반환합니다.
 * @param serviceName 서비스 식별자 (예: 'show', 'booking', 'queue')
 */
export const getWinstonLogger = (
  serviceName: string,
  traceService: TraceService
): LoggerService => {
  const traceFormat = winston.format((info) => {
    const traceId = traceService.getTraceId();
    if (traceId) {
      info.traceId = traceId;
    }
    return info;
  });

  return WinstonModule.createLogger({
    transports: [
      new winston.transports.Console({
        level: process.env.NODE_ENV === "production" ? "info" : "debug",
        format: winston.format.combine(
          traceFormat(),
          winston.format.timestamp(),
          winston.format.ms(),
          winston.format.label({ label: serviceName }),
          winston.format((info) => {
            if (typeof info.context === "string") {
              info.className = info.context;
              delete info.context;
            }

            if (typeof info.context === "object" && info.context !== null) {
              Object.assign(info, info.context);
              delete info.context;
            }
            return info;
          })(),
          winston.format.json()
        ),
      }),
    ],
  });
};
