import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Performance } from './entities/performance.entity';
import { SearchPerformancesRequestDto } from './dto/search-performances-request.dto';

@Injectable()
export class PerformancesRepository extends Repository<Performance> {
  constructor(private dataSource: DataSource) {
    super(Performance, dataSource.createEntityManager());
  }

  async search(
    requestDto: SearchPerformancesRequestDto,
  ): Promise<Performance[]> {
    const query = this.createQueryBuilder('performance').orderBy(
      'performance.ticketingDate',
      'ASC',
    );

    if (requestDto.ticketing_after) {
      query.where('performance.ticketingDate >= :ticketing_after', {
        ticketing_after: new Date(requestDto.ticketing_after),
      });
    }

    if (requestDto.limit) {
      query.take(requestDto.limit);
    }

    return query.getMany();
  }
}
