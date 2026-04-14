import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Session } from './session.entity';

@Entity('grades')
export class Grade {
  constructor(sessionId?: number, name?: string, price?: number) {
    if (sessionId) this.sessionId = sessionId;
    if (name) this.name = name;
    if (price) this.price = price;
  }

  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'session_id' })
  sessionId: number;

  @Column()
  name: string;

  @Column()
  price: number;

  @ManyToOne(() => Session, (session) => session.grades)
  @JoinColumn({ name: 'session_id' })
  session: Session;
}
