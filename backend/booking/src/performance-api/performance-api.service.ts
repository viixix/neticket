import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

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
  private readonly baseUrl =
    process.env.PERFORMANCE_API_URL || 'http://localhost:3002';

  constructor(private readonly httpService: HttpService) {}

  async getPerformances(limit: number = 1): Promise<PerformanceDto[]> {
    const { data } = await firstValueFrom(
      this.httpService.get<SearchPerformancesResponse>(
        `${this.baseUrl}/api/performances`,
        {
          params: { limit },
        },
      ),
    );
    return data.performances;
  }

  async getSessions(performanceId: number): Promise<SessionResponse[]> {
    const { data } = await firstValueFrom(
      this.httpService.get<SessionResponse[]>(
        `${this.baseUrl}/api/performances/${performanceId}/sessions`,
      ),
    );
    return data;
  }

  async getVenueWithBlocks(venueId: number): Promise<VenueResponse> {
    const { data } = await firstValueFrom(
      this.httpService.get<VenueResponse>(
        `${this.baseUrl}/api/venues/${venueId}`,
      ),
    );
    return data;
  }
}
