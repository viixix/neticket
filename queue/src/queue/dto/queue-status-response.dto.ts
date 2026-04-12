import { QueueStatusResponse } from '@neticket/shared-types';
import { ApiProperty } from '@nestjs/swagger';

export class QueueStatusResponseDto implements QueueStatusResponse {
  @ApiProperty({ nullable: true, description: '대기 순번', example: 1 })
  position: number | null;

  @ApiProperty({
    description: '상태',
    enum: ['open', 'closed'],
    example: 'open',
  })
  status: 'open' | 'closed';

  @ApiProperty({
    required: false,
    description: '활성 토큰',
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJfSkVSUllfLXdhcy1oZXJlIiwidHlwZSI6IlRJQ0tFVElORyIsImlhdCI6MTUxNjIzOTAyMn0.J9jEisc7TwIw8Ri8jZSArVhEcnlMvYQtDqmanlo1Abk',
  })
  token?: string;
}
