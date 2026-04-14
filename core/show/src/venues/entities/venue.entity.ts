import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Block } from './block.entity';

@Entity('venues')
export class Venue {
  constructor(venueName?: string, blockMapUrl?: string | null) {
    if (venueName) this.venueName = venueName;
    if (blockMapUrl) this.blockMapUrl = blockMapUrl;
  }

  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'venue_name',
    comment: '공연장 이름',
  })
  venueName: string;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
    name: 'block_map_url',
    comment: 'SVG 이미지 경로',
  })
  blockMapUrl: string | null;

  @OneToMany(() => Block, (block) => block.venue)
  blocks: Block[];
}
