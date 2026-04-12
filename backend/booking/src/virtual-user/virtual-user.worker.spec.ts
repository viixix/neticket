/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import {
  TicketException,
  TICKET_ERROR_CODES,
  TraceService,
} from '@neticket/shared-nestjs';
import { ChainableCommander } from 'ioredis';
import { REDIS_CHANNELS } from '@neticket/shared-constants';
import { VirtualUserWorker } from './virtual-user.worker';
import { RedisService } from '../redis/redis.service';
import { ReservationService } from '../reservation/reservation.service';
import { TicketConfigService } from '../config/ticket-config.service';

/** 테스트에서 private 메서드 호출용 (클래스와 교차 시 private로 인해 never가 되므로 별도 타입) */
interface VirtualUserWorkerTest {
  delay: jest.Mock<Promise<void>, [number]>;
  processVirtualUser(
    userId: string,
    maxSeatPickAttempts: number,
  ): Promise<void>;
}

function createPipelineMock(): {
  del: jest.Mock;
  exec: jest.Mock;
  chain: ChainableCommander;
} {
  const chain = {
    del: jest.fn(),
    exec: jest.fn().mockResolvedValue([]),
  };
  chain.del.mockImplementation(() => chain as unknown as ChainableCommander);
  return {
    del: chain.del,
    exec: chain.exec,
    chain: chain as unknown as ChainableCommander,
  };
}

