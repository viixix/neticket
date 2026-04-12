import { Performance } from '../entities/performance.entity';
import { ApiProperty } from '@nestjs/swagger';

export class PerformanceDto {
  @ApiProperty({ description: '공연 ID', example: 1 })
  performance_id: number;

  @ApiProperty({
    description: '공연 이름',
    example: 'wave to earth - 사랑으로 0.3',
  })
  performance_name: string;

  @ApiProperty({
    description: '포스터 이미지 url',
    example: 'https://example.com/poster.jpg',
    nullable: true,
  })
  poster_url: string | null;

  @ApiProperty({
    description: '티켓팅 시작 일시 (ISO 8601)',
    example: '2026-01-01T10:00:00Z',
  })
  ticketing_date: string;

  @ApiProperty({
    description: '티켓팅 플랫폼',
    example: 'nol-ticket',
    enum: ['nol-ticket', 'yes24', 'melon-ticket', 'interpark'],
  })
  platform: 'nol-ticket' | 'yes24' | 'melon-ticket' | 'interpark';

  @ApiProperty({
    description: '실제 예매처 티켓팅 페이지 URL',
    example: 'https://tickets.interpark.com/goods/22000000',
    nullable: true,
  })
  platform_ticketing_url: string | null;

  @ApiProperty({
    description: '출연진 정보',
    example: '홍길동, 김철수',
    nullable: true,
  })
  cast_info: string | null;

  @ApiProperty({
    description: '공연 런타임',
    example: '120분',
    nullable: true,
  })
  runtime: string | null;

  @ApiProperty({
    description: '관람 연령 제한',
    example: '만 7세 이상',
    nullable: true,
  })
  age_limit: string | null;

  static fromEntity(performance: Performance): PerformanceDto {
    const dto = new PerformanceDto();
    dto.performance_id = performance.id;
    dto.performance_name = performance.performanceName;
    dto.poster_url = performance.posterUrl;
    dto.ticketing_date = performance.ticketingDate.toISOString();
    dto.platform = performance.platform;
    dto.platform_ticketing_url = performance.platformTicketingUrl;
    dto.cast_info = performance.castInfo;
    dto.runtime = performance.runtime;
    dto.age_limit = performance.ageLimit;
    return dto;
  }
}

export class SearchPerformancesResponseDto {
  @ApiProperty({ type: [PerformanceDto], description: '검색된 공연 목록' })
  performances: PerformanceDto[];

  static fromEntities(
    performances: Performance[],
  ): SearchPerformancesResponseDto {
    const dto = new SearchPerformancesResponseDto();
    dto.performances = performances.map((performance) =>
      PerformanceDto.fromEntity(performance),
    );
    return dto;
  }
}
