import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class GetReservationsRequestDto {
  @ApiProperty({ description: '공연 회차 ID', example: 1 })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  session_id: number;

  @ApiProperty({ description: '공연장 구역 ID', example: 1 })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  block_id: number;
}
