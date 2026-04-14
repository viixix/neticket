import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePerformanceRequestDto {
  @ApiProperty({
    description: '공연 이름',
    example: 'wave to earth - 사랑으로 0.3',
  })
  @IsString()
  @IsNotEmpty()
  performance_name: string;

  @ApiProperty({
    description: '티켓팅 시작 일시 (ISO 8601, UTC)',
    example: '2026-01-01T13:00:00Z',
    pattern: '^.*Z$',
  })
  @IsISO8601()
  @Matches(/.*Z$/, { message: '날짜는 UTC 형식이어야 합니다 (Z로 끝나야 함)' })
  @IsNotEmpty()
  ticketing_date: string;

  @ApiProperty({
    description: 'KOPIS API 공연 ID (mt20id)',
    required: false,
    example: 'PF123456',
  })
  @IsString()
  @IsOptional()
  kopis_id?: string;

  @ApiProperty({
    description: '티켓팅 플랫폼',
    required: false,
    enum: ['nol-ticket', 'yes24', 'melon-ticket', 'interpark'],
    default: 'nol-ticket',
  })
  @IsEnum(['nol-ticket', 'yes24', 'melon-ticket', 'interpark'])
  @IsOptional()
  platform?: 'nol-ticket' | 'yes24' | 'melon-ticket' | 'interpark';

  @ApiProperty({
    description: '포스터 이미지 URL',
    required: false,
    example: 'https://example.com/poster.jpg',
  })
  @IsUrl()
  @IsOptional()
  poster_url?: string;

  @ApiProperty({
    description: '실제 예매처 티켓팅 페이지 URL',
    required: false,
    example: 'https://ticket.yes24.com/Perf/12345',
  })
  @IsUrl()
  @IsOptional()
  platform_ticketing_url?: string;

  @ApiProperty({
    description: '출연진 정보',
    required: false,
    example: '홍길동, 김철수',
  })
  @IsString()
  @IsOptional()
  cast_info?: string;

  @ApiProperty({
    description: '공연 런타임',
    required: false,
    example: '1시간 30분',
  })
  @IsString()
  @IsOptional()
  runtime?: string;

  @ApiProperty({
    description: '관람 연령 제한',
    required: false,
    example: '만 7세 이상',
  })
  @IsString()
  @IsOptional()
  age_limit?: string;
}
