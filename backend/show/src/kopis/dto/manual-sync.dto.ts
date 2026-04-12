import { IsISO8601, Matches, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ManualSyncDto {
  @ApiProperty({
    description:
      '공연 ticketing date 삽입 작업 시작 값 (ISO 8601, UTC). 생략되거나 end_date가 없으면 기본값(내일 00:05)이 사용됩니다.',
    example: '2026-02-01T10:00:00Z',
    pattern: '^.*Z$',
    required: false,
  })
  @IsOptional()
  @IsISO8601()
  @Matches(/.*Z$/, { message: '날짜는 UTC 형식이어야 합니다 (Z로 끝나야 함)' })
  start_date?: string;

  @ApiProperty({
    description:
      '공연 ticketing date 삽입 작업 종료 값 (ISO 8601, UTC). 생략되거나 start_date가 없으면 기본값(내일 24:00)이 사용됩니다.',
    example: '2026-02-01T12:00:00Z',
    pattern: '^.*Z$',
    required: false,
  })
  @IsOptional()
  @IsISO8601()
  @Matches(/.*Z$/, { message: '날짜는 UTC 형식이어야 합니다 (Z로 끝나야 함)' })
  end_date?: string;
}
