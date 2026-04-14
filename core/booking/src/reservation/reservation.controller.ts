import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetUser, JwtAuthGuard } from '../auth';
import type { ActiveUser } from '@neticket/contracts';
import { ReservationService } from './reservation.service';
import { CreateReservationRequestDto } from './dto/create-reservation-request.dto';
import { GetReservationsRequestDto } from './dto/get-reservations-request.dto';
import { GetReservationsResponseDto } from './dto/get-reservations-response.dto';
import { CreateReservationResponseDto } from './dto/create-reservation-response.dto';

@ApiTags('예약 API')
@Controller('reservations')
@UseGuards(JwtAuthGuard)
export class ReservationController {
  constructor(private readonly reservationService: ReservationService) {}

  @Get()
  @ApiOperation({
    summary: '좌석 현황 조회',
    description:
      '특정 회차와 구역의 예약된 좌석 목록을 조회합니다. Active Token이 필요합니다.',
  })
  @ApiResponse({
    status: 200,
    type: GetReservationsResponseDto,
    description: '조회 성공',
  })
  async getSeats(
    @Query() query: GetReservationsRequestDto,
  ): Promise<GetReservationsResponseDto> {
    return this.reservationService.getSeats(query.session_id, query.block_id);
  }

  @Post()
  @ApiOperation({
    summary: '공연 예약',
    description:
      '좌석을 선택하여 예약을 시도합니다. Active Token이 필요합니다.',
  })
  @ApiResponse({
    status: 201,
    type: CreateReservationResponseDto,
    description: '예약 성공',
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청 또는 이미 예약된 좌석',
  })
  @ApiResponse({ status: 403, description: '권한 없음 (대기열 미통과)' })
  async createReservation(
    @Body() dto: CreateReservationRequestDto,
    @GetUser() user: ActiveUser,
  ): Promise<CreateReservationResponseDto> {
    return this.reservationService.reserve(
      dto,
      user.userId,
      false,
      user.sessionIds,
    );
  }
}
