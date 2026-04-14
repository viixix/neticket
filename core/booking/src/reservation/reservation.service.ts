import { Injectable, Logger } from '@nestjs/common';
import {
  REDIS_CHANNELS,
  REDIS_KEY_PREFIXES,
  REDIS_KEYS,
} from '@neticket/contracts';
import {
  TICKET_ERROR_CODES,
  TicketException,
  TraceService,
} from '@neticket/common';
import { RedisService } from '../redis/redis.service';
import { CreateReservationRequestDto } from './dto/create-reservation-request.dto';
import { GetReservationsResponseDto } from './dto/get-reservations-response.dto';
import { CreateReservationResponseDto } from './dto/create-reservation-response.dto';

@Injectable()
export class ReservationService {
  private readonly logger = new Logger(ReservationService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly traceService: TraceService,
  ) {}

  async getSeats(
    sessionId: number,
    blockId: number,
  ): Promise<GetReservationsResponseDto> {
    await this.validateSessionBlock(sessionId, blockId);

    const { rowSize, colSize } = await this.getBlockInfo(blockId);
    const keys = this.generateSeatKeys(sessionId, blockId, rowSize, colSize);
    const values = await this.redisService.mget(keys);

    return { seats: this.mapToArray(values, rowSize, colSize) };
  }

  async reserve(
    dto: CreateReservationRequestDto,
    userId: string,
    isVirtual: boolean = false,
    sessionIds?: number[],
  ): Promise<CreateReservationResponseDto> {
    const { session_id: sessionId, seats } = dto;
    await this.validateTicketingOpen();

    if (sessionIds !== undefined && !sessionIds.includes(sessionId)) {
      throw new TicketException(
        TICKET_ERROR_CODES.INVALID_SESSION_TOKEN,
        '토큰에 포함된 회차 정보와 요청 회차가 일치하지 않습니다.',
        403,
      );
    }

    const seatKeys = await this.prepareReservationKeys(sessionId, seats);
    const userReservedKey = `${REDIS_KEY_PREFIXES.USER_RESERVED}${sessionId}:user:${userId}`;
    const rank = await this.executeAtomicReservation(
      seatKeys,
      sessionId,
      userId,
      userReservedKey,
      isVirtual,
    );
    await this.publishReservationDoneEvent(userId, isVirtual);

    const virtual_user_size = await this.getVirtualSize();
    const reserved_at = new Date().toISOString();

    return { rank, seats, virtual_user_size, reserved_at };
  }

  private async getVirtualSize(): Promise<number> {
    const sizeStr = await this.redisService.hgetQueue(
      REDIS_KEYS.CONFIG_QUEUE,
      'virtual.target_total',
    );
    return sizeStr ? parseInt(sizeStr, 10) : 0;
  }

  private async validateTicketingOpen() {
    const isOpen = await this.redisService.get(REDIS_KEYS.TICKETING_OPEN);
    if (isOpen !== 'true') {
      throw new TicketException(
        TICKET_ERROR_CODES.TICKETING_NOT_OPEN,
        '티켓팅이 열려있지 않습니다.',
        403,
      );
    }
  }

