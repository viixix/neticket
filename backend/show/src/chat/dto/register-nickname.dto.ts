import { IsString, IsNotEmpty, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterNicknameDto {
  @ApiProperty({
    description: '세션 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @ApiProperty({
    description: '사용자 닉네임',
    example: '티켓팅마스터',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(20)
  nickname: string;
}
