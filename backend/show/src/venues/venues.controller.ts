import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { VenuesService } from './venues.service';
import { CreateVenueRequestDto } from './dto/create-venue-request.dto';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetVenuesResponseDto } from './dto/get-venues-response.dto';
import { GetVenueResponseDto } from './dto/get-venue-response.dto';
import { CreateBlocksRequestDto } from './dto/create-blocks-request.dto';

@ApiTags('공연장')
@Controller('venues')
export class VenuesController {
  constructor(private readonly venuesService: VenuesService) {}

  @Post()
  @ApiOperation({ summary: '공연장 생성' })
  @ApiResponse({
    status: 201,
    description: '성공적으로 공연장이 생성됨',
    schema: { example: { id: 1 } },
  })
  async create(@Body() createVenueRequestDto: CreateVenueRequestDto) {
    return this.venuesService.create(createVenueRequestDto);
  }

  @Post(':id/blocks')
  @ApiOperation({ summary: '공연장 구역 생성' })
  @ApiParam({ name: 'id', description: '공연장 ID', example: 1 })
  @ApiResponse({
    status: 201,
    description: '성공적으로 구역이 생성됨',
  })
  async createBlocks(
    @Param('id', ParseIntPipe) id: number,
    @Body() createBlocksRequestDto: CreateBlocksRequestDto,
  ) {
    return this.venuesService.createBlocks(id, createBlocksRequestDto);
  }

  @Get()
  @ApiOperation({ summary: '공연장 목록 조회' })
  @ApiResponse({
    status: 200,
    description: '성공적으로 목록을 조회함',
    type: GetVenuesResponseDto,
  })
  async findAll() {
    return this.venuesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '공연장 조회 (구역 포함)' })
  @ApiParam({ name: 'id', description: '공연장 ID', example: 1 })
  @ApiResponse({
    status: 200,
    description:
      '성공적으로 공연장 정보를 조회함 (존재하지 않으면 빈 객체 반환)',
    type: GetVenueResponseDto,
    schema: {
      example: {
        id: 1,
        venueName: '인천 남동 체육관',
        blockMapUrl: '/static/svg/incheon_namdong_gymnasium.svg',
        blocks: [
          {
            id: 1,
            blockDataName: 'A-1',
            rowSize: 10,
            colSize: 15,
          },
          {
            id: 2,
            blockDataName: 'B-1',
            rowSize: 10,
            colSize: 15,
          },
          {
            id: 3,
            blockDataName: 'C-1',
            rowSize: 10,
            colSize: 15,
          },
          {
            id: 4,
            blockDataName: 'D-1',
            rowSize: 10,
            colSize: 15,
          },
        ],
      },
    },
  })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const venue = await this.venuesService.findOneWithBlocks(id);
    return venue || {};
  }
}
