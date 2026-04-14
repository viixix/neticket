import { ApiProperty } from '@nestjs/swagger';

class Seat {
  @ApiProperty({ description: '공연장 구역 ID', example: 1 })
  block_id: number;

  @ApiProperty({ description: '좌석 행 번호', example: 1 })
  row: number;

  @ApiProperty({ description: '좌석 열 번호', example: 5 })
  col: number;
}

export class CreateReservationResponseDto {
  @ApiProperty({
    description: '해당 회차에서의 예약 순번 (랭킹)',
    example: 123,
  })
  rank: number;

  @ApiProperty({
    description: '예약된 좌석 목록',
    type: [Seat],
  })
  seats: Seat[];

  @ApiProperty({
    description: '설정된 가상 유저 규모 (Queue 설정값)',
    example: 50000,
  })
  virtual_user_size: number;

  @ApiProperty({
    description: '예약 완료 시각 (ISO 8601)',
    example: '2026-02-05T17:00:00.000Z',
  })
  reserved_at: string;
}
