import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  OneToMany,
} from 'typeorm';
import { Performance } from './performance.entity';
import { Venue } from '../../venues/entities/venue.entity';
import { Grade } from './grade.entity';
import { BlockGrade } from './block-grade.entity';

@Entity('sessions')
@Unique(['performanceId', 'sessionDate'])
export class Session {
  constructor(performanceId?: number, sessionDate?: Date, venueId?: number) {
    if (performanceId) this.performanceId = performanceId;
    if (sessionDate) this.sessionDate = sessionDate;
    if (venueId) this.venueId = venueId;
  }

  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'performance_id' })
  performanceId: number;

  @Column({ name: 'venue_id' })
  venueId: number;

  @Column({
    type: 'datetime',
    name: 'session_date',
    comment: '공연 회차 일시 (ISO 8601)',
  })
  sessionDate: Date;

  @ManyToOne(() => Performance, (performance) => performance.sessions)
  @JoinColumn({ name: 'performance_id' })
  performance: Performance;

  @ManyToOne(() => Venue)
  @JoinColumn({ name: 'venue_id' })
  venue: Venue;

  @OneToMany(() => Grade, (grade) => grade.session)
  grades: Grade[];

  @OneToMany(() => BlockGrade, (blockGrade) => blockGrade.session)
  blockGrades: BlockGrade[];
}
