import { Logger } from '@nestjs/common';
import { QUEUE_ERROR_CODES, QueueException } from '@beastcamp/shared-nestjs';
import { createQueueErrorHandler } from './queue-error.util';

describe('createQueueErrorHandler', () => {
  let logger: Logger;
  let handleError: ReturnType<typeof createQueueErrorHandler>;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    logger = new Logger('Test');
    loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation();
    handleError = createQueueErrorHandler(logger);
  });

  afterEach(() => jest.restoreAllMocks());

  // ────────────────────────────────────────────────────────────────
  // 에러 메시지 매핑
  // ────────────────────────────────────────────────────────────────

  describe('에러 메시지 매핑', () => {
    it('QUEUE_TRANSFER_FAILED는 대기열 처리 중 오류 메시지로 매핑된다', () => {
      const result = handleError(
        new Error('redis'),
        QUEUE_ERROR_CODES.QUEUE_TRANSFER_FAILED,
      );

      expect(result.message).toBe('대기열 처리 중 오류가 발생했습니다.');
    });

    it('QUEUE_HEARTBEAT_UPDATE_FAILED는 하트비트 업데이트 실패 메시지로 매핑된다', () => {
      const result = handleError(
        new Error('redis'),
        QUEUE_ERROR_CODES.QUEUE_HEARTBEAT_UPDATE_FAILED,
      );

      expect(result.message).toBe('하트비트 업데이트에 실패했습니다.');
    });

    it('QUEUE_REMOVE_ACTIVE_FAILED는 활성 큐 제거 실패 메시지로 매핑된다', () => {
      const result = handleError(
        new Error('redis'),
        QUEUE_ERROR_CODES.QUEUE_REMOVE_ACTIVE_FAILED,
      );

      expect(result.message).toBe('활성 큐 제거에 실패했습니다.');
    });

    it('알 수 없는 에러 코드는 기본 메시지를 반환한다', () => {
      const result = handleError(new Error('unknown'), 'UNKNOWN_CODE_XYZ');

      expect(result.message).toBe('알 수 없는 오류가 발생했습니다.');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 예외 래핑
  // ────────────────────────────────────────────────────────────────

  describe('예외 래핑', () => {
    it('일반 Error는 QueueException으로 래핑되어 반환된다', () => {
      const result = handleError(
        new Error('something broke'),
        QUEUE_ERROR_CODES.QUEUE_TRANSFER_FAILED,
      );

      expect(result).toBeInstanceOf(QueueException);
    });

    it('래핑된 QueueException에 errorCode가 설정된다', () => {
      const result = handleError(
        new Error('redis error'),
        QUEUE_ERROR_CODES.QUEUE_HEARTBEAT_UPDATE_FAILED,
      );

      expect(result.errorCode).toBe(
        QUEUE_ERROR_CODES.QUEUE_HEARTBEAT_UPDATE_FAILED,
      );
    });

    it('이미 QueueException이면 새로 래핑하지 않고 그대로 반환된다', () => {
      const original = new QueueException(
        QUEUE_ERROR_CODES.QUEUE_TRANSFER_FAILED,
        '기존 예외 메시지',
        500,
      );

      const result = handleError(
        original,
        QUEUE_ERROR_CODES.QUEUE_TRANSFER_FAILED,
      );

      expect(result).toBe(original);
    });

    it('문자열 에러도 QueueException으로 래핑된다', () => {
      const result = handleError(
        'string error',
        QUEUE_ERROR_CODES.QUEUE_REMOVE_ACTIVE_FAILED,
      );

      expect(result).toBeInstanceOf(QueueException);
    });

    it('null 에러도 QueueException으로 래핑된다', () => {
      const result = handleError(null, QUEUE_ERROR_CODES.QUEUE_TRIGGER_FAILED);

      expect(result).toBeInstanceOf(QueueException);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 로깅
  // ────────────────────────────────────────────────────────────────

  describe('로깅', () => {
    it('에러 핸들링 시 logger.error를 호출한다', () => {
      handleError(new Error('test'), QUEUE_ERROR_CODES.QUEUE_TRANSFER_FAILED);

      expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('로그에 errorCode가 포함된다', () => {
      handleError(new Error('test'), QUEUE_ERROR_CODES.QUEUE_TRANSFER_FAILED);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
        expect.objectContaining({
          errorCode: QUEUE_ERROR_CODES.QUEUE_TRANSFER_FAILED,
        }),
      );
    });

    it('컨텍스트 정보가 로그에 포함된다', () => {
      handleError(
        new Error('test'),
        QUEUE_ERROR_CODES.QUEUE_REMOVE_ACTIVE_FAILED,
        {
          userId: 'user-123',
          isVirtual: false,
        },
      );

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
        expect.objectContaining({ userId: 'user-123', isVirtual: false }),
      );
    });

    it('Error 인스턴스면 stack trace를 로그에 포함한다', () => {
      const error = new Error('detailed error');

      handleError(error, QUEUE_ERROR_CODES.QUEUE_TRANSFER_FAILED);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('detailed error'),
        expect.any(Object),
      );
    });

    it('Error가 아닌 값이면 undefined를 stack으로 전달한다', () => {
      handleError('string error', QUEUE_ERROR_CODES.QUEUE_TRANSFER_FAILED);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.any(String),
        undefined,
        expect.any(Object),
      );
    });
  });
});
