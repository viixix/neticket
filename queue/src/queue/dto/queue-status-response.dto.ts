import { QueueStatusResponse } from '@neticket/contracts';
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
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJfSkVSUllfLXdhcy1oZXJlIiwidHlwZSI6IlRJQ0tFVElORyIsInNlc3Npb25JZHMiOlsxLDIsM10sImlhdCI6MTc0NDU2MDAwMCwiZXhwIjoxNzQ0NTYzNjAwfQ.ocqkG_uac5KzV2tTQdeCwAiNh3jTQsj4nkCUXUSuN5s',
  })
  token?: string;
}
