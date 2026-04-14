import { TraceService } from "./trace.service";

export type PubSubPayload = {
  /**
   * PubSub 메시지 페이로드
   * `@property` userId - 사용자 ID 또는 상태값('open', 'close' 등)
   * `@property` traceId - 추적 ID (선택)
   * `@property` isVirtual - 가상 유저 여부 (선택)
   */
  userId: string;
  traceId?: string;
  isVirtual?: boolean;
};

export const parsePubSubPayload = (message: string): PubSubPayload => {
  try {
    const parsed = JSON.parse(message) as {
      userId?: unknown;
      traceId?: unknown;
    };
    if (parsed && typeof parsed === "object") {
      const userId =
        typeof parsed.userId === "string" ? parsed.userId : undefined;
      const traceId =
        typeof parsed.traceId === "string" ? parsed.traceId : undefined;

      if (userId) {
        return {
          userId,
          traceId,
          isVirtual: userId.startsWith("V_") && userId.length > 16,
        };
      }
    }
  } catch {
    // JSON이 아닌 평문 메시지인 경우 폴백으로 진행
  }

  return {
    userId: message,
    isVirtual: message.startsWith("V_") && message.length > 16,
  };
};

export const runWithPubSubContext = async <T>(
  traceService: TraceService,
  message: string,
  handler: (payload: PubSubPayload) => Promise<T> | T
): Promise<T> => {
  const payload = parsePubSubPayload(message);
  const traceId = payload.traceId || traceService.generateTraceId();

  return traceService.runWithTraceId(traceId, () => handler(payload));
};
