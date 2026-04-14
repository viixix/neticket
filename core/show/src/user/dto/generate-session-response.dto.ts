import { ApiProperty } from '@nestjs/swagger';

export class GenerateSessionResponseDto {
  @ApiProperty({
    description: '생성된 세션 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  sessionId: string;
}
