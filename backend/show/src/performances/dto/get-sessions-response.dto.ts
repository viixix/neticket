import { ApiProperty } from '@nestjs/swagger';
import { Session } from '../entities/session.entity';

export class GetSessionsResponseDto {
  @ApiProperty({ description: '회차 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '공연 ID', example: 1 })
  performanceId: number;

  @ApiProperty({ description: '공연장 ID', example: 1 })
  venueId: number;

  @ApiProperty({
    description: '공연 회차 일시 (ISO 8601)',
    example: '2026-01-14T19:00:00Z',
  })
  sessionDate: Date;

  static fromEntity(session: Session): GetSessionsResponseDto {
    const dto = new GetSessionsResponseDto();
    dto.id = session.id;
    dto.performanceId = session.performanceId;
    dto.venueId = session.venueId;
    dto.sessionDate = session.sessionDate;
    return dto;
  }

  static fromEntities(sessions: Session[]): GetSessionsResponseDto[] {
    return sessions.map((session) => this.fromEntity(session));
  }
}
