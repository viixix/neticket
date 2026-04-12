import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateVenueRequestDto {
  @ApiProperty({ description: '공연장 이름', example: '인천 남동 체육관' })
  @IsString()
  @IsNotEmpty()
  venue_name: string;

  @ApiProperty({
    description: '좌석 배치도(SVG) URL',
    example: '/static/svg/incheon_namdong_gymnasium.svg',
    required: false,
  })
  @IsString()
  @IsOptional()
  block_map_url?: string;
}
