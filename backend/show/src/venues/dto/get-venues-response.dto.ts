import { Venue } from '../entities/venue.entity';
import { ApiProperty } from '@nestjs/swagger';

export class VenueDto {
  @ApiProperty({ description: '공연장 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '공연장 이름', example: '인천 남동 체육관' })
  venue_name: string;

  @ApiProperty({
    description: '좌석 배치도 URL',
    example: '/static/svg/incheon_namdong_gymnasium.svg',
    nullable: true,
  })
  block_map_url: string | null;

  static fromEntity(venue: Venue): VenueDto {
    const dto = new VenueDto();
    dto.id = venue.id;
    dto.venue_name = venue.venueName;
    dto.block_map_url = venue.blockMapUrl;
    return dto;
  }
}

export class GetVenuesResponseDto {
  @ApiProperty({ type: [VenueDto], description: '공연장 목록' })
  venues: VenueDto[];

  static fromEntities(venues: Venue[]): GetVenuesResponseDto {
    const dto = new GetVenuesResponseDto();
    dto.venues = venues.map((venue) => VenueDto.fromEntity(venue));
    return dto;
  }
}
