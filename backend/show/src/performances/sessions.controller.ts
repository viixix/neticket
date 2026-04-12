import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { PerformancesService } from './performances.service';
import { CreateGradeRequestDto } from './dto/create-grade-request.dto';
import { GetGradeResponseDto } from './dto/get-grade-response.dto';
import { CreateBlockGradeRequestDto } from './dto/create-block-grade-request.dto';
import { GetBlockGradeResponseDto } from './dto/get-block-grade-response.dto';

@ApiTags('회차')
@Controller('sessions')
@ApiExtraModels(GetBlockGradeResponseDto)
export class SessionsController {
  constructor(private readonly performancesService: PerformancesService) {}

  @Post(':id/grades')
  @ApiOperation({ summary: '회차 등급 생성' })
  @ApiParam({ name: 'id', description: '회차 ID', example: 1 })
  @ApiBody({
    type: [CreateGradeRequestDto],
    description: '공연 등급 목록',
    examples: {
      '등급 목록': {
        value: [
          { name: 'VIP', price: 150000 },
          { name: 'R', price: 120000 },
          { name: 'S', price: 90000 },
        ],
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: '성공적으로 등급이 생성됨',
  })
  async createGrades(
    @Param('id', ParseIntPipe) sessionId: number,
    @Body() requestDtos: CreateGradeRequestDto[],
  ): Promise<void> {
    return this.performancesService.createGrades(sessionId, requestDtos);
  }

  @Get(':id/grades')
  @ApiOperation({ summary: '회차 등급 조회' })
  @ApiParam({ name: 'id', description: '회차 ID', example: 1 })
  @ApiResponse({
    status: 200,
    description: '성공적으로 등급 목록을 조회함',
    type: [GetGradeResponseDto],
  })
  async getGrades(
    @Param('id', ParseIntPipe) sessionId: number,
  ): Promise<GetGradeResponseDto[]> {
    return this.performancesService.getGrades(sessionId);
  }

  @Post(':id/block-grades')
  @ApiOperation({ summary: '회차 구역 등급 매핑 할당' })
  @ApiParam({ name: 'id', description: '회차 ID', example: 1 })
  @ApiBody({
    type: [CreateBlockGradeRequestDto],
    description: '구역별 등급 매핑 할당 목록',
    examples: {
      '할당 목록': {
        value: [
          { gradeId: 1, blockIds: [1, 2] },
          { gradeId: 2, blockIds: [3, 4] },
        ],
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: '성공적으로 등급이 할당됨',
  })
  @ApiResponse({
    status: 400,
    description: '이미 할당된 구역이 포함되어 있음',
  })
  async createBlockGrades(
    @Param('id', ParseIntPipe) sessionId: number,
    @Body() requestDtos: CreateBlockGradeRequestDto[],
  ): Promise<void> {
    return this.performancesService.createBlockGrades(sessionId, requestDtos);
  }

  @Get(':id/block-grades')
  @ApiOperation({ summary: '회차 구역 등급 매핑 조회' })
  @ApiParam({ name: 'id', description: '회차 ID', example: 1 })
  @ApiResponse({
    status: 200,
    description: '성공적으로 구역별 등급 매핑을 조회함',
    schema: {
      type: 'array',
      items: { $ref: getSchemaPath(GetBlockGradeResponseDto) },
      example: [
        {
          blockId: 1,
          grade: {
            id: 1,
            name: 'VIP',
            price: 150000,
          },
        },
        {
          blockId: 2,
          grade: {
            id: 1,
            name: 'VIP',
            price: 150000,
          },
        },
      ],
    },
  })
  async getBlockGrades(
    @Param('id', ParseIntPipe) sessionId: number,
  ): Promise<GetBlockGradeResponseDto[]> {
    return this.performancesService.getBlockGrades(sessionId);
  }
}
