import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Session } from './session.entity';
import { Block } from '../../venues/entities/block.entity';
import { Grade } from './grade.entity';

@Entity('block_grades')
@Unique(['sessionId', 'blockId'])
export class BlockGrade {
  constructor(sessionId?: number, blockId?: number, gradeId?: number) {
    if (sessionId) this.sessionId = sessionId;
    if (blockId) this.blockId = blockId;
    if (gradeId) this.gradeId = gradeId;
  }

  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'session_id' })
  sessionId: number;

  @Column({ name: 'block_id' })
  blockId: number;

  @Column({ name: 'grade_id' })
  gradeId: number;

  @ManyToOne(() => Session, (session) => session.blockGrades)
  @JoinColumn({ name: 'session_id' })
  session: Session;

  @ManyToOne(() => Block)
  @JoinColumn({ name: 'block_id' })
  block: Block;

  @ManyToOne(() => Grade)
  @JoinColumn({ name: 'grade_id' })
  grade: Grade;
}
