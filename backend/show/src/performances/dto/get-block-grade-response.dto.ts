import { ApiProperty } from '@nestjs/swagger';
import { BlockGrade } from '../entities/block-grade.entity';
import { GetGradeResponseDto } from './get-grade-response.dto';

export class GetBlockGradeResponseDto {
  @ApiProperty({ description: '구역 ID', example: 101 })
  blockId: number;

  @ApiProperty({ description: '등급 정보' })
  grade: GetGradeResponseDto;

  static fromEntity(blockGrade: BlockGrade): GetBlockGradeResponseDto {
    const dto = new GetBlockGradeResponseDto();
    dto.blockId = blockGrade.blockId;
    if (blockGrade.grade) {
      dto.grade = GetGradeResponseDto.fromEntity(blockGrade.grade);
    }
    return dto;
  }

  static fromEntities(blockGrades: BlockGrade[]): GetBlockGradeResponseDto[] {
    return blockGrades.map((bg) => this.fromEntity(bg));
  }
}
