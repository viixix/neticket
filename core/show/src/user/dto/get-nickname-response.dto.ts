import { ApiProperty } from '@nestjs/swagger';

export class GetNicknameResponseDto {
  @ApiProperty({
    description: '사용자 닉네임',
    example: 'beast123',
    nullable: true,
  })
  nickname: string | null;
}
