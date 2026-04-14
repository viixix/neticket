import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { PerformanceApiService } from './performance-api.service';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';

describe('PerformanceApiService', () => {
  let service: PerformanceApiService;

  const mockHttpService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PerformanceApiService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    service = module.get<PerformanceApiService>(PerformanceApiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPerformances 호출 시', () => {
    const mockPerformances = [
      {
        performance_id: 1,
        performance_name: '테스트 공연',
        ticketing_date: '2026-01-01T10:00:00Z',
      },
    ];
    const mockResponse: Partial<AxiosResponse> = {
      data: { performances: mockPerformances },
      status: 200,
    };

    describe('유효한 요청이 주어지면', () => {
      beforeEach(() => {
        mockHttpService.get.mockReturnValue(of(mockResponse));
      });

      it('공연 목록을 반환해야 한다', async () => {
        const result = await service.getPerformances(1);
        expect(result).toEqual(mockPerformances);
      });

      it('올바른 엔드포인트로 요청을 보내야 한다', async () => {
        await service.getPerformances(1);
        expect(mockHttpService.get).toHaveBeenCalledWith(
          expect.stringContaining('/api/performances'),
          expect.objectContaining({ params: { limit: 1 } }),
        );
      });
    });

    describe('API 호출이 실패하면', () => {
      beforeEach(() => {
        mockHttpService.get.mockReturnValue(
          throwError(() => new Error('API Error')),
        );
      });

      it('에러를 던져야 한다', async () => {
        await expect(service.getPerformances(1)).rejects.toThrow('API Error');
      });
    });
  });

  describe('getSessions 호출 시', () => {
    const mockSessions = [
      {
        id: 1,
        performanceId: 1,
        venueId: 1,
        sessionDate: '2026-01-02T19:00:00Z',
      },
    ];
    const mockResponse: Partial<AxiosResponse> = {
      data: mockSessions,
      status: 200,
    };

    describe('유효한 공연 ID가 주어지면', () => {
      beforeEach(() => {
        mockHttpService.get.mockReturnValue(of(mockResponse));
      });

      it('회차 목록을 반환해야 한다', async () => {
        const result = await service.getSessions(1);
        expect(result).toEqual(mockSessions);
      });

      it('올바른 엔드포인트로 요청을 보내야 한다', async () => {
        await service.getSessions(1);
        expect(mockHttpService.get).toHaveBeenCalledWith(
          expect.stringContaining('/api/performances/1/sessions'),
        );
      });
    });

    describe('API 호출이 실패하면', () => {
      beforeEach(() => {
        mockHttpService.get.mockReturnValue(
          throwError(() => new Error('API Error')),
        );
      });

      it('에러를 던져야 한다', async () => {
        await expect(service.getSessions(1)).rejects.toThrow('API Error');
      });
    });
  });

  describe('getVenueWithBlocks 호출 시', () => {
    const mockVenue = {
      id: 1,
      venueName: '테스트 공연장',
      blocks: [{ id: 1, blockDataName: 'A-1', rowSize: 10, colSize: 10 }],
    };
    const mockResponse: Partial<AxiosResponse> = {
      data: mockVenue,
      status: 200,
    };

    describe('유효한 공연장 ID가 주어지면', () => {
      beforeEach(() => {
        mockHttpService.get.mockReturnValue(of(mockResponse));
      });

      it('공연장 정보를 반환해야 한다', async () => {
        const result = await service.getVenueWithBlocks(1);
        expect(result).toEqual(mockVenue);
      });

      it('구역 정보가 포함되어야 한다', async () => {
        const result = await service.getVenueWithBlocks(1);
        expect(result.blocks).toBeDefined();
        expect(result.blocks.length).toBeGreaterThan(0);
      });

      it('올바른 엔드포인트로 요청을 보내야 한다', async () => {
        await service.getVenueWithBlocks(1);
        expect(mockHttpService.get).toHaveBeenCalledWith(
          expect.stringContaining('/api/venues/1'),
        );
      });
    });

    describe('API 호출이 실패하면', () => {
      beforeEach(() => {
        mockHttpService.get.mockReturnValue(
          throwError(() => new Error('API Error')),
        );
      });

      it('에러를 던져야 한다', async () => {
        await expect(service.getVenueWithBlocks(1)).rejects.toThrow(
          'API Error',
        );
      });
    });
  });
});
