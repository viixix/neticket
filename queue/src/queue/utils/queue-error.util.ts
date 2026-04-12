import { Logger } from '@nestjs/common';
import { QUEUE_ERROR_CODES, QueueException } from '@neticket/shared-nestjs';

const QUEUE_ERROR_MESSAGES: Record<string, string> = {
  [QUEUE_ERROR_CODES.QUEUE_CONFIG_SEED_FAILED]:
    '대기열 설정 시딩에 실패했습니다.',
  [QUEUE_ERROR_CODES.QUEUE_HEARTBEAT_UPDATE_FAILED]:
    '하트비트 업데이트에 실패했습니다.',
  [QUEUE_ERROR_CODES.QUEUE_TRANSFER_FAILED]:
    '대기열 처리 중 오류가 발생했습니다.',
  [QUEUE_ERROR_CODES.QUEUE_REMOVE_ACTIVE_FAILED]:
    '활성 큐 제거에 실패했습니다.',
  [QUEUE_ERROR_CODES.QUEUE_TRIGGER_FAILED]:
    '대기열 스케줄링 중 오류가 발생했습니다.',
  [QUEUE_ERROR_CODES.QUEUE_DONE_EVENT_FAILED]:
    '티켓팅 완료 이벤트 처리 중 오류가 발생했습니다.',
  [QUEUE_ERROR_CODES.QUEUE_VIRTUAL_INJECT_FAILED]:
    '가상 유저 주입 중 오류가 발생했습니다.',
  [QUEUE_ERROR_CODES.QUEUE_INJECTION_START_FAILED]:
    '가상 유저 주입 시작에 실패했습니다.',
};

export function createQueueErrorHandler(logger: Logger) {
  return (
    error: unknown,
    errorCode: string,
    context?: Record<string, unknown>,
  ): QueueException => {
    const message =
      QUEUE_ERROR_MESSAGES[errorCode] ?? '알 수 없는 오류가 발생했습니다.';
    const wrapped =
      error instanceof QueueException
        ? error
        : new QueueException(errorCode, message, 500);

    logger.error(
      wrapped.message,
      error instanceof Error ? error.stack : undefined,
      { errorCode: wrapped.errorCode, ...context },
    );

    return wrapped;
  };
}
