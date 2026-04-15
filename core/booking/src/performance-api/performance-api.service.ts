import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { TICKET_ERROR_CODES, TicketException } from '@neticket/common';

export interface PerformanceDto {
  performance_id: number;
  performance_name: string;
  ticketing_date: string;
}

export interface SearchPerformancesResponse {
  performances: PerformanceDto[];
}

export interface SessionResponse {
  id: number;
  performanceId: number;
  venueId: number;
  sessionDate: string;
}

export interface BlockResponse {
  id: number;
  blockDataName: string;
  rowSize: number;
  colSize: number;
}

export interface VenueResponse {
  id: number;
  venueName: string;
  blocks: BlockResponse[];
}

@Injectable()
export class PerformanceApiService {
  private readonly logger = new Logger(PerformanceApiService.name);
  private readonly baseUrl =
    process.env.SHOW_SERVER_URL || 'http://localhost:3001';

  constructor(private readonly httpService: HttpService) {}

  async getPerformances(limit: number = 1): Promise<PerformanceDto[]> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<SearchPerformancesResponse>(
          `${this.baseUrl}/api/performances`,
          { params: { limit } },
        ),
      );
      return data.performances;
    } catch (e) {
      if (e instanceof TicketException) throw e;
      this.logger.error(
        'Show 서버 공연 목록 조회 실패',
        e instanceof Error ? e.stack : undefined,
      );
      throw new TicketException(
        TICKET_ERROR_CODES.SHOW_API_UNAVAILABLE,
        'Show 서버와 통신에 실패했습니다.',
        503,
      );
    }
  }

  async getSessions(performanceId: number): Promise<SessionResponse[]> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<SessionResponse[]>(
          `${this.baseUrl}/api/performances/${performanceId}/sessions`,
        ),
      );
      return data;
    } catch (e) {
      if (e instanceof TicketException) throw e;
      this.logger.error(
        'Show 서버 회차 목록 조회 실패',
        e instanceof Error ? e.stack : undefined,
        { performanceId },
      );
      throw new TicketException(
        TICKET_ERROR_CODES.SHOW_API_UNAVAILABLE,
        'Show 서버와 통신에 실패했습니다.',
        503,
      );
    }
  }

  async getVenueWithBlocks(venueId: number): Promise<VenueResponse> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<VenueResponse>(
          `${this.baseUrl}/api/venues/${venueId}`,
        ),
      );
      return data;
    } catch (e) {
      if (e instanceof TicketException) throw e;
      this.logger.error(
        'Show 서버 공연장 조회 실패',
        e instanceof Error ? e.stack : undefined,
        { venueId },
      );
      throw new TicketException(
        TICKET_ERROR_CODES.SHOW_API_UNAVAILABLE,
        'Show 서버와 통신에 실패했습니다.',
        503,
      );
    }
  }
}
