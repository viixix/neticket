import { ApiProperty } from '@nestjs/swagger';

export class GetReservationsResponseDto {
  @ApiProperty({
    description: '좌석 예약 현황 (2차원 배열, true: 예약됨, false: 빈 좌석)',
    example: [
      [true, false],
      [false, true],
    ],
    type: 'array',
    items: { type: 'array', items: { type: 'boolean' } },
  })
  seats: boolean[][];
}
