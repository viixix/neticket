import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BlockGrade } from './entities/block-grade.entity';

@Injectable()
export class BlockGradesRepository {
  constructor(
    @InjectRepository(BlockGrade)
    private readonly repository: Repository<BlockGrade>,
  ) {}

  async createMany(
    sessionId: number,
    mappings: { gradeId: number; blockId: number }[],
  ): Promise<BlockGrade[]> {
    const entities = mappings.map((m) =>
      this.repository.create({
        sessionId,
        gradeId: m.gradeId,
        blockId: m.blockId,
      }),
    );
    return this.repository.save(entities);
  }

  async findBySessionId(sessionId: number): Promise<BlockGrade[]> {
    return this.repository.find({
      where: { sessionId },
      relations: ['grade', 'block'],
    });
  }

  async findBySessionAndBlocks(
    sessionId: number,
    blockIds: number[],
  ): Promise<BlockGrade[]> {
    if (blockIds.length === 0) {
      return [];
    }
    return this.repository.find({
      where: {
        sessionId,
        blockId: In(blockIds),
      },
    });
  }
}
