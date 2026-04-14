/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { TicketSetupService } from './ticket-setup.service';
import {
  PerformanceApiService,
  PerformanceDto,
  SessionResponse,
  VenueResponse,
} from '../performance-api/performance-api.service';
import { RedisService } from '../redis/redis.service';
import { REDIS_CHANNELS, REDIS_KEYS } from '@neticket/contracts';
import { TraceService } from '@neticket/common';

describe('TicketSetupService', () => {
  let service: TicketSetupService;
  let performanceApi: jest.Mocked<PerformanceApiService>;
  let redisService: jest.Mocked<RedisService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketSetupService,
        {
          provide: TraceService,
          useValue: {
            getTraceId: jest.fn(),
            getOrCreateTraceId: jest.fn().mockReturnValue('trace-id'),
            runWithTraceId: jest.fn((_id: string, fn: () => unknown) => fn()),
            generateTraceId: jest.fn().mockReturnValue('trace-id'),
          },
        },
        {
          provide: PerformanceApiService,
          useValue: {
            getPerformances: jest.fn(),
            getSessions: jest.fn(),
            getVenueWithBlocks: jest.fn(),
          },
        },
        {
          provide: RedisService,

          useValue: {
            set: jest.fn().mockResolvedValue('OK'),
            sadd: jest.fn(),
            del: jest.fn(),
            deleteAllExceptPrefix: jest.fn(),
            deleteAllExceptPrefixQueue: jest.fn(),
            publishToCore: jest.fn().mockResolvedValue(1),
          },
        },
      ],
    }).compile();

    service = module.get<TicketSetupService>(TicketSetupService);
    performanceApi = module.get(PerformanceApiService);
    redisService = module.get(RedisService);
  });

  describe('setup', () => {
    it('공연 목록이 비어있으면 에러를 던져야 한다', async () => {
      performanceApi.getPerformances.mockResolvedValue([]);

      await expect(service.setup()).rejects.toThrow(
        '공연 정보가 존재하지 않습니다.',
      );
      expect(
        jest.mocked(redisService.deleteAllExceptPrefix),
      ).toHaveBeenCalledWith('config:');
      expect(
        jest.mocked(redisService.deleteAllExceptPrefixQueue),
      ).toHaveBeenCalledWith('config:');
    });

    it('정상적으로 공연 및 좌석 정보를 조회하여 Redis에 저장해야 한다', async () => {
      const mockPerformance: PerformanceDto = {
        performance_id: 1,
        performance_name: 'Test',
        ticketing_date: '2026-01-01',
      };
      const mockSessions: SessionResponse[] = [
        { id: 1, performanceId: 1, venueId: 10, sessionDate: '2026-01-01' },
      ];
      const mockVenue: VenueResponse = {
        id: 10,
        venueName: 'Venue',
        blocks: [{ id: 100, blockDataName: 'A', rowSize: 10, colSize: 10 }],
      };

      performanceApi.getPerformances.mockResolvedValue([mockPerformance]);
      performanceApi.getSessions.mockResolvedValue(mockSessions);
      performanceApi.getVenueWithBlocks.mockResolvedValue(mockVenue);

      await service.setup();

      expect(
        jest.mocked(redisService.deleteAllExceptPrefix),
      ).toHaveBeenCalledWith('config:');
      expect(
        jest.mocked(redisService.deleteAllExceptPrefixQueue),
      ).toHaveBeenCalledWith('config:');
      expect(jest.mocked(performanceApi.getPerformances)).toHaveBeenCalledWith(
        1,
      );
      expect(jest.mocked(performanceApi.getSessions)).toHaveBeenCalledWith(1);
      expect(
        jest.mocked(performanceApi.getVenueWithBlocks),
      ).toHaveBeenCalledWith(10);

      const expectedSaddKey = 'session:1:blocks';
      const expectedSaddValue = '100';
      expect(jest.mocked(redisService.sadd)).toHaveBeenCalledWith(
        expectedSaddKey,
        expectedSaddValue,
      );

      const expectedKey = 'block:100';
      const expectedData = JSON.stringify({ rowSize: 10, colSize: 10 });
      expect(jest.mocked(redisService.sadd)).toHaveBeenCalledWith(
        REDIS_KEYS.CURRENT_TICKETING_SESSIONS,
        '1',
      );
      expect(jest.mocked(redisService.set)).toHaveBeenCalledWith(
        expectedKey,
        expectedData,
      );
      expect(jest.mocked(redisService.publishToCore)).toHaveBeenCalledWith(
        REDIS_CHANNELS.TICKETING_STATE_CHANGED,
        'setup',
      );
    });
  });

  describe('openTicketing', () => {
    it('티켓팅 상태를 open(true)으로 설정해야 한다', async () => {
      await service.openTicketing();
      expect(jest.mocked(redisService.set)).toHaveBeenCalledWith(
        REDIS_KEYS.TICKETING_OPEN,
        'true',
      );
      expect(jest.mocked(redisService.publishToCore)).toHaveBeenCalledWith(
        REDIS_CHANNELS.TICKETING_STATE_CHANGED,
        '{"userId":"open","traceId":"trace-id"}',
      );
    });

    it('실패 시 티켓팅 상태를 close(false)로 되돌려야 한다', async () => {
      redisService.set.mockRejectedValueOnce(new Error('Redis Error'));

      await service.openTicketing();

      expect(jest.mocked(redisService.set)).toHaveBeenCalledWith(
        REDIS_KEYS.TICKETING_OPEN,
        'false',
      );
    });
  });

  describe('tearDown', () => {
    it('티켓팅 상태를 close(false)로 설정해야 한다', async () => {
      await service.tearDown();
      expect(jest.mocked(redisService.set)).toHaveBeenCalledWith(
        REDIS_KEYS.TICKETING_OPEN,
        'false',
      );
      expect(jest.mocked(redisService.del)).toHaveBeenCalledWith(
        REDIS_KEYS.CURRENT_TICKETING_SESSIONS,
      );
      expect(jest.mocked(redisService.publishToCore)).toHaveBeenCalledWith(
        REDIS_CHANNELS.TICKETING_STATE_CHANGED,
        '{"userId":"close","traceId":"trace-id"}',
      );
    });
  });
});
