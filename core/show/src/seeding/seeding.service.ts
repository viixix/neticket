import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Venue } from '../venues/entities/venue.entity';
import { Block } from '../venues/entities/block.entity';
import { Performance } from '../performances/entities/performance.entity';
import { Session } from '../performances/entities/session.entity';
import { Grade } from '../performances/entities/grade.entity';
import { BlockGrade } from '../performances/entities/block-grade.entity';
import { VENUES_DATA } from './data/venues.data';
import { PERFORMANCE_NAMES, BLOCK_GRADE_RULES } from './data/performances.data';
import { TraceService } from '@neticket/common';

@Injectable()
export class SeedingService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedingService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Venue)
    private readonly venuesRepository: Repository<Venue>,
    @InjectRepository(Block)
    private readonly blocksRepository: Repository<Block>,
    @InjectRepository(Performance)
    private readonly performancesRepository: Repository<Performance>,
    @InjectRepository(Session)
    private readonly sessionsRepository: Repository<Session>,
    @InjectRepository(Grade)
    private readonly gradesRepository: Repository<Grade>,
    @InjectRepository(BlockGrade)
    private readonly blockGradesRepository: Repository<BlockGrade>,
    private readonly traceService: TraceService,
  ) {}

  onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'dev') {
      // 개발 환경: 현재 시간부터 1시간 뒤까지만 생성 (가벼운 부팅)
      const now = new Date();
      const eightHoursLater = new Date(now.getTime() + 8 * 60 * 60 * 1000);

      void this.traceService.runWithTraceId(
        this.traceService.generateTraceId(),
        async () => {
          this.logger.log('DEV 환경 자동 시딩 프로세스 진입');

          try {
            await this.seed(now, eightHoursLater);
          } catch (err) {
            this.logger.error(
              '자동 시딩 실패',
              err instanceof Error ? err.stack : undefined,
              { startDate: now, endDate: eightHoursLater },
            );
          }
        },
      );
    }
  }

  async seed(startDate: Date, endDate: Date) {
    this.logger.log('시딩 프로세스 시작', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    try {
      await this.initVenuesAndBlocks();

      // ID 매핑을 위한 메모리 로드
      const venues = await this.venuesRepository.find();
      const blocks = await this.blocksRepository.find({ relations: ['venue'] });

      const venueMap = new Map<string, number>();
      for (const v of venues) {
        venueMap.set(v.venueName, v.id);
      }

      const blockMap = new Map<string, number>(); // Key: "VenueName:BlockName" -> Value: BlockId
      for (const b of blocks) {
        blockMap.set(`${b.venue.venueName}:${b.blockDataName}`, b.id);
      }

      // 5분 단위 Loop
      const currentTime = new Date(startDate);
      // 5분 단위로 맞춤 (초, 밀리초 제거)
      currentTime.setSeconds(0, 0);
      const minutes = currentTime.getMinutes();
      currentTime.setMinutes(minutes - (minutes % 5));

      let perfIndex = 0;
      const CHUNK_SIZE = 1000;
      const blockGradesBuffer: BlockGrade[] = [];

      while (currentTime <= endDate) {
        // 1. Performance 생성
        const perfName =
          PERFORMANCE_NAMES[perfIndex % PERFORMANCE_NAMES.length];
        const platform = Math.random() < 0.5 ? 'nol-ticket' : 'yes24';
        const performance = new Performance(
          undefined,
          perfName,
          new Date(currentTime),
          platform,
          `https://kopis.or.kr/upload/pfmPoster/PF_PF282670_260106_112803.jpg`,
        );
        const savedPerformance =
          await this.performancesRepository.save(performance);

        // 2. Session 생성 (1~3개 랜덤)
        const sessionCount = Math.floor(Math.random() * 3) + 1;
        const targetVenue = venues[Math.floor(Math.random() * venues.length)];

        for (let i = 0; i < sessionCount; i++) {
          const sessionTime = new Date(savedPerformance.ticketingDate);
          sessionTime.setDate(sessionTime.getDate() + 30 + i); // 티켓팅 한 달 뒤 공연

          const session = new Session(
            savedPerformance.id,
            sessionTime,
            targetVenue.id,
          );
          const savedSession = await this.sessionsRepository.save(session); // ID 필요

          // 3. Grade 생성 (VIP, R, S, A)
          const gradeConfigs = [
            { name: 'VIP', price: 150000 },
            { name: 'R', price: 120000 },
            { name: 'S', price: 90000 },
            { name: 'A', price: 60000 },
          ];

          const savedGrades: Grade[] = [];
          for (const config of gradeConfigs) {
            const grade = new Grade(savedSession.id, config.name, config.price);
            const savedGrade = await this.gradesRepository.save(grade);
            savedGrades.push(savedGrade);
          }

          // 4. BlockGrade 생성 (규칙 기반)
          const venueRules = (
            BLOCK_GRADE_RULES as Record<string, Record<string, string[]>>
          )[targetVenue.venueName];
          if (!venueRules) {
            this.logger.warn(`공연장 규칙 없음: ${targetVenue.venueName}`);
            continue;
          }

          // 구역별 등급 매핑
          const gradeNameMap = new Map<string, number>();
          for (const g of savedGrades) {
            gradeNameMap.set(g.name, g.id);
          }

          for (const [gradeName, blockNames] of Object.entries(venueRules)) {
            const gradeId = gradeNameMap.get(gradeName);
            if (!gradeId) continue;

            for (const blockName of blockNames) {
              const blockId = blockMap.get(
                `${targetVenue.venueName}:${blockName}`,
              );
              if (!blockId) {
                continue;
              }
              const blockGrade = new BlockGrade(
                savedSession.id,
                blockId,
                gradeId,
              );
              blockGradesBuffer.push(blockGrade);
            }
          }
        }

        if (blockGradesBuffer.length >= CHUNK_SIZE) {
          await this.blockGradesRepository.save(blockGradesBuffer);
          blockGradesBuffer.length = 0;
          this.logger.debug('Block grade 청크 flush 완료', {
            chunkSize: CHUNK_SIZE,
          });
        }

        perfIndex++;
        currentTime.setMinutes(currentTime.getMinutes() + 5);
      }

      if (blockGradesBuffer.length > 0) {
        await this.blockGradesRepository.save(blockGradesBuffer);
      }

      this.logger.log('시딩 프로세스 완료');
    } catch (error) {
      this.logger.error(
        '시딩 중 오류 발생',
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private async initVenuesAndBlocks() {
    const venueCount = await this.venuesRepository.count();
    if (venueCount > 0) {
      this.logger.debug('Venues 데이터 존재함, 초기화 생략');
      return;
    }

    this.logger.log('Venues/Blocks 데이터 초기화 시작');
    for (const venueData of VENUES_DATA) {
      const venue = new Venue(venueData.name, venueData.url);
      const savedVenue = await this.venuesRepository.save(venue);

      const blocks = venueData.blocks.map(
        (b) => new Block(savedVenue.id, b.name, b.rows, b.cols),
      );
      await this.blocksRepository.save(blocks);
    }
  }
}
