import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { KopisService } from './kopis.service';
import { DataSource } from 'typeorm';
import { Performance } from '../performances/entities/performance.entity';
import { Session } from '../performances/entities/session.entity';
import { Venue } from '../venues/entities/venue.entity';
import { Grade } from '../performances/entities/grade.entity';
import { BlockGrade } from '../performances/entities/block-grade.entity';
import { Block } from '../venues/entities/block.entity';
import { VENUES_DATA } from '../seeding/data/venues.data';
import { BLOCK_GRADE_RULES } from '../seeding/data/performances.data';

import { isMySqlDuplicateEntryError } from '../common/utils/error.utils';
import {
  API_ERROR_CODES,
  TicketException,
  TraceService,
} from '@neticket/common';

@Injectable()
export class KopisScheduler {
  private readonly logger = new Logger(KopisScheduler.name);

  constructor(
    private readonly kopisService: KopisService,
    private readonly dataSource: DataSource,
    private readonly traceService: TraceService,
  ) {}

  // UTC 14:30 (KST 23:30)
  @Cron('30 14 * * *', { name: 'kopis-sync' })
  async handleCron() {
    await this.traceService.runWithTraceId(
      this.traceService.generateTraceId(),
      async () => {
        const startTime = Date.now();
        this.logger.log('KOPIS 데이터 동기화 시작');
        try {
          await this.syncPerformances();
          const duration = Date.now() - startTime;
          this.logger.log(`KOPIS 데이터 동기화 완료 (${duration}ms)`);
        } catch (error) {
          const duration = Date.now() - startTime;

          this.logger.error(`KOPIS 데이터 동기화 실패 (${duration}ms)`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
          throw error;
        }
      },
    );
  }

  async syncPerformances(startDate?: Date, endDate?: Date) {
    const performanceRepository = this.dataSource.getRepository(Performance);
    const sessionRepository = this.dataSource.getRepository(Session);
    const venueRepository = this.dataSource.getRepository(Venue);
    const gradeRepository = this.dataSource.getRepository(Grade);
    const blockGradeRepository = this.dataSource.getRepository(BlockGrade);
    const blockRepository = this.dataSource.getRepository(Block);

    try {
      // Venue 목록 가져오기 (랜덤 할당용)
      let venues = await venueRepository.find();
      if (venues.length === 0) {
        this.logger.log('Venues/Blocks 초기화 중');

        for (const venueData of VENUES_DATA) {
          // Venue 생성
          const venue = new Venue(venueData.name, venueData.url);
          const savedVenue = await venueRepository.save(venue);

          // Block 생성
          const blocks = venueData.blocks.map(
            (b) => new Block(savedVenue.id, b.name, b.rows, b.cols),
          );
          await blockRepository.save(blocks);
        }

        venues = await venueRepository.find();
      }
      const blocks = await blockRepository.find({ relations: ['venue'] });

      const performances = await this.kopisService.getPerformancesFromKopis();

      const detailPromises = performances.map(async (performance) => {
        const detail = await this.kopisService.getPerformanceDetailsFromKopis(
          performance.mt20id,
        );
        return detail;
      });
      const details = await Promise.all(detailPromises);
      const validDetails = details.filter((detail) => detail !== null);

      if (validDetails.length === 0) {
        this.logger.log('동기화할 유효한 공연 정보가 없습니다.');
        return;
      }

      this.logger.log('유효 공연 조회 완료', { count: validDetails.length });

      // 날짜 범위 설정
      let startTime: Date;
      let endTime: Date;

      if (startDate && endDate) {
        // 파라미터로 받은 날짜 사용
        startTime = new Date(startDate);
        endTime = new Date(endDate);

        this.logger.log('동기화 대상 날짜 범위', {
          start: startTime.toISOString(),
          end: endTime.toISOString(),
        });

        if (startTime > endTime) {
          throw new TicketException(
            API_ERROR_CODES.KOPIS_INVALID_DATE_RANGE,
            `시작 날짜(${startTime.toISOString()})는 종료 날짜(${endTime.toISOString()})보다 이후일 수 없습니다.`,
            400,
          );
        }
      } else {
        // 기본값: 실행 기준(UTC 14:30 = KST 23:30) 다음날 KST 00:05 ~ 24:00
        const curr = new Date();
        // 1. 현재(UTC) 시간을 KST로 변환
        const utc = curr.getTime() + curr.getTimezoneOffset() * 60 * 1000;
        const KR_TIME_DIFF = 9 * 60 * 60 * 1000;
        const nowKrs = new Date(utc + KR_TIME_DIFF);

        // 2. KST 기준으로 '내일'의 00:05 설정
        const startKrs = new Date(nowKrs);
        startKrs.setDate(startKrs.getDate() + 1);
        startKrs.setHours(0, 5, 0, 0);

        // 3. KST 기준으로 '내일'의 24:00 (다다음날 00:00) 설정
        const endKrs = new Date(nowKrs);
        endKrs.setDate(endKrs.getDate() + 2);
        endKrs.setHours(0, 0, 0, 0);

        // 4. 다시 UTC로 변환하여 DB 저장용 Date 객체 생성
        startTime = new Date(startKrs.getTime() - KR_TIME_DIFF);
        endTime = new Date(endKrs.getTime() - KR_TIME_DIFF);

        this.logger.log('계산된 날짜 범위(KST→UTC)', {
          start: startTime.toISOString(),
          end: endTime.toISOString(),
        });
      }

      const currentTime = new Date(startTime);
      let performanceCount = 0;
      let sessionCount = 0;
      let detailIndex = 0;
      const CHUNK_SIZE = 1000;
      const blockGradesBuffer: BlockGrade[] = [];

      // 00:05 ~ 익일 00:00 루프
      while (currentTime <= endTime) {
        // 순환: 공연 목록을 다 쓰면 처음부터 다시
        const detail = validDetails[detailIndex % validDetails.length];

        const performanceEntity = this.kopisService.toPerformanceEntity(detail);
        performanceEntity.ticketingDate = new Date(currentTime);
        performanceEntity.kopisId = detail.mt20id; // 순수 KOPIS ID 사용

        try {
          const savedPerformance =
            await performanceRepository.save(performanceEntity);
          performanceCount++;

          // Session 생성
          const sessionDates = this.kopisService.parseSessionDates(detail);

          if (venues.length > 0) {
            const randomVenue =
              venues[Math.floor(Math.random() * venues.length)];

            for (const sessionDate of sessionDates) {
              const session = new Session(
                savedPerformance.id,
                sessionDate,
                randomVenue.id,
              );

              const savedSession = await sessionRepository.save(session);
              sessionCount++;

              // Mock Grade 생성
              const gradeConfigs = [
                { name: 'VIP', price: 150000 },
                { name: 'R', price: 120000 },
                { name: 'S', price: 90000 },
                { name: 'A', price: 60000 },
              ];

              const savedGrades: Grade[] = [];
              for (const config of gradeConfigs) {
                const grade = new Grade(
                  savedSession.id,
                  config.name,
                  config.price,
                );
                const savedGrade = await gradeRepository.save(grade);
                savedGrades.push(savedGrade);
              }

              // BlockGrade 매핑
              const blockMap = new Map<string, number>();
              blocks.forEach((b) => {
                blockMap.set(`${b.venue.venueName}:${b.blockDataName}`, b.id);
              });

              const venueRules = (
                BLOCK_GRADE_RULES as Record<string, Record<string, string[]>>
              )[randomVenue.venueName];

              if (!venueRules) {
                this.logger.warn(`공연장 규칙 없음: ${randomVenue.venueName}`);
                continue;
              }

              const gradeNameMap = new Map<string, number>();
              savedGrades.forEach((g) => gradeNameMap.set(g.name, g.id));

              for (const [gradeName, blockNames] of Object.entries(
                venueRules,
              )) {
                const gradeId = gradeNameMap.get(gradeName);
                if (!gradeId) continue;

                for (const blockName of blockNames) {
                  const blockId = blockMap.get(
                    `${randomVenue.venueName}:${blockName}`,
                  );
                  if (!blockId) continue;

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
              await blockGradeRepository.save(blockGradesBuffer);
              blockGradesBuffer.length = 0;
              this.logger.debug('BlockGrade 청크 데이터 저장 완료', {
                size: CHUNK_SIZE,
              });
            }
          } else {
            this.logger.warn('할당 가능한 공연장 없음');
          }
        } catch (e) {
          if (isMySqlDuplicateEntryError(e)) {
            this.logger.warn('중복 티켓팅 일정 건너뜀', {
              kopisId: detail.mt20id,
              ticketingDate: performanceEntity.ticketingDate,
            });
          } else {
            this.logger.error(
              '공연 데이터 저장 실패',
              e instanceof Error ? e.stack : undefined,
              {
                kopisId: detail.mt20id,
              },
            );
          }
        }

        // 5분 추가
        currentTime.setMinutes(currentTime.getMinutes() + 5);
        detailIndex++;
      }

      // 남은 버퍼 저장
      if (blockGradesBuffer.length > 0) {
        await blockGradeRepository.save(blockGradesBuffer);
        blockGradesBuffer.length = 0;
      }

      this.logger.log('KOPIS 동기화 최종 결과 요약', {
        totalPerformances: performanceCount,
        totalSessions: sessionCount,
      });
    } catch (error) {
      if (error instanceof TicketException) {
        const statusCode = error.getStatus();
        if (statusCode >= 500) {
          this.logger.error(error.message, error.stack, {
            errorCode: error.errorCode,
          });
        } else {
          this.logger.warn(error.message, {
            errorCode: error.errorCode,
          });
        }
        throw error;
      }

      this.logger.error(
        'KOPIS 동기화 프로세스 실패',
        error instanceof Error ? error.stack : undefined,
      );
      throw new TicketException(
        API_ERROR_CODES.KOPIS_SYNC_FAILED,
        'KOPIS 데이터 동기화에 실패했습니다.',
        500,
      );
    }
  }
}
