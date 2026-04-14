import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Performance } from './entities/performance.entity';
import { CreatePerformanceRequestDto } from './dto/create-performance-request.dto';
import { Venue } from '../venues/entities/venue.entity';
import { SearchPerformancesRequestDto } from './dto/search-performances-request.dto';
import { SearchPerformancesResponseDto } from './dto/search-performances-response.dto';
import { PerformancesRepository } from './performances.repository';
import { CreateSessionRequestDto } from './dto/create-session-request.dto';
import { GetSessionsResponseDto } from './dto/get-sessions-response.dto';
import { Session } from './entities/session.entity';
import { SessionsRepository } from './sessions.repository';
import { GradesRepository } from './grades.repository';
import { BlockGradesRepository } from './block-grades.repository';
import { CreateGradeRequestDto } from './dto/create-grade-request.dto';
import { CreateBlockGradeRequestDto } from './dto/create-block-grade-request.dto';
import { GetGradeResponseDto } from './dto/get-grade-response.dto';
import { GetBlockGradeResponseDto } from './dto/get-block-grade-response.dto';
import { API_ERROR_CODES, TicketException } from '@neticket/common';

@Injectable()
export class PerformancesService {
  constructor(
    private performancesRepository: PerformancesRepository,
    private sessionsRepository: SessionsRepository,
    private gradesRepository: GradesRepository,
    private blockGradesRepository: BlockGradesRepository,
    @InjectRepository(Venue)
    private venuesRepository: Repository<Venue>,
  ) {}

  async create(
    requestDto: CreatePerformanceRequestDto,
  ): Promise<{ id: number }> {
    const performance = new Performance(
      requestDto.kopis_id,
      requestDto.performance_name,
      new Date(requestDto.ticketing_date),
      requestDto.platform,
      requestDto.poster_url,
      requestDto.platform_ticketing_url,
      requestDto.cast_info,
      requestDto.runtime,
      requestDto.age_limit,
    );
    const savedPerformance =
      await this.performancesRepository.save(performance);
    return { id: savedPerformance.id };
  }

  async search(
    requestDto: SearchPerformancesRequestDto,
  ): Promise<SearchPerformancesResponseDto> {
    if (!requestDto.ticketing_after) {
      requestDto.ticketing_after = new Date().toISOString();
    }
    requestDto.limit = requestDto.limit ?? 10;
    const performances = await this.performancesRepository.search(requestDto);

    return SearchPerformancesResponseDto.fromEntities(performances);
  }

  async createSession(
    performanceId: number,
    requestDto: CreateSessionRequestDto,
  ): Promise<{ id: number }> {
    const performance = await this.performancesRepository.findOne({
      where: { id: performanceId },
    });
    if (!performance) {
      throw new TicketException(
        API_ERROR_CODES.PERFORMANCE_NOT_FOUND,
        '공연 정보를 찾을 수 없습니다.',
        404,
      );
    }

    const venue = await this.venuesRepository.findOne({
      where: { id: requestDto.venue_id },
    });
    if (!venue) {
      throw new TicketException(
        API_ERROR_CODES.VENUE_NOT_FOUND,
        '공연장을 찾을 수 없습니다.',
        404,
      );
    }

    const session = new Session(
      performanceId,
      new Date(requestDto.sessionDate),
      requestDto.venue_id,
    );
    const savedSession = await this.sessionsRepository.save(session);
    return { id: savedSession.id };
  }

  async getSessions(performanceId: number): Promise<GetSessionsResponseDto[]> {
    const sessions =
      await this.sessionsRepository.findByPerformanceId(performanceId);
    return GetSessionsResponseDto.fromEntities(sessions);
  }

  async createGrades(
    sessionId: number,
    requestDtos: CreateGradeRequestDto[],
  ): Promise<void> {
    const session = await this.sessionsRepository.findOne({
      where: { id: sessionId },
    });
    if (!session) {
      throw new TicketException(
        API_ERROR_CODES.SESSION_NOT_FOUND,
        '회차 정보를 찾을 수 없습니다.',
        404,
      );
    }

    await this.gradesRepository.createMany(sessionId, requestDtos);
  }

  async getGrades(sessionId: number): Promise<GetGradeResponseDto[]> {
    const grades = await this.gradesRepository.findBySessionId(sessionId);
    return GetGradeResponseDto.fromEntities(grades);
  }

  async createBlockGrades(
    sessionId: number,
    requestDtos: CreateBlockGradeRequestDto[],
  ): Promise<void> {
    const session = await this.sessionsRepository.findOne({
      where: { id: sessionId },
    });
    if (!session) {
      throw new TicketException(
        API_ERROR_CODES.SESSION_NOT_FOUND,
        '회차 정보를 찾을 수 없습니다.',
        404,
      );
    }

    // Validation: Check for duplicates
    const allBlockIds = requestDtos.flatMap((dto) => dto.blockIds);
    const existingMappings =
      await this.blockGradesRepository.findBySessionAndBlocks(
        sessionId,
        allBlockIds,
      );

    if (existingMappings.length > 0) {
      throw new TicketException(
        API_ERROR_CODES.BLOCK_GRADE_ALREADY_ASSIGNED,
        '일부 블록은 이미 등급이 지정되어 있습니다.',
        409,
      );
    }

    const mappings = requestDtos.flatMap((dto) =>
      dto.blockIds.map((blockId) => ({ gradeId: dto.gradeId, blockId })),
    );

    await this.blockGradesRepository.createMany(sessionId, mappings);
  }

  async getBlockGrades(sessionId: number): Promise<GetBlockGradeResponseDto[]> {
    const blockGrades =
      await this.blockGradesRepository.findBySessionId(sessionId);
    return GetBlockGradeResponseDto.fromEntities(blockGrades);
  }
}
