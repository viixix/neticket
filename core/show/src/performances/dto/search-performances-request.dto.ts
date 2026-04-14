import { IsISO8601, IsNumber, IsOptional, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SearchPerformancesRequestDto {
  @ApiPropertyOptional({
    description:
      '검색 기준 시간 (ISO 8601, UTC). 입력하지 않으면 현재 시간이 기본값으로 사용됩니다.',
    example: '2026-01-01T00:00:00Z',
    pattern: '^.*Z$',
  })
  @IsISO8601()
  @Matches(/.*Z$/, { message: '날짜는 UTC 형식이어야 합니다 (Z로 끝나야 함)' })
  @IsOptional()
  ticketing_after?: string;

  @ApiPropertyOptional({
    description: '조회할 공연 개수. 입력하지 않으면 기본값 10이 사용됩니다.',
    example: 10,
  })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
