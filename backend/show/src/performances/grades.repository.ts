import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Grade } from './entities/grade.entity';

@Injectable()
export class GradesRepository {
  constructor(
    @InjectRepository(Grade)
    private readonly repository: Repository<Grade>,
  ) {}

  async createMany(
    sessionId: number,
    grades: { name: string; price: number }[],
  ): Promise<Grade[]> {
    const gradeEntities = grades.map((grade) =>
      this.repository.create({
        ...grade,
        sessionId,
      }),
    );
    return this.repository.save(gradeEntities);
  }

  async findBySessionId(sessionId: number): Promise<Grade[]> {
    return this.repository.find({
      where: { sessionId },
    });
  }
}
