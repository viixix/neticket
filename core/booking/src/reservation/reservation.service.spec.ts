/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { TicketException, TraceService } from '@neticket/common';
import { ReservationService } from './reservation.service';
import { REDIS_KEYS } from '@neticket/contracts';
import { RedisService } from '../redis/redis.service';

describe('ReservationService', () => {
  let service: ReservationService;
  let redisService: jest.Mocked<RedisService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationService,
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            mget: jest.fn(),
            sismember: jest.fn(),
            atomicReservation: jest.fn(),
            publishToQueue: jest.fn(),
            del: jest.fn(),
            hgetQueue: jest.fn(),
          },
        },
        {
          provide: TraceService,
          useValue: {
            generateTraceId: jest.fn().mockReturnValue('trace-id'),
            getOrCreateTraceId: jest.fn().mockReturnValue('trace-id'),
            runWithTraceId: jest
              .fn()
              .mockImplementation((_id: string, fn: () => unknown) => fn()),
          },
        },
      ],
    }).compile();

    service = module.get<ReservationService>(ReservationService);
    redisService = module.get(RedisService);
  });

  describe('getSeats', () => {
    const sessionId = 1;
    const blockId = 10;

    it('유효하지 않은 블록이면 TicketException을 던져야 한다', async () => {
      redisService.sismember.mockResolvedValue(false);

      await expect(service.getSeats(sessionId, blockId)).rejects.toThrow(
        TicketException,
      );
    });

    it('블록 정보가 없으면 TicketException을 던져야 한다', async () => {
      redisService.sismember.mockResolvedValue(true);
      redisService.get.mockResolvedValue(null);

      await expect(service.getSeats(sessionId, blockId)).rejects.toThrow(
        TicketException,
      );
    });

    it('정상적인 경우 2차원 배열의 좌석 현황을 반환해야 한다', async () => {
      const mockBlockData = JSON.stringify({ rowSize: 2, colSize: 2 });
      redisService.sismember.mockResolvedValue(true);
      redisService.get.mockResolvedValue(mockBlockData);
      redisService.mget.mockResolvedValue(['user1', null, null, 'user2']);

      const result = await service.getSeats(sessionId, blockId);

      expect(result.seats).toEqual([
        [true, false],
        [false, true],
      ]);
    });
  });

  describe('reserve', () => {
    const dto = {
      session_id: 1,
      seats: [{ block_id: 10, row: 0, col: 0 }],
    };
    const userId = 'user-1';

    it('티켓팅이 오픈되지 않았으면 TicketException을 던져야 한다', async () => {
      redisService.get.mockResolvedValue('false');

      await expect(service.reserve(dto, userId)).rejects.toThrow(
        TicketException,
      );
    });

    it('유효하지 않은 블록이면 TicketException을 던져야 한다', async () => {
      redisService.get.mockResolvedValue('true');
      redisService.sismember.mockResolvedValue(false);

      await expect(service.reserve(dto, userId)).rejects.toThrow(
        TicketException,
      );
    });

    it('좌석 좌표가 범위를 벗어나면 TicketException을 던져야 한다', async () => {
      const mockBlockData = JSON.stringify({ rowSize: 2, colSize: 2 });
      redisService.get.mockImplementation((key) => {
        if (key === REDIS_KEYS.TICKETING_OPEN) return Promise.resolve('true');
        if (key === 'block:10') return Promise.resolve(mockBlockData);
        return Promise.resolve(null);
      });
      redisService.sismember.mockResolvedValue(true);

      const invalidDto = {
        session_id: 1,
        seats: [{ block_id: 10, row: 5, col: 0 }],
      };
      await expect(service.reserve(invalidDto, userId)).rejects.toThrow(
        TicketException,
      );
    });

    it('요청에 중복된 좌석이 있으면 TicketException을 던져야 한다', async () => {
      const mockBlockData = JSON.stringify({ rowSize: 5, colSize: 5 });
      redisService.get.mockImplementation((key) => {
        if (key === REDIS_KEYS.TICKETING_OPEN) return Promise.resolve('true');
        if (key === 'block:10') return Promise.resolve(mockBlockData);
        return Promise.resolve(null);
      });
      redisService.sismember.mockResolvedValue(true);

      const duplicateDto = {
        session_id: 1,
        seats: [
          { block_id: 10, row: 1, col: 1 },
          { block_id: 10, row: 1, col: 1 },
        ],
      };
      await expect(service.reserve(duplicateDto, userId)).rejects.toThrow(
        TicketException,
      );
    });

    it('일부 좌석이 이미 예약되어 있으면 TicketException을 던져야 한다', async () => {
      const mockBlockData = JSON.stringify({ rowSize: 2, colSize: 2 });
      redisService.get.mockImplementation((key) => {
        if (key === REDIS_KEYS.TICKETING_OPEN) return Promise.resolve('true');
        if (key === 'block:10') return Promise.resolve(mockBlockData);
        return Promise.resolve(null);
      });
      redisService.sismember.mockResolvedValue(true);
      redisService.atomicReservation.mockResolvedValue([0, 0]);

      await expect(service.reserve(dto, userId)).rejects.toThrow(
        TicketException,
      );
    });

    it('정상적인 경우 예약을 성공하고 순번을 반환해야 한다', async () => {
      const mockBlockData = JSON.stringify({ rowSize: 2, colSize: 2 });
      redisService.get.mockImplementation((key) => {
        if (key === REDIS_KEYS.TICKETING_OPEN) return Promise.resolve('true');
        if (key === 'block:10') return Promise.resolve(mockBlockData);
        return Promise.resolve(null);
      });
      redisService.sismember.mockResolvedValue(true);
      redisService.atomicReservation.mockResolvedValue([1, 5]);
      redisService.publishToQueue.mockResolvedValue(1);
      redisService.hgetQueue.mockResolvedValue('50000');

      const result = await service.reserve(dto, userId);

      expect(result.rank).toBe(5);
      expect(result.seats).toEqual(dto.seats);
      expect(result.virtual_user_size).toBe(50000);
      expect(result.reserved_at).toBeDefined();
      expect(typeof result.reserved_at).toBe('string');
      expect(redisService.atomicReservation).toHaveBeenCalledWith(
        ['reservation:session:1:block:10:row:0:col:0'],
        userId,
        'rank:session:1',
        'reserved:session:1:user:user-1',
      );
    });

    it('여러 블록의 좌석을 동시에 예약할 수 있어야 한다', async () => {
      redisService.get.mockImplementation((key) => {
        if (key === REDIS_KEYS.TICKETING_OPEN) return Promise.resolve('true');
        if (key === 'block:10')
          return Promise.resolve(JSON.stringify({ rowSize: 5, colSize: 5 }));
        if (key === 'block:11')
          return Promise.resolve(JSON.stringify({ rowSize: 5, colSize: 5 }));
        return Promise.resolve(null);
      });
      redisService.sismember.mockResolvedValue(true);
      redisService.atomicReservation.mockResolvedValue([1, 10]);

      const multiBlockDto = {
        session_id: 1,
        seats: [
          { block_id: 10, row: 1, col: 1 },
          { block_id: 11, row: 2, col: 2 },
        ],
      };

      const result = await service.reserve(multiBlockDto, userId);

      expect(result.rank).toBe(10);
      expect(redisService.atomicReservation).toHaveBeenCalledWith(
        [
          'reservation:session:1:block:10:row:1:col:1',
          'reservation:session:1:block:11:row:2:col:2',
        ],
        userId,
        'rank:session:1',
        'reserved:session:1:user:user-1',
      );
    });
  });
});
