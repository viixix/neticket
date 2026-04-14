import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedingService } from './seeding.service';
import { Venue } from '../venues/entities/venue.entity';
import { Block } from '../venues/entities/block.entity';
import { Performance } from '../performances/entities/performance.entity';
import { Session } from '../performances/entities/session.entity';
import { Grade } from '../performances/entities/grade.entity';
import { BlockGrade } from '../performances/entities/block-grade.entity';
import { TraceModule } from '@neticket/common';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Venue,
      Block,
      Performance,
      Session,
      Grade,
      BlockGrade,
    ]),
    TraceModule,
  ],
  providers: [SeedingService],
  exports: [SeedingService],
})
export class SeedingModule {}
