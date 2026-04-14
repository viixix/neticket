import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Venue } from './venue.entity';

@Entity('blocks')
@Unique(['venueId', 'blockDataName'])
export class Block {
  constructor(
    venueId?: number,
    blockDataName?: string,
    rowSize?: number,
    colSize?: number,
  ) {
    if (venueId) this.venueId = venueId;
    if (blockDataName) this.blockDataName = blockDataName;
    if (rowSize) this.rowSize = rowSize;
    if (colSize) this.colSize = colSize;
  }

  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'venue_id' })
  venueId: number;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'block_data_name',
    comment: 'SVG 파일 내 data-block-name 속성과 매칭',
  })
  blockDataName: string;

  @Column({
    type: 'int',
    name: 'row_size',
    comment: '구역의 가로 좌석 수',
  })
  rowSize: number;

  @Column({
    type: 'int',
    name: 'col_size',
    comment: '구역의 세로 좌석 수',
  })
  colSize: number;

  @ManyToOne(() => Venue, (venue) => venue.blocks)
  @JoinColumn({ name: 'venue_id' })
  venue: Venue;
}
