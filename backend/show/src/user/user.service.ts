import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { UserNickname } from '../chat/entities/user-nickname.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserNickname)
    private readonly userNicknameRepository: Repository<UserNickname>,
  ) {}

  generateSessionId(): string {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return uuidv4() as string;
  }

  async getNicknameBySessionId(sessionId: string): Promise<string | null> {
    const user = await this.userNicknameRepository.findOne({
      where: { sessionId },
    });
    return user?.nickname || null;
  }
}
