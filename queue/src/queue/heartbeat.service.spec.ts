import { Test, TestingModule } from '@nestjs/testing';
import { PROVIDERS, REDIS_KEYS } from '@neticket/contracts';
import { HeartbeatService } from './heartbeat.service';
import { QueueConfigService } from './queue-config.service';

describe('HeartbeatService', () => {
  let service: HeartbeatService;
  let redisMock: { zadd: jest.Mock };
  let configServiceMock: {
    heartbeat: { enabled: boolean; throttleMs: number; cacheMaxSize: number };
  };

  const buildModule = async (): Promise<HeartbeatService> => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HeartbeatService,
        { provide: PROVIDERS.REDIS_QUEUE, useValue: redisMock },
        { provide: QueueConfigService, useValue: configServiceMock },
      ],
    }).compile();
    return module.get<HeartbeatService>(HeartbeatService);
  };

  beforeEach(() => {
    redisMock = { zadd: jest.fn().mockResolvedValue(1) };
    configServiceMock = {
      heartbeat: { enabled: true, throttleMs: 1000, cacheMaxSize: 100 },
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  // ────────────────────────────────────────────────────────────────
  // 기본 동작
  // ────────────────────────────────────────────────────────────────

  describe('기본 동작', () => {
    it('서비스가 정의되어 있어야 한다', async () => {
      service = await buildModule();
      expect(service).toBeDefined();
    });

    it('heartbeat가 활성화된 경우 HEARTBEAT_QUEUE에 zadd를 호출한다', async () => {
      service = await buildModule();

      await service.update('user-123');

      expect(redisMock.zadd).toHaveBeenCalledWith(
        REDIS_KEYS.HEARTBEAT_QUEUE,
        expect.any(Number),
        'user-123',
      );
    });

    it('zadd에 현재 타임스탬프(숫자)를 score로 전달한다', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(5000));
      service = await buildModule();

      await service.update('user-123');

      expect(redisMock.zadd).toHaveBeenCalledWith(
        REDIS_KEYS.HEARTBEAT_QUEUE,
        5000,
        'user-123',
      );
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 비활성화
  // ────────────────────────────────────────────────────────────────

  describe('비활성화 상태', () => {
    it('heartbeat.enabled가 false이면 Redis zadd를 호출하지 않는다', async () => {
      configServiceMock.heartbeat.enabled = false;
      service = await buildModule();

      await service.update('user-123');

      expect(redisMock.zadd).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 스로틀링
  // ────────────────────────────────────────────────────────────────

  describe('스로틀링', () => {
    it('throttleMs 내에 같은 userId를 재호출하면 zadd를 다시 호출하지 않는다', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(1000));
      configServiceMock.heartbeat.throttleMs = 1000;
      service = await buildModule();

      await service.update('user-123');
      jest.setSystemTime(new Date(1500)); // 500ms 경과 (< 1000ms throttle)
      await service.update('user-123');

      expect(redisMock.zadd).toHaveBeenCalledTimes(1);
    });

    it('throttleMs 경과 후 같은 userId를 재호출하면 zadd를 다시 호출한다', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(1000));
      configServiceMock.heartbeat.throttleMs = 1000;
      service = await buildModule();

      await service.update('user-123');
      jest.setSystemTime(new Date(2001)); // 1001ms 경과 (>= 1000ms throttle)
      await service.update('user-123');

      expect(redisMock.zadd).toHaveBeenCalledTimes(2);
    });

    it('throttleMs가 0이면 매 호출마다 zadd를 호출한다', async () => {
      configServiceMock.heartbeat.throttleMs = 0;
      service = await buildModule();

      await service.update('user-123');
      await service.update('user-123');

      expect(redisMock.zadd).toHaveBeenCalledTimes(2);
    });

    it('서로 다른 userId는 독립적으로 스로틀링된다', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(1000));
      configServiceMock.heartbeat.throttleMs = 1000;
      service = await buildModule();

      await service.update('user-a');
      await service.update('user-b'); // 다른 userId이므로 호출됨

      expect(redisMock.zadd).toHaveBeenCalledTimes(2);
    });

    it('throttle 정확히 경계값(throttleMs - 1ms)에서는 호출하지 않는다', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(1000));
      configServiceMock.heartbeat.throttleMs = 1000;
      service = await buildModule();

      await service.update('user-123');
      jest.setSystemTime(new Date(1999)); // 999ms 경과 (< 1000ms throttle)
      await service.update('user-123');

      expect(redisMock.zadd).toHaveBeenCalledTimes(1);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 캐시 초과 처리
  // ────────────────────────────────────────────────────────────────

  describe('캐시 초과 처리', () => {
    it('cache가 cacheMaxSize 초과 시 전체 초기화되어 이후 호출을 다시 zadd한다', async () => {
      configServiceMock.heartbeat = {
        enabled: true,
        throttleMs: 0,
        cacheMaxSize: 2,
      };
      service = await buildModule();

      await service.update('user-1');
      await service.update('user-2');
      await service.update('user-3'); // maxSize=2 초과 → 캐시 초기화

      // 캐시가 초기화되었으므로 user-1은 throttle 없이 다시 호출 가능
      await service.update('user-1');

      expect(redisMock.zadd).toHaveBeenCalledTimes(4);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 실패 경로
  // ────────────────────────────────────────────────────────────────

  describe('실패 경로', () => {
    it('Redis zadd 에러가 발생해도 예외를 throw하지 않는다', async () => {
      service = await buildModule();
      redisMock.zadd.mockRejectedValueOnce(
        new Error('Redis connection failed'),
      );

      await expect(service.update('user-123')).resolves.not.toThrow();
    });

    it('Redis 에러 발생 후에도 이후 호출에서 zadd를 다시 시도한다', async () => {
      configServiceMock.heartbeat.throttleMs = 0;
      service = await buildModule();

      redisMock.zadd
        .mockRejectedValueOnce(new Error('Redis Error'))
        .mockResolvedValueOnce(1);

      await service.update('user-123'); // 실패
      await service.update('user-123'); // 재시도 가능해야 함

      expect(redisMock.zadd).toHaveBeenCalledTimes(2);
    });
  });
});
