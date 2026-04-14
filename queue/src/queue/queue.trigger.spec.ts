import { Test, TestingModule } from '@nestjs/testing';
import { TraceService } from '@neticket/common';
import { QueueTrigger } from './queue.trigger';
import { QueueWorker } from './queue.worker';
import { PROVIDERS, REDIS_CHANNELS } from '@neticket/contracts';
import { QueueConfigService } from './queue-config.service';

describe('QueueTrigger', () => {
  let module: TestingModule;
  let trigger: QueueTrigger;
  let workerMock: {
    processQueueTransfer: jest.Mock;
    removeActiveUser: jest.Mock;
  };
  let redisMock: Record<string, jest.Mock>;
  let subClientMock: Record<string, jest.Mock>;
  let configServiceMock: {
    worker: { transferIntervalSec: number };
    sync: jest.Mock;
  };
  let traceServiceMock: {
    generateTraceId: jest.Mock;
    runWithTraceId: jest.Mock;
  };

  beforeEach(async () => {
    workerMock = {
      processQueueTransfer: jest.fn().mockResolvedValue(undefined),
      removeActiveUser: jest.fn().mockResolvedValue(undefined),
    };

    subClientMock = {
      subscribe: jest.fn().mockResolvedValue(null),
      on: jest.fn(),
      quit: jest.fn().mockResolvedValue(undefined),
    };

    redisMock = {
      duplicate: jest.fn().mockReturnValue(subClientMock),
    };

    configServiceMock = {
      worker: { transferIntervalSec: 60 },
      sync: jest.fn().mockResolvedValue(undefined),
    };

    traceServiceMock = {
      generateTraceId: jest.fn().mockReturnValue('trace-id'),
      runWithTraceId: jest
        .fn()
        .mockImplementation((_id: string, fn: () => unknown) => fn()),
    };

    module = await Test.createTestingModule({
      providers: [
        QueueTrigger,
        { provide: QueueWorker, useValue: workerMock },
        { provide: PROVIDERS.REDIS_QUEUE, useValue: redisMock },
        { provide: QueueConfigService, useValue: configServiceMock },
        { provide: TraceService, useValue: traceServiceMock },
      ],
    }).compile();

    trigger = module.get<QueueTrigger>(QueueTrigger);
  });

  afterEach(async () => {
    await trigger.onModuleDestroy();
    jest.useRealTimers();
  });

  afterAll(async () => {
    await module.close();
  });

  // ────────────────────────────────────────────────────────────────
  // onModuleInit
  // ────────────────────────────────────────────────────────────────

  describe('onModuleInit', () => {
    it('QUEUE_EVENT_DONE 채널을 구독한다', async () => {
      await trigger.onModuleInit();

      expect(subClientMock.subscribe).toHaveBeenCalledWith(
        REDIS_CHANNELS.QUEUE_EVENT_DONE,
      );
    });

    it('message 이벤트 핸들러를 등록한다', async () => {
      await trigger.onModuleInit();

      expect(subClientMock.on).toHaveBeenCalledWith(
        'message',
        expect.any(Function),
      );
    });

    it('초기화 즉시 worker의 큐 이동 로직을 실행한다', async () => {
      await trigger.onModuleInit();

      expect(workerMock.processQueueTransfer).toHaveBeenCalled();
    });

    it('초기화 시 configService.sync를 호출한다', async () => {
      await trigger.onModuleInit();

      expect(configServiceMock.sync).toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 주기적 전송 스케줄링
  // ────────────────────────────────────────────────────────────────

  describe('주기적 전송 스케줄링', () => {
    it('설정된 interval 후 worker의 큐 이동 로직을 다시 호출한다', async () => {
      jest.useFakeTimers();
      configServiceMock.worker.transferIntervalSec = 60;

      await trigger.onModuleInit();
      const initialCount = workerMock.processQueueTransfer.mock.calls.length;

      await jest.advanceTimersByTimeAsync(60000);

      expect(workerMock.processQueueTransfer).toHaveBeenCalledTimes(
        initialCount + 1,
      );
    });

    it('각 cycle마다 configService.sync를 호출한다', async () => {
      jest.useFakeTimers();

      await trigger.onModuleInit();
      await jest.advanceTimersByTimeAsync(60000);

      expect(configServiceMock.sync).toHaveBeenCalledTimes(2); // init + 1 cycle
    });
  });

  // ────────────────────────────────────────────────────────────────
  // QUEUE_EVENT_DONE 메시지 처리 (handleDoneEvent)
  // ────────────────────────────────────────────────────────────────

  describe('QUEUE_EVENT_DONE 메시지 처리', () => {
    const getMessageHandler = () => {
      const call = (
        subClientMock.on.mock.calls as [string, (...args: unknown[]) => void][]
      ).find(([event]) => event === 'message');
      return call?.[1] as (channel: string, message: string) => void;
    };

    it('QUEUE_EVENT_DONE 메시지 수신 시 removeActiveUser를 호출한다', async () => {
      await trigger.onModuleInit();

      const message = JSON.stringify({ userId: 'user-xyz', isVirtual: false });
      getMessageHandler()(REDIS_CHANNELS.QUEUE_EVENT_DONE, message);

      // removeActiveUser는 첫 번째 await 전에 호출됨
      expect(workerMock.removeActiveUser).toHaveBeenCalledWith(
        'user-xyz',
        false,
      );
    });

    it('QUEUE_EVENT_DONE 메시지 수신 시 processQueueTransfer를 추가로 호출한다', async () => {
      await trigger.onModuleInit();
      const callsBefore = workerMock.processQueueTransfer.mock.calls.length;

      const message = JSON.stringify({ userId: 'user-xyz', isVirtual: false });
      getMessageHandler()(REDIS_CHANNELS.QUEUE_EVENT_DONE, message);

      await Promise.resolve(); // removeActiveUser 완료 후 processQueueTransfer 호출
      await Promise.resolve();

      expect(workerMock.processQueueTransfer).toHaveBeenCalledTimes(
        callsBefore + 1,
      );
    });

    it('가상 유저 완료 이벤트 시 isVirtual=true로 removeActiveUser를 호출한다', async () => {
      await trigger.onModuleInit();

      // parsePubSubPayload는 userId.startsWith('V_') && userId.length > 16 으로 isVirtual을 판단함
      const virtualUserId = 'V_' + 'x'.repeat(16); // length=18 > 16
      const message = JSON.stringify({ userId: virtualUserId });
      getMessageHandler()(REDIS_CHANNELS.QUEUE_EVENT_DONE, message);

      expect(workerMock.removeActiveUser).toHaveBeenCalledWith(
        virtualUserId,
        true,
      );
    });

    it('다른 채널의 메시지는 무시한다', async () => {
      await trigger.onModuleInit();
      const removeCallsBefore = workerMock.removeActiveUser.mock.calls.length;

      getMessageHandler()(
        'other:channel',
        JSON.stringify({ userId: 'user-xyz' }),
      );
      await Promise.resolve();

      expect(workerMock.removeActiveUser).toHaveBeenCalledTimes(
        removeCallsBefore,
      );
    });
  });

  // ────────────────────────────────────────────────────────────────
  // onModuleDestroy
  // ────────────────────────────────────────────────────────────────

  describe('onModuleDestroy', () => {
    it('subscriber quit을 호출한다', async () => {
      await trigger.onModuleInit();
      await trigger.onModuleDestroy();

      expect(subClientMock.quit).toHaveBeenCalled();
    });

    it('destroy 후에는 새로운 transfer cycle을 시작하지 않는다', async () => {
      jest.useFakeTimers();

      await trigger.onModuleInit();
      await trigger.onModuleDestroy();
      const countAfterDestroy =
        workerMock.processQueueTransfer.mock.calls.length;

      await jest.advanceTimersByTimeAsync(60000);

      expect(workerMock.processQueueTransfer).toHaveBeenCalledTimes(
        countAfterDestroy,
      );
    });
  });
});
