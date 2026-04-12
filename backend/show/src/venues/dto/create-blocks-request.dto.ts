import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBlockDto {
  @ApiProperty({ description: 'SVG 블록 데이터 이름', example: 'A-1' })
  @IsString()
  @IsNotEmpty()
  blockDataName: string;

  @ApiProperty({ description: '가로 좌석 수', example: 10 })
  @IsInt()
  @Min(1)
  rowSize: number;

  @ApiProperty({ description: '세로 좌석 수', example: 15 })
  @IsInt()
  @Min(1)
  colSize: number;
}

export class CreateBlocksRequestDto {
  @ApiProperty({
    type: [CreateBlockDto],
    description: '구역 생성 목록',
    example: [
      { blockDataName: 'A-1', rowSize: 10, colSize: 15 },
      { blockDataName: 'B-1', rowSize: 10, colSize: 15 },
      { blockDataName: 'C-1', rowSize: 10, colSize: 15 },
      { blockDataName: 'D-1', rowSize: 10, colSize: 15 },
    ],
  })
  @ValidateNested({ each: true })
  @Type(() => CreateBlockDto)
  blocks: CreateBlockDto[];
}
