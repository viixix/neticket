import { Test, TestingModule } from '@nestjs/testing';
import { PROVIDERS, REDIS_KEYS } from '@neticket/shared-constants';
import { VirtualUserInjector } from './virtual-user.injector';
import { QueueConfigService } from './queue-config.service';
import { TicketingStateService } from './ticketing-state.service';
import { TraceService } from '@neticket/shared-nestjs';

describe('VirtualUserInjector', () => {
  let injector: VirtualUserInjector;
  let redisMock: Record<string, jest.Mock>;
  let configServiceMock: {
    sync: jest.Mock;
    virtual: {
      enabled: boolean;
      targetTotal: number;
      initialJumpRatio: number;
      burstDurationSec: number;
      injectBatchSize: number;
      injectBatchDelayMs: number;
      tickIntervalMs: number;
    };
  };
  let ticketingStateServiceMock: { isOpen: jest.Mock };

  const makePipeline = (addedCount = 1) => ({
    zadd: jest.fn().mockReturnThis(),
    incrby: jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([[null, addedCount]]),
  });

  beforeEach(async () => {
    redisMock = {
      get: jest.fn().mockResolvedValue(null),
      zcard: jest.fn().mockResolvedValue(0),
      pipeline: jest.fn(),
    };

    configServiceMock = {
      sync: jest.fn().mockResolvedValue(undefined),
      virtual: {
        enabled: true,
        targetTotal: 100,
        initialJumpRatio: 0.3,
        burstDurationSec: 30,
        injectBatchSize: 10,
        injectBatchDelayMs: 0, // 테스트 속도를 위해 0
        tickIntervalMs: 1000,
      },
    };

    ticketingStateServiceMock = {
      isOpen: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VirtualUserInjector,
        { provide: PROVIDERS.REDIS_QUEUE, useValue: redisMock },
        { provide: QueueConfigService, useValue: configServiceMock },
        { provide: TicketingStateService, useValue: ticketingStateServiceMock },
        {
          provide: TraceService,
          useValue: {
            generateTraceId: jest.fn().mockReturnValue('trace-id'),
            runWithTraceId: jest
              .fn()
              .mockImplementation((_id: string, fn: () => unknown) => fn()),
          },
        },
      ],
    }).compile();

    injector = module.get<VirtualUserInjector>(VirtualUserInjector);
  });

  afterEach(() => {
    injector.stop();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  // ────────────────────────────────────────────────────────────────
  // start()
  // ────────────────────────────────────────────────────────────────

  describe('start()', () => {
    describe('사전 조건 검사', () => {
      it('이미 실행 중이면 중복 시작하지 않는다', async () => {
        const pipeline = makePipeline();
        redisMock.pipeline.mockReturnValue(pipeline);

        await injector.start();
        await injector.start(); // 두 번째 호출 무시

        // INJECTOR_STATE 조회가 두 번이면 두 번 시작된 것이므로, 한 번이어야 함
        expect(redisMock.get).toHaveBeenCalledTimes(1);
      });

      it('virtual.enabled가 false이면 주입을 시작하지 않는다', async () => {
        configServiceMock.virtual.enabled = false;

        await injector.start();

        expect(redisMock.get).not.toHaveBeenCalled();
      });
    });

    describe('초기 배치 주입 (alreadyInjected = 0)', () => {
      it('alreadyInjected가 0이면 initialCount(targetTotal * initialJumpRatio)만큼 주입한다', async () => {
        // targetTotal=100, initialJumpRatio=0.3 → initialCount=30
        redisMock.get.mockResolvedValueOnce(null); // alreadyInjected = 0
        const pipeline = makePipeline();
        redisMock.pipeline.mockReturnValue(pipeline);

        await injector.start();

        // 30개 zadd (batchSize=10이므로 3번의 batch)
        expect(pipeline.zadd).toHaveBeenCalledTimes(30);
        pipeline.zadd.mock.calls.forEach(([key]: [string]) => {
          expect(key).toBe(REDIS_KEYS.WAITING_QUEUE);
        });
      });

      it('주입된 가상 유저 ID는 V_ 접두사로 시작한다', async () => {
        redisMock.get.mockResolvedValueOnce(null);
        const pipeline = makePipeline();
        redisMock.pipeline.mockReturnValue(pipeline);

        await injector.start();

        const userIds = pipeline.zadd.mock.calls.map(
          ([, , userId]: [unknown, unknown, string]) => userId,
        );
        userIds.forEach((id) => {
          expect(id).toMatch(/^V_/);
        });
      });

      it('초기 주입 후 INJECTOR_STATE를 initialCount만큼 증가시킨다', async () => {
        redisMock.get.mockResolvedValueOnce(null);
        // pipeline은 zadd용과 incrby용 두 가지로 사용됨
        const pipeline = makePipeline(30);
        redisMock.pipeline.mockReturnValue(pipeline);

        await injector.start();

        expect(pipeline.incrby).toHaveBeenCalledWith(
          REDIS_KEYS.INJECTOR_STATE,
          30,
        );
      });
    });

    describe('초기 배치 주입 건너뜀 (alreadyInjected > 0)', () => {
      it('alreadyInjected가 0보다 크면 초기 주입을 건너뛴다', async () => {
        redisMock.get.mockResolvedValueOnce('50'); // alreadyInjected = 50
        const pipeline = makePipeline();
        redisMock.pipeline.mockReturnValue(pipeline);

        await injector.start();

        expect(pipeline.zadd).not.toHaveBeenCalled();
      });
    });

    describe('configService.sync 호출', () => {
      it('start() 시 configService.sync를 호출한다', async () => {
        redisMock.get.mockResolvedValueOnce(null);
        redisMock.pipeline.mockReturnValue(makePipeline());

        await injector.start();

        expect(configServiceMock.sync).toHaveBeenCalled();
      });
    });
  });

  // ────────────────────────────────────────────────────────────────
  // stop()
  // ────────────────────────────────────────────────────────────────

  describe('stop()', () => {
    it('stop() 호출 후 타이머가 취소된다', async () => {
      jest.useFakeTimers();
      redisMock.get.mockResolvedValue(null);
      redisMock.pipeline.mockReturnValue(makePipeline());

      await injector.start();
      injector.stop();

      // stop 후에는 타이머가 없으므로 추가 Redis 호출 없음
      const callCountAfterStop = redisMock.get.mock.calls.length;
      await jest.advanceTimersByTimeAsync(5000);

      expect(redisMock.get).toHaveBeenCalledTimes(callCountAfterStop);
    });

    it('start() 전에 stop()을 호출해도 에러가 발생하지 않는다', () => {
      expect(() => injector.stop()).not.toThrow();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // runTick (타이머를 통한 간접 검증)
  // ────────────────────────────────────────────────────────────────

  describe('runTick (타이머 기반)', () => {
    it('티켓팅이 닫히면 tick 실행 후 isRunning이 false가 된다', async () => {
      jest.useFakeTimers();
      redisMock.get.mockResolvedValue('0');
      redisMock.pipeline.mockReturnValue(makePipeline());

      await injector.start();

      // 다음 tick에서 isOpen = false를 반환하도록 설정
      ticketingStateServiceMock.isOpen.mockResolvedValue(false);

      await jest.advanceTimersByTimeAsync(1000); // tickIntervalMs=1000
      await Promise.resolve();
      await Promise.resolve();

      // 이후 타이머가 실행되지 않아야 함
      const callCountAfterClose =
        ticketingStateServiceMock.isOpen.mock.calls.length;
      await jest.advanceTimersByTimeAsync(1000);
      expect(ticketingStateServiceMock.isOpen).toHaveBeenCalledTimes(
        callCountAfterClose,
      );
    });

    it('virtual.enabled가 비활성화되면 tick에서 stop한다', async () => {
      jest.useFakeTimers();
      redisMock.get.mockResolvedValue('0');
      const pipeline = makePipeline();
      pipeline.exec.mockResolvedValue([[null, 1]]);
      redisMock.pipeline.mockReturnValue(pipeline);

      await injector.start();

      // 다음 tick에서 virtual.enabled = false로 변경
      configServiceMock.virtual.enabled = false;

      await jest.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
      await Promise.resolve();

      // 이후 타이머가 실행되지 않아야 함
      const isOpenCallCount =
        ticketingStateServiceMock.isOpen.mock.calls.length;
      await jest.advanceTimersByTimeAsync(1000);
      expect(ticketingStateServiceMock.isOpen).toHaveBeenCalledTimes(
        isOpenCallCount,
      );
    });
  });
});