describe('VirtualUserWorker', () => {
  let worker: VirtualUserWorker;
  let workerTest: VirtualUserWorkerTest;
  let redisService: jest.Mocked<RedisService>;
  let reservationService: jest.Mocked<ReservationService>;
  let configService: jest.Mocked<TicketConfigService>;

  const defaultVirtualConfig = {
    brpopTimeoutSeconds: 2,
    maxSeatPickAttempts: 10,
    errorDelayMs: 500,
    processDelayMs: 1000,
    thinkingTimeMs: 2000,
    cancelRatio: 0.1,
  };

  const setupRedisForSuccess = (): void => {
    redisService.srandmember
      .mockResolvedValueOnce('1') // sessionId
      .mockResolvedValueOnce('10'); // blockId
    redisService.get.mockResolvedValue(
      JSON.stringify({ rowSize: 5, colSize: 5 }),
    );
  };

  beforeEach(async () => {
    const { chain } = createPipelineMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VirtualUserWorker,
        {
          provide: RedisService,
          useValue: {
            srandmember: jest.fn(),
            get: jest.fn(),
            pipeline: jest.fn(() => chain),
            publishToQueue: jest.fn().mockResolvedValue(1),
          },
        },
        {
          provide: ReservationService,
          useValue: {
            reserve: jest.fn(),
          },
        },
        {
          provide: TicketConfigService,
          useValue: {
            getVirtualConfig: jest.fn().mockReturnValue(defaultVirtualConfig),
            syncAll: jest.fn().mockResolvedValue(undefined),
            isVirtualUserEnabled: jest.fn().mockReturnValue(true),
          },
        },
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

    worker = module.get<VirtualUserWorker>(VirtualUserWorker);
    workerTest = worker as unknown as VirtualUserWorkerTest;
    redisService = module.get(RedisService);
    reservationService = module.get(ReservationService);
    configService = module.get(TicketConfigService);

    workerTest.delay = jest
      .fn<Promise<void>, [number]>()
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('processVirtualUser - 예매 전 지터', () => {
    it('thinkingTimeMs > 0 이면 지터(0.75~1.25)를 곱한 시간만큼 delay 호출한다', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5); // jitter = 0.75 + 0.25 = 1.0
      configService.getVirtualConfig.mockReturnValue({
        ...defaultVirtualConfig,
        thinkingTimeMs: 2000,
      });
      setupRedisForSuccess();
      jest.mocked(reservationService.reserve).mockResolvedValue({
        rank: 1,
        seats: [{ block_id: 10, row: 0, col: 0 }],
        virtual_user_size: 50000,
      });

      await workerTest.processVirtualUser('vu-1', 10);

      const delayCalls: [number][] = workerTest.delay.mock.calls;
      const thinkingDelay = delayCalls.find(
        (call) => call[0] >= 1500 && call[0] <= 2500,
      );
      expect(thinkingDelay).toBeDefined();
      expect(thinkingDelay![0]).toBe(2000); // 2000 * 1.0
    });

    it('thinkingTimeMs가 0이면 예매 전 delay를 호출하지 않는다', async () => {
      configService.getVirtualConfig.mockReturnValue({
        ...defaultVirtualConfig,
        thinkingTimeMs: 0,
      });
      setupRedisForSuccess();
      jest.mocked(reservationService.reserve).mockResolvedValue({
        rank: 1,
        seats: [{ block_id: 10, row: 1, col: 2 }],
        virtual_user_size: 50000,
      });

      await workerTest.processVirtualUser('vu-1', 10);

      expect(workerTest.delay).not.toHaveBeenCalled();
      expect(configService.getVirtualConfig).toHaveBeenCalled();
      expect(reservationService.reserve).toHaveBeenCalled();
    });
  });

  describe('processVirtualUser - 예매 후 취소표', () => {
    it('cancelRatio 확률로 취소 시 Redis 좌석 키를 삭제한다 (취소표 반영)', async () => {
      // Math.random: 0.05 < cancelRatio(0.1) → 취소 발생, reserve mock의 (0,0) 좌석 키 삭제
      jest.spyOn(Math, 'random').mockReturnValue(0.05); // 0.05 < 0.1 → 취소
      configService.getVirtualConfig.mockReturnValue({
        ...defaultVirtualConfig,
        cancelRatio: 0.1,
      });
      setupRedisForSuccess();
      const { chain, del, exec } = createPipelineMock();
      jest.mocked(redisService.pipeline).mockReturnValue(chain);
      jest.mocked(reservationService.reserve).mockResolvedValue({
        rank: 1,
        seats: [{ block_id: 10, row: 0, col: 0 }],
        virtual_user_size: 50000,
      });

      await workerTest.processVirtualUser('vu-1', 10);

      expect(del).toHaveBeenCalledWith(
        'reservation:session:1:block:10:row:0:col:0',
      );
      expect(exec).toHaveBeenCalled();
    });

    it('cancelRatio가 0이면 취소하지 않고 pipeline을 호출하지 않는다', async () => {
      configService.getVirtualConfig.mockReturnValue({
        ...defaultVirtualConfig,
        cancelRatio: 0,
      });
      setupRedisForSuccess();
      jest.mocked(reservationService.reserve).mockResolvedValue({
        rank: 1,
        seats: [{ block_id: 10, row: 0, col: 0 }],
        virtual_user_size: 50000,
      });

      await workerTest.processVirtualUser('vu-1', 10);

      expect(redisService.pipeline).not.toHaveBeenCalled();
    });

    it('취소 시 예약한 좌석 키가 reservation:session:block:row:col 형식으로 삭제된다', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.3); // cancelRatio=1 이므로 항상 취소, reserve mock의 (1,1) 좌석 키 삭제
      configService.getVirtualConfig.mockReturnValue({
        ...defaultVirtualConfig,
        cancelRatio: 1,
      });
      setupRedisForSuccess();
      const { chain, del, exec } = createPipelineMock();
      jest.mocked(redisService.pipeline).mockReturnValue(chain);
      jest.mocked(reservationService.reserve).mockResolvedValue({
        rank: 1,
        seats: [{ block_id: 10, row: 1, col: 1 }],
        virtual_user_size: 50000,
      });

      await workerTest.processVirtualUser('vu-1', 10);

      expect(del).toHaveBeenCalledWith(
        'reservation:session:1:block:10:row:1:col:1',
      );
      expect(exec).toHaveBeenCalled();
    });
  });

  describe('processVirtualUser - 세션/블록 없음', () => {
    it('현재 티켓팅 회차가 없으면 releaseActiveUser(no_session) 호출', async () => {
      redisService.srandmember.mockResolvedValue(null);

      await workerTest.processVirtualUser('vu-1', 10);

      expect(redisService.publishToQueue).toHaveBeenCalledWith(
        REDIS_CHANNELS.QUEUE_EVENT_DONE,
        'vu-1',
      );
      expect(reservationService.reserve).not.toHaveBeenCalled();
    });

    it('블록이 없으면 releaseActiveUser(no_block) 호출', async () => {
      redisService.srandmember
        .mockResolvedValueOnce('1')
        .mockResolvedValueOnce(null);

      await workerTest.processVirtualUser('vu-1', 10);

      expect(redisService.publishToQueue).toHaveBeenCalledWith(
        REDIS_CHANNELS.QUEUE_EVENT_DONE,
        'vu-1',
      );
      expect(reservationService.reserve).not.toHaveBeenCalled();
    });

    it('블록 정보가 없으면 releaseActiveUser(no_block_data) 호출', async () => {
      redisService.srandmember
        .mockResolvedValueOnce('1')
        .mockResolvedValueOnce('10');
      redisService.get.mockResolvedValue(null);

      await workerTest.processVirtualUser('vu-1', 10);

      expect(redisService.publishToQueue).toHaveBeenCalledWith(
        REDIS_CHANNELS.QUEUE_EVENT_DONE,
        'vu-1',
      );
      expect(reservationService.reserve).not.toHaveBeenCalled();
    });
  });

  describe('processVirtualUser - 예약 실패 처리', () => {
    it('TicketException(TICKETING_NOT_OPEN) 시 releaseActiveUser(ticketing_closed) 호출', async () => {
      setupRedisForSuccess();
      jest
        .mocked(reservationService.reserve)
        .mockRejectedValue(
          new TicketException(
            TICKET_ERROR_CODES.TICKETING_NOT_OPEN,
            '티켓팅이 열려있지 않습니다.',
            403,
          ),
        );

      await workerTest.processVirtualUser('vu-1', 10);

      expect(redisService.publishToQueue).toHaveBeenCalledWith(
        REDIS_CHANNELS.QUEUE_EVENT_DONE,
        'vu-1',
      );
    });

    it('TicketException(좌석 오류) 시 재시도 후 한도 초과하면 releaseActiveUser(max_attempts) 호출', async () => {
      configService.getVirtualConfig.mockReturnValue({
        ...defaultVirtualConfig,
        maxSeatPickAttempts: 2,
      });
      setupRedisForSuccess();
      jest
        .mocked(reservationService.reserve)
        .mockRejectedValue(
          new TicketException(
            TICKET_ERROR_CODES.SEATS_ALREADY_RESERVED,
            '이미 예약된 좌석이 포함되어 있습니다.',
            400,
          ),
        );

      await workerTest.processVirtualUser('vu-1', 2);

      expect(redisService.publishToQueue).toHaveBeenCalledWith(
        REDIS_CHANNELS.QUEUE_EVENT_DONE,
        'vu-1',
      );
    });
  });
});
