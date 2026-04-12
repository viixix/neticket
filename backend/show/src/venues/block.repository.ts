import { Injectable } from '@nestjs/common';
import { DataSource, In, Repository } from 'typeorm';
import { Block } from './entities/block.entity';

@Injectable()
export class BlockRepository extends Repository<Block> {
  constructor(private dataSource: DataSource) {
    super(Block, dataSource.createEntityManager());
  }

  async findExistingBlockNames(
    venueId: number,
    blockNames: string[],
  ): Promise<string[]> {
    if (blockNames.length === 0) {
      return [];
    }

    const blocks = await this.find({
      select: { blockDataName: true },
      where: {
        venueId,
        blockDataName: In(blockNames),
      },
    });

    return blocks.map((block) => block.blockDataName);
  }
}
