import { ApiProperty } from '@nestjs/swagger';
import { Grade } from '../entities/grade.entity';

export class GetGradeResponseDto {
  @ApiProperty({ description: '등급 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '등급 명칭', example: 'VIP' })
  name: string;

  @ApiProperty({ description: '가격', example: 150000 })
  price: number;

  static fromEntity(grade: Grade): GetGradeResponseDto {
    const dto = new GetGradeResponseDto();
    dto.id = grade.id;
    dto.name = grade.name;
    dto.price = grade.price;
    return dto;
  }

  static fromEntities(grades: Grade[]): GetGradeResponseDto[] {
    return grades.map((grade) => this.fromEntity(grade));
  }
}
