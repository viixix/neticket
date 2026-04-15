import { Test, TestingModule } from '@nestjs/testing';
import { PROVIDERS, REDIS_CHANNELS, REDIS_KEYS } from '@neticket/contracts';
import { TicketingStateService } from './ticketing-state.service';
import { TraceService } from '@neticket/common';

describe('TicketingStateService', () => {
  let service: TicketingStateService;
  let module: TestingModule;
  let redisMock: { get: jest.Mock; duplicate: jest.Mock };
  let subscriberMock: { subscribe: jest.Mock; on: jest.Mock; quit: jest.Mock };

  const buildModule = async (): Promise<TestingModule> => {
    const m = await Test.createTestingModule({
      providers: [
        TicketingStateService,
        { provide: PROVIDERS.REDIS_QUEUE, useValue: redisMock },
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
    service = m.get<TicketingStateService>(TicketingStateService);
    return m;
  };

  beforeEach(() => {
    subscriberMock = {
      subscribe: jest.fn().mockResolvedValue(null),
      on: jest.fn(),
      quit: jest.fn().mockResolvedValue(undefined),
    };
    redisMock = {
      get: jest.fn(),
      duplicate: jest.fn().mockReturnValue(subscriberMock),
    };
  });

  afterEach(async () => {
    jest.useRealTimers();
    jest.clearAllMocks();
    if (module) await module.close();
  });

  // ────────────────────────────────────────────────────────────────
  // isOpen - 기본 반환값
  // ────────────────────────────────────────────────────────────────

  describe('isOpen - Redis 조회 결과 반환', () => {
    it("Redis가 'true'를 반환하면 isOpen은 true다", async () => {
      redisMock.get.mockResolvedValueOnce('true');
      module = await buildModule();

      expect(await service.isOpen()).toBe(true);
    });

    it("Redis가 'false'를 반환하면 isOpen은 false다", async () => {
      redisMock.get.mockResolvedValueOnce('false');
      module = await buildModule();

      expect(await service.isOpen()).toBe(false);
    });

    it('Redis가 null을 반환하면 isOpen은 false다 (기본값)', async () => {
      redisMock.get.mockResolvedValueOnce(null);
      module = await buildModule();

      expect(await service.isOpen()).toBe(false);
    });

    it('TICKETING_OPEN 키로 Redis를 조회한다', async () => {
      redisMock.get.mockResolvedValueOnce('true');
      module = await buildModule();

      await service.isOpen();

      expect(redisMock.get).toHaveBeenCalledWith(REDIS_KEYS.TICKETING_OPEN);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 캐시 TTL
  // ────────────────────────────────────────────────────────────────

  describe('캐시 TTL', () => {
    it('TTL(1000ms) 내 재호출 시 Redis를 재조회하지 않는다', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(10000));
      redisMock.get.mockResolvedValue('true');
      module = await buildModule();

      await service.isOpen(); // 첫 조회 → lastSyncAt = 10000
      jest.setSystemTime(new Date(10500)); // 500ms 경과 (< 1000ms TTL)
      await service.isOpen(); // 캐시 사용

      expect(redisMock.get).toHaveBeenCalledTimes(1);
    });

    it('TTL(1000ms) 만료 후 재호출 시 Redis를 다시 조회한다', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(10000));
      redisMock.get.mockResolvedValue('true');
      module = await buildModule();

      await service.isOpen(); // 첫 조회
      jest.setSystemTime(new Date(11001)); // 1001ms 경과 (> 1000ms TTL)
      await service.isOpen(); // 캐시 만료 → 재조회

      expect(redisMock.get).toHaveBeenCalledTimes(2);
    });

    it('TTL 경계값(정확히 1000ms)에서는 캐시가 만료되어 재조회한다', async () => {
      // 조건: now - lastSyncAt < CACHE_TTL(1000) → 정확히 1000ms면 false → 재조회
      jest.useFakeTimers();
      jest.setSystemTime(new Date(10000));
      redisMock.get.mockResolvedValue('true');
      module = await buildModule();

      await service.isOpen();
      jest.setSystemTime(new Date(11000)); // 정확히 1000ms 경과 → < 아님 → 재조회
      await service.isOpen();

      expect(redisMock.get).toHaveBeenCalledTimes(2);
    });

    it('캐시된 상태에서 티켓팅 상태가 바뀌어도 TTL 내에는 이전 값을 반환한다', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(10000));
      redisMock.get
        .mockResolvedValueOnce('true') // 첫 조회: open
        .mockResolvedValueOnce('false'); // 두 번째 조회: closed
      module = await buildModule();

      const first = await service.isOpen(); // true 캐시됨
      jest.setSystemTime(new Date(10500)); // TTL 내
      const second = await service.isOpen(); // 캐시에서 true

      expect(first).toBe(true);
      expect(second).toBe(true); // 아직 캐시 유효
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 동시 갱신 방지 (refreshPromise)
  // ────────────────────────────────────────────────────────────────

  describe('동시 갱신 방지', () => {
    it('동시에 여러 번 isOpen 호출 시 Redis는 한 번만 조회한다', async () => {
      let resolveGet!: (v: string) => void;
      redisMock.get.mockReturnValue(
        new Promise<string>((resolve) => {
          resolveGet = resolve;
        }),
      );
      module = await buildModule();

      // 두 호출을 동시에 시작 (get이 아직 resolve되지 않은 상태)
      const call1 = service.isOpen();
      const call2 = service.isOpen();

      resolveGet('true');
      await Promise.all([call1, call2]);

      expect(redisMock.get).toHaveBeenCalledTimes(1);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 생명주기 (onModuleInit / onModuleDestroy)
  // ────────────────────────────────────────────────────────────────

  describe('생명주기', () => {
    it('onModuleInit 시 TICKETING_STATE_CHANGED 채널을 구독한다', async () => {
      module = await buildModule();

      await service.onModuleInit();

      expect(subscriberMock.subscribe).toHaveBeenCalledWith(
        REDIS_CHANNELS.TICKETING_STATE_CHANGED,
      );
    });

    it('onModuleInit 시 message 이벤트 핸들러를 등록한다', async () => {
      module = await buildModule();

      await service.onModuleInit();

      expect(subscriberMock.on).toHaveBeenCalledWith(
        'message',
        expect.any(Function),
      );
    });

    it('onModuleDestroy 시 subscriber quit을 호출한다', async () => {
      module = await buildModule();

      await service.onModuleInit();
      await service.onModuleDestroy();

      expect(subscriberMock.quit).toHaveBeenCalled();
    });

    it('onModuleDestroy 후 subscriber가 null로 초기화된다', async () => {
      module = await buildModule();

      await service.onModuleInit();
      await service.onModuleDestroy();

      // 두 번 destroy를 호출해도 에러 없음
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 실패 경로
  // ────────────────────────────────────────────────────────────────

  describe('실패 경로', () => {
    it('Redis get 에러 시 isOpen은 false를 반환한다 (기본값 유지)', async () => {
      redisMock.get.mockRejectedValueOnce(new Error('Redis down'));
      module = await buildModule();

      const result = await service.isOpen();

      expect(result).toBe(false);
    });

    it('Redis 에러 발생 후 다음 호출에서 재조회를 시도한다', async () => {
      redisMock.get
        .mockRejectedValueOnce(new Error('Redis down'))
        .mockResolvedValueOnce('true');
      module = await buildModule();

      await service.isOpen(); // 실패 → lastSyncAt = 0 유지
      await service.isOpen(); // 재조회 시도

      expect(redisMock.get).toHaveBeenCalledTimes(2);
    });
  });
});
