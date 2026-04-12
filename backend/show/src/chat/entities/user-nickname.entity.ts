import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('user')
export class UserNickname {
  @PrimaryColumn({
    type: 'varchar',
    length: 36,
    name: 'session_id',
    comment: '사용자 세션 ID',
  })
  sessionId: string;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'nickname',
    unique: true,
    comment: '사용자 닉네임 (중복 불가)',
  })
  nickname: string;

  @CreateDateColumn({
    type: 'datetime',
    name: 'created_at',
    comment: '닉네임 등록일시',
  })
  createdAt: Date;

  @Column({
    type: 'datetime',
    name: 'updated_at',
    comment: '닉네임 수정일시',
    nullable: true,
  })
  updatedAt: Date | null;
}
