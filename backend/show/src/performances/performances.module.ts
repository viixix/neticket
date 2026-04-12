import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PerformancesController } from './performances.controller';
import { SessionsController } from './sessions.controller';
import { PerformancesService } from './performances.service';
import { Performance } from './entities/performance.entity';
import { Session } from './entities/session.entity';
import { SessionsRepository } from './sessions.repository';
import { Grade } from './entities/grade.entity';
import { BlockGrade } from './entities/block-grade.entity';
import { GradesRepository } from './grades.repository';
import { BlockGradesRepository } from './block-grades.repository';
import { Venue } from '../venues/entities/venue.entity';
import { PerformancesRepository } from './performances.repository';
import { KopisModule } from '../kopis/kopis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Performance, Venue, Session, Grade, BlockGrade]),
    KopisModule,
  ],
  controllers: [PerformancesController, SessionsController],
  providers: [
    PerformancesService,
    PerformancesRepository,
    SessionsRepository,
    GradesRepository,
    BlockGradesRepository,
  ],
  exports: [PerformancesService],
})
export class PerformancesModule {}
