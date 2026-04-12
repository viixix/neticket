import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class Seat {
  @ApiProperty({ description: '공연장 구역 ID', example: 1 })
  @IsNumber()
  block_id: number;

  @ApiProperty({ description: '좌석 행 번호', example: 1 })
  @IsNumber()
  row: number;

  @ApiProperty({ description: '좌석 열 번호', example: 5 })
  @IsNumber()
  col: number;
}

export class CreateReservationRequestDto {
  @ApiProperty({ description: '공연 회차 ID', example: 1 })
  @IsNumber()
  @IsNotEmpty()
  session_id: number;

  @ApiProperty({
    description: '예약할 좌석 목록',
    type: [Seat],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Seat)
  seats: Seat[];
}
