import { ApiProperty } from '@nestjs/swagger';

export class CreateBlockGradeRequestDto {
  @ApiProperty({ description: '등급 ID', example: 1 })
  gradeId: number;

  @ApiProperty({ description: '할당할 구역 ID 목록', example: [101, 102] })
  blockIds: number[];
}
