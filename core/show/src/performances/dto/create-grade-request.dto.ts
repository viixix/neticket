import { ApiProperty } from '@nestjs/swagger';

export class CreateGradeRequestDto {
  @ApiProperty({ description: '등급 명칭', example: 'VIP' })
  name: string;

  @ApiProperty({ description: '가격', example: 150000 })
  price: number;
}
