import { QueueEntryResponse } from '@neticket/shared-types';
import { ApiProperty } from '@nestjs/swagger';

export class QueueEntryResponseDto implements QueueEntryResponse {
  @ApiProperty({ description: '유저 ID', example: 'uGxk5wTQ5VQw9Hqz' })
  userId: string;

  @ApiProperty({ nullable: true, description: '대기 순번', example: 1 })
  position: number | null;
}
