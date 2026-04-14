import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage } from './entities/chat-message.entity';
import { UserNickname } from './entities/user-nickname.entity';
import { API_ERROR_CODES, TicketException } from '@neticket/common';

export interface ChatMessageResponse {
  id: string;
  nickname: string;
  message: string;
  timestamp: string;
}

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessage)
    private chatMessageRepository: Repository<ChatMessage>,
    @InjectRepository(UserNickname)
    private userNicknameRepository: Repository<UserNickname>,
  ) {}

  async getAllMessages(): Promise<ChatMessageResponse[]> {
    const messages = await this.chatMessageRepository.find({
      order: { timestamp: 'DESC' },
      take: 100, // 최근 100개만 조회
    });

    return messages.map((msg) => ({
      id: msg.id.toString(),
      nickname: msg.user.nickname,
      message: msg.message,
      timestamp: msg.timestamp.toISOString(),
    }));
  }

  async registerNickname(sessionId: string, nickname: string): Promise<void> {
    // 다른 사용자가 이미 사용 중인 닉네임인지 확인
    const existingNickname = await this.userNicknameRepository.findOne({
      where: { nickname },
    });

    if (existingNickname && existingNickname.sessionId !== sessionId) {
      throw new TicketException(
        API_ERROR_CODES.CHAT_NICKNAME_DUPLICATE,
        '이미 사용 중인 닉네임입니다.',
        400,
      );
    }

    // 기존 사용자 닉네임 조회
    const existingUser = await this.userNicknameRepository.findOne({
      where: { sessionId },
    });

    if (existingUser) {
      // 닉네임 업데이트
      existingUser.nickname = nickname;
      existingUser.updatedAt = new Date();
      await this.userNicknameRepository.save(existingUser);
    } else {
      // 새 닉네임 등록
      const newUserNickname = this.userNicknameRepository.create({
        sessionId,
        nickname,
        updatedAt: null,
      });
      await this.userNicknameRepository.save(newUserNickname);
    }
  }

  async getNickname(sessionId: string): Promise<string | undefined> {
    const userNickname = await this.userNicknameRepository.findOne({
      where: { sessionId },
    });
    return userNickname?.nickname;
  }

  async addMessage(
    sessionId: string,
    message: string,
  ): Promise<ChatMessageResponse> {
    const userNickname = await this.userNicknameRepository.findOne({
      where: { sessionId },
    });

    if (!userNickname) {
      throw new TicketException(
        API_ERROR_CODES.CHAT_NICKNAME_REQUIRED,
        '닉네임을 먼저 설정해주세요.',
        400,
      );
    }

    const newMessage = this.chatMessageRepository.create({
      sessionId,
      message,
    });

    const savedMessage = await this.chatMessageRepository.save(newMessage);

    // 저장 후 user 정보와 함께 다시 조회
    const messageWithUser = await this.chatMessageRepository.findOne({
      where: { id: savedMessage.id },
    });

    return {
      id: messageWithUser!.id.toString(),
      nickname: messageWithUser!.user.nickname,
      message: messageWithUser!.message,
      timestamp: messageWithUser!.timestamp.toISOString(),
    };
  }

  async clearMessages(): Promise<void> {
    await this.chatMessageRepository.clear();
  }
}
