import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { PerformancesService } from './performances.service';
import { CreatePerformanceRequestDto } from './dto/create-performance-request.dto';
import { SearchPerformancesRequestDto } from './dto/search-performances-request.dto';
import {
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { SearchPerformancesResponseDto } from './dto/search-performances-response.dto';
import { CreateSessionRequestDto } from './dto/create-session-request.dto';
import { GetSessionsResponseDto } from './dto/get-sessions-response.dto';

@ApiTags('공연')
@Controller('performances')
@ApiExtraModels(GetSessionsResponseDto)
export class PerformancesController {
  constructor(private readonly performancesService: PerformancesService) {}

  @Post()
  @ApiOperation({ summary: '공연 생성' })
  @ApiResponse({
    status: 201,
    description: '성공적으로 공연이 생성됨',
    schema: { example: { id: 1 } },
  })
  async create(
    @Body() createPerformanceRequestDto: CreatePerformanceRequestDto,
  ) {
    return this.performancesService.create(createPerformanceRequestDto);
  }

  @Get()
  @ApiOperation({ summary: '최신 공연 목록 조회' })
  @ApiResponse({
    status: 200,
    type: SearchPerformancesResponseDto,
    description: '성공적으로 목록을 조회함',
  })
  async search(
    @Query() searchPerformancesRequestDto: SearchPerformancesRequestDto,
  ) {
    return this.performancesService.search(searchPerformancesRequestDto);
  }

  @Post(':id/sessions')
  @ApiOperation({ summary: '공연 회차 생성' })
  @ApiParam({ name: 'id', description: '공연 ID', example: 1 })
  @ApiResponse({
    status: 201,
    description: '성공적으로 회차가 생성됨',
    schema: { example: { id: 1 } },
  })
  async createSession(
    @Param('id', ParseIntPipe) id: number,
    @Body() createSessionRequestDto: CreateSessionRequestDto,
  ): Promise<{ id: number }> {
    return this.performancesService.createSession(id, createSessionRequestDto);
  }

  @Get(':id/sessions')
  @ApiOperation({ summary: '공연 회차 조회' })
  @ApiParam({ name: 'id', description: '공연 ID', example: 1 })
  @ApiResponse({
    status: 200,
    description: '성공적으로 회차 목록을 조회함',
    schema: {
      type: 'array',
      items: { $ref: getSchemaPath(GetSessionsResponseDto) },
      example: [
        {
          id: 1,
          performanceId: 1,
          venueId: 1,
          sessionDate: '2026-01-14T14:00:00Z',
        },
        {
          id: 2,
          performanceId: 1,
          venueId: 2,
          sessionDate: '2026-01-14T19:00:00Z',
        },
      ],
    },
  })
  async getSessions(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<GetSessionsResponseDto[]> {
    return this.performancesService.getSessions(id);
  }
}