  private async publishReservationDoneEvent(
    userId: string,
    isVirtual: boolean,
  ): Promise<void> {
    try {
      const traceId = this.traceService.getOrCreateTraceId();

      const payload = JSON.stringify({ userId, traceId, isVirtual });
      await this.redisService.publishToQueue(
        REDIS_CHANNELS.QUEUE_EVENT_DONE,
        payload,
      );
      const samplingRate = isVirtual ? 0.01 : 1.0;
      if (Math.random() < samplingRate) {
        this.logger.log('티켓팅 완료 이벤트 발행 성공', {
          userId,
          isVirtual,
          sampled: isVirtual,
        });
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.warn('티켓팅 완료 이벤트 발행 실패', err.stack, {
        userId,
        isVirtual,
      });
    }
  }

  private async prepareReservationKeys(
    sessionId: number,
    seats: { block_id: number; row: number; col: number }[],
  ): Promise<string[]> {
    const seatKeys: string[] = [];
    const blockInfoMap = new Map<
      number,
      { rowSize: number; colSize: number }
    >();

    const uniqueKeys = new Set<string>();

    for (const seat of seats) {
      const { block_id: blockId, row, col } = seat;

      await this.validateSessionBlock(sessionId, blockId);

      if (!blockInfoMap.has(blockId)) {
        const info = await this.getBlockInfo(blockId);
        blockInfoMap.set(blockId, info);
      }
      const { rowSize, colSize } = blockInfoMap.get(blockId)!;

      if (row < 0 || row >= rowSize || col < 0 || col >= colSize) {
        throw new TicketException(
          TICKET_ERROR_CODES.INVALID_SEAT_COORDINATES,
          `좌석 좌표가 유효하지 않습니다. (block: ${blockId})`,
          400,
        );
      }
      const key = `reservation:session:${sessionId}:block:${blockId}:row:${row}:col:${col}`;

      if (uniqueKeys.has(key)) {
        throw new TicketException(
          TICKET_ERROR_CODES.DUPLICATE_SEATS,
          '요청에 중복된 좌석이 포함되어 있습니다.',
          400,
        );
      }
      uniqueKeys.add(key);
      seatKeys.push(key);
    }
    return seatKeys;
  }

  private async executeAtomicReservation(
    seatKeys: string[],
    sessionId: number,
    userId: string,
    userReservedKey: string,
    isVirtual: boolean = false,
  ): Promise<number> {
    const rankKey = `rank:session:${sessionId}`;
    const [success, rank] = await this.redisService.atomicReservation(
      seatKeys,
      userId,
      rankKey,
      userReservedKey,
    );

    if (success === -1) {
      throw new TicketException(
        TICKET_ERROR_CODES.DUPLICATE_RESERVATION,
        '이미 예약한 사용자입니다.',
        409,
      );
    }

    if (success !== 1) {
      throw new TicketException(
        TICKET_ERROR_CODES.SEATS_ALREADY_RESERVED,
        '이미 예약된 좌석이 포함되어 있습니다.',
        400,
      );
    }

    const samplingRate = isVirtual ? 0.01 : 1.0;

    if (Math.random() < samplingRate) {
      this.logger.log('티켓 예약 성공 (Atomic)', {
        userId,
        sessionId,
        rank,
        seatCount: seatKeys.length,
        isVirtual,
        sampled: isVirtual,
      });
    }
    return rank;
  }

  private async validateSessionBlock(sessionId: number, blockId: number) {
    const isValid = await this.redisService.sismember(
      `session:${sessionId}:blocks`,
      String(blockId),
    );
    if (!isValid) {
      throw new TicketException(
        TICKET_ERROR_CODES.INVALID_BLOCK_FOR_SESSION,
        `회차 ${sessionId}에 대한 블록 정보가 유효하지 않습니다. (block: ${blockId})`,
        400,
      );
    }
  }

  private async getBlockInfo(blockId: number) {
    const data = await this.redisService.get(`block:${blockId}`);
    if (!data) {
      throw new TicketException(
        TICKET_ERROR_CODES.BLOCK_DATA_NOT_FOUND,
        `블록 정보가 존재하지 않습니다. (block: ${blockId})`,
        400,
      );
    }
    return JSON.parse(data) as { rowSize: number; colSize: number };
  }

  private generateSeatKeys(
    sessionId: number,
    blockId: number,
    rowSize: number,
    colSize: number,
  ): string[] {
    const keys: string[] = [];
    for (let r = 0; r < rowSize; r++) {
      for (let c = 0; c < colSize; c++) {
        keys.push(
          `reservation:session:${sessionId}:block:${blockId}:row:${r}:col:${c}`,
        );
      }
    }
    return keys;
  }

  private mapToArray(
    values: (string | null)[],
    rowSize: number,
    colSize: number,
  ): boolean[][] {
    const array: boolean[][] = Array.from({ length: rowSize }, () =>
      Array<boolean>(colSize).fill(false),
    );
    let idx = 0;
    for (let r = 0; r < rowSize; r++) {
      for (let c = 0; c < colSize; c++) {
        if (values[idx++] !== null) array[r][c] = true;
      }
    }
    return array;
  }
}
