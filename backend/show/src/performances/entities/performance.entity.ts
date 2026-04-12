import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Session } from './session.entity';

@Entity('performances')
export class Performance {
  constructor(
    kopisId?: string,
    performanceName?: string,
    ticketingDate?: Date,
    platform?: 'nol-ticket' | 'yes24' | 'melon-ticket' | 'interpark',
    posterUrl?: string,
    platformTicketingUrl?: string,
    castInfo?: string,
    runtime?: string,
    ageLimit?: string,
  ) {
    if (kopisId) this.kopisId = kopisId;
    if (performanceName) this.performanceName = performanceName;
    if (ticketingDate) this.ticketingDate = ticketingDate;
    if (platform) this.platform = platform;
    if (posterUrl) this.posterUrl = posterUrl;
    if (platformTicketingUrl) this.platformTicketingUrl = platformTicketingUrl;
    if (castInfo) this.castInfo = castInfo;
    if (runtime) this.runtime = runtime;
    if (ageLimit) this.ageLimit = ageLimit;
  }

  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'kopis_id',
    nullable: true,
    comment: 'KOPIS API 공연 ID (mt20id)',
  })
  kopisId: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'performance_name',
    comment: '공연 이름',
  })
  performanceName: string;

  @Column({
    type: 'datetime',
    name: 'ticketing_date',
    comment: '티켓팅 일시 (ISO 8601)',
    unique: true,
  })
  ticketingDate: Date;

  @Column({
    type: 'varchar',
    length: 500,
    name: 'poster_url',
    nullable: true,
    comment: '포스터 이미지 URL',
  })
  posterUrl: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'platform_ticketing_url',
    nullable: true,
    comment: '실제 예매처 티켓팅 페이지 URL',
  })
  platformTicketingUrl: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'platform',
    comment: '티켓팅 플랫폼 (nol-ticket, yes24, melon-ticket, interpark)',
    default: 'nol-ticket',
  })
  platform: 'nol-ticket' | 'yes24' | 'melon-ticket' | 'interpark';

  @Column({
    type: 'varchar',
    length: 200,
    name: 'cast_info',
    nullable: true,
    comment: '출연진 정보',
  })
  castInfo: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'runtime',
    nullable: true,
    comment: '공연 런타임',
  })
  runtime: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'age_limit',
    nullable: true,
    comment: '관람 연령 제한',
  })
  ageLimit: string | null;

  @OneToMany(() => Session, (session) => session.performance)
  sessions: Session[];
}
