import { ApiProperty } from '@nestjs/swagger';
import { Venue } from '../entities/venue.entity';
import { Block } from '../entities/block.entity';

export class BlockDto {
  @ApiProperty({ description: '구역 ID', example: 101 })
  id: number;

  @ApiProperty({ description: 'SVG 블록 데이터 이름', example: 'A-1' })
  blockDataName: string;

  @ApiProperty({ description: '가로 좌석 수', example: 10 })
  rowSize: number;

  @ApiProperty({ description: '세로 좌석 수', example: 15 })
  colSize: number;

  static fromEntity(block: Block): BlockDto {
    const dto = new BlockDto();
    dto.id = block.id;
    dto.blockDataName = block.blockDataName;
    dto.rowSize = block.rowSize;
    dto.colSize = block.colSize;
    return dto;
  }
}

export class GetVenueResponseDto {
  @ApiProperty({ description: '공연장 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '공연장 이름', example: '인천 남동 체육관' })
  venueName: string;

  @ApiProperty({
    description: '좌석 배치도(SVG) URL',
    example: '/static/svg/incheon_namdong_gymnasium.svg',
    nullable: true,
  })
  blockMapUrl: string | null;

  @ApiProperty({ type: [BlockDto], description: '구역 목록' })
  blocks: BlockDto[];

  static fromEntity(venue: Venue): GetVenueResponseDto {
    const dto = new GetVenueResponseDto();
    dto.id = venue.id;
    dto.venueName = venue.venueName;
    dto.blockMapUrl = venue.blockMapUrl;
    dto.blocks = venue.blocks
      ? venue.blocks.map((block) => BlockDto.fromEntity(block))
      : [];
    return dto;
  }
}
