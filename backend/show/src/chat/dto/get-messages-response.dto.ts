import { ApiProperty } from '@nestjs/swagger';

export class ChatMessageResponseDto {
  @ApiProperty({
    description: '메시지 ID',
    example: '1234567890',
  })
  id: string;

  @ApiProperty({
    description: '사용자 닉네임',
    example: '티켓팅마스터',
  })
  nickname: string;

  @ApiProperty({
    description: '채팅 메시지',
    example: '안녕하세요!',
  })
  message: string;

  @ApiProperty({
    description: '메시지 생성 시간',
    example: '2024-01-01T00:00:00.000Z',
  })
  timestamp: string;
}

export class GetMessagesResponseDto {
  @ApiProperty({
    type: [ChatMessageResponseDto],
    description: '채팅 메시지 목록',
  })
  messages: ChatMessageResponseDto[];
}
