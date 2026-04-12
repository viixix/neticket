import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { UserService } from './user.service';
import { GetNicknameResponseDto } from './dto/get-nickname-response.dto';
import { GenerateSessionResponseDto } from './dto/generate-session-response.dto';

@ApiTags('User')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('session')
  @ApiOperation({ summary: '세션 ID 발급' })
  @ApiResponse({
    status: 201,
    description: '세션 ID가 성공적으로 생성됨',
    type: GenerateSessionResponseDto,
  })
  generateSession(): GenerateSessionResponseDto {
    const sessionId = this.userService.generateSessionId();
    return { sessionId };
  }

  @Get('nickname')
  @ApiOperation({ summary: '사용자 닉네임 조회 (세션 ID 기반)' })
  @ApiQuery({
    name: 'sessionId',
    required: true,
    description: '세션 ID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: '닉네임 조회 성공',
    type: GetNicknameResponseDto,
  })
  async getNickname(
    @Query('sessionId') sessionId: string,
  ): Promise<GetNicknameResponseDto> {
    const nickname = await this.userService.getNicknameBySessionId(sessionId);
    return { nickname };
  }
}
