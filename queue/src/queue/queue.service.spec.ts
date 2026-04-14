import { Test, TestingModule } from '@nestjs/testing';
import { PROVIDERS, REDIS_KEYS } from '@neticket/contracts';
import { QueueService } from './queue.service';
import crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { HeartbeatService } from './heartbeat.service';
import { VirtualUserInjector } from './virtual-user.injector';
import { QueueConfigService } from './queue-config.service';
import { TicketingStateService } from './ticketing-state.service';
import { QueueException } from '@neticket/common';

describe('QueueService', () => {
  let service: QueueService;

  const redisMock = {
    zrank: jest.fn(),
    exists: jest.fn(),
    multi: jest.fn(),
    set: jest.fn(),
  };
  const jwtServiceMock = { signAsync: jest.fn() };
  const heartbeatServiceMock = {
    update: jest.fn().mockResolvedValue(undefined),
  };
  const virtualUserInjectorMock = {
    start: jest.fn().mockResolvedValue(undefined),
  };
  const configServiceMock = {
    sync: jest.fn().mockResolvedValue(undefined),
    virtual: { enabled: false },
  };
  const ticketingStateServiceMock = { isOpen: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    redisMock.multi.mockImplementation(() => ({
      zadd: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    }));
    redisMock.set.mockResolvedValue('OK');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        { provide: PROVIDERS.REDIS_QUEUE, useValue: redisMock },
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: HeartbeatService, useValue: heartbeatServiceMock },
        { provide: VirtualUserInjector, useValue: virtualUserInjectorMock },
        { provide: QueueConfigService, useValue: configServiceMock },
        { provide: TicketingStateService, useValue: ticketingStateServiceMock },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
  });

  afterEach(() => jest.restoreAllMocks());

  // ────────────────────────────────────────────────────────────────
  // createEntry
  // ────────────────────────────────────────────────────────────────

  describe('createEntry', () => {
    describe('기존 유저 재진입', () => {
      it('userId가 큐에 이미 있으면 신규 등록 없이 기존 position을 반환한다', async () => {
        redisMock.zrank.mockResolvedValueOnce(3); // rank 3 → position 4

        const result = await service.createEntry('existing-123');

        expect(redisMock.zrank).toHaveBeenCalledWith(
          REDIS_KEYS.WAITING_QUEUE,
          'existing-123',
        );
        expect(redisMock.multi).not.toHaveBeenCalled();
        expect(result).toEqual({ userId: 'existing-123', position: 4 });
      });

      it('userId가 있지만 큐에 없으면 신규 유저로 등록한다', async () => {
        redisMock.zrank
          .mockResolvedValueOnce(null) // 기존 유저 체크: 없음
          .mockResolvedValueOnce(2); // 신규 등록 후 rank 2 → position 3
        ticketingStateServiceMock.isOpen.mockResolvedValueOnce(true);

        const result = await service.createEntry('ghost-user');

        expect(redisMock.multi).toHaveBeenCalled();
        expect(result.position).toBe(3);
      });
    });

    describe('신규 유저 등록', () => {
      it('userId 없이 호출 시 신규 userId를 생성하고 대기열에 등록한다', async () => {
        const fixedBuffer = Buffer.from('fixed-secret-val');
        jest
          .spyOn(crypto, 'randomBytes')
          .mockImplementation(
            () => fixedBuffer as unknown as Buffer<ArrayBuffer>,
          );
        ticketingStateServiceMock.isOpen.mockResolvedValueOnce(true);
        redisMock.zrank.mockResolvedValueOnce(5); // rank 5 → position 6

        const result = await service.createEntry();

        const expectedUserId = fixedBuffer.toString('base64url');
        expect(redisMock.multi).toHaveBeenCalled();
        expect(result).toEqual({ userId: expectedUserId, position: 6 });
      });

      it('대기열 등록 시 WAITING_QUEUE와 HEARTBEAT_QUEUE 모두에 zadd를 호출한다', async () => {
        ticketingStateServiceMock.isOpen.mockResolvedValueOnce(true);
        redisMock.zrank.mockResolvedValueOnce(0);

        const multiChain = {
          zadd: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([]),
        };
        redisMock.multi.mockReturnValue(multiChain);

        await service.createEntry();

        expect(multiChain.zadd).toHaveBeenCalledWith(
          REDIS_KEYS.WAITING_QUEUE,
          'NX',
          expect.any(Number),
          expect.any(String),
        );
        expect(multiChain.zadd).toHaveBeenCalledWith(
          REDIS_KEYS.HEARTBEAT_QUEUE,
          'NX',
          expect.any(Number),
          expect.any(String),
        );
      });
    });

    describe('경계값', () => {
      it('rank 0 (첫 번째 유저)이면 position 1을 반환한다', async () => {
        ticketingStateServiceMock.isOpen.mockResolvedValueOnce(true);
        redisMock.zrank.mockResolvedValueOnce(0);

        const result = await service.createEntry();

        expect(result.position).toBe(1);
      });

      it('rank 99 (100번째 유저)이면 position 100을 반환한다', async () => {
        redisMock.zrank.mockResolvedValueOnce(99);

        const result = await service.createEntry('user-100');

        expect(result.position).toBe(100);
      });
    });

    describe('실패 경로', () => {
      it('티켓팅이 닫혀있으면 QueueException을 던진다', async () => {
        // userId 없이 호출하므로 zrank는 호출되지 않음 (validateTicketingOpen이 먼저 실패)
        ticketingStateServiceMock.isOpen.mockResolvedValueOnce(false);

        await expect(service.createEntry()).rejects.toBeInstanceOf(
          QueueException,
        );
      });

      it('티켓팅이 닫혀있으면 403 statusCode의 예외를 던진다', async () => {
        ticketingStateServiceMock.isOpen.mockResolvedValueOnce(false);

        let caughtError: unknown;
        await service.createEntry().catch((e) => {
          caughtError = e;
        });
        expect((caughtError as QueueException).getStatus()).toBe(403);
      });

      it('기존 유저가 큐에 있으면 티켓팅 열림 여부를 확인하지 않는다', async () => {
        redisMock.zrank.mockResolvedValueOnce(5);

        await service.createEntry('already-in-queue');

        expect(ticketingStateServiceMock.isOpen).not.toHaveBeenCalled();
      });
    });
  });

  // ────────────────────────────────────────────────────────────────
  // getStatus
  // ────────────────────────────────────────────────────────────────

  describe('getStatus', () => {
    describe('userId 없음', () => {
      it('userId가 undefined이면 position null과 status open을 반환한다', async () => {
        ticketingStateServiceMock.isOpen.mockResolvedValueOnce(true);

        const result = await service.getStatus(undefined);

        expect(redisMock.exists).not.toHaveBeenCalled();
        expect(redisMock.zrank).not.toHaveBeenCalled();
        expect(result).toEqual({ position: null, status: 'open' });
      });

      it('티켓팅이 닫혀있을 때 userId undefined이면 status closed를 반환한다', async () => {
        ticketingStateServiceMock.isOpen.mockResolvedValueOnce(false);

        const result = await service.getStatus(undefined);

        expect(result).toEqual({ position: null, status: 'closed' });
      });
    });

    describe('활성 유저', () => {
      it('활성 상태면 position 0, JWT 토큰, status를 반환한다', async () => {
        ticketingStateServiceMock.isOpen.mockResolvedValueOnce(true);
        redisMock.exists.mockResolvedValueOnce(1);
        jwtServiceMock.signAsync.mockResolvedValueOnce('jwt-token-abc');

        const result = await service.getStatus('active-user');

        expect(result).toEqual({
          token: 'jwt-token-abc',
          position: 0,
          status: 'open',
        });
      });

      it('활성 유저면 heartbeat를 갱신하지 않는다', async () => {
        ticketingStateServiceMock.isOpen.mockResolvedValueOnce(true);
        redisMock.exists.mockResolvedValueOnce(1);
        jwtServiceMock.signAsync.mockResolvedValueOnce('jwt-token-abc');

        await service.getStatus('active-user');

        expect(heartbeatServiceMock.update).not.toHaveBeenCalled();
      });

      it('JWT 서명에 sub(userId)와 TICKETING type을 포함한다', async () => {
        ticketingStateServiceMock.isOpen.mockResolvedValueOnce(true);
        redisMock.exists.mockResolvedValueOnce(1);
        jwtServiceMock.signAsync.mockResolvedValueOnce('jwt-token');

        await service.getStatus('user-abc');

        expect(jwtServiceMock.signAsync).toHaveBeenCalledWith({
          sub: 'user-abc',
          type: 'TICKETING',
        });
      });
    });

    describe('대기 유저', () => {
      it('대기열에 있으면 position과 status를 반환한다', async () => {
        ticketingStateServiceMock.isOpen.mockResolvedValueOnce(true);
        redisMock.exists.mockResolvedValueOnce(0);
        redisMock.zrank.mockResolvedValueOnce(4); // rank 4 → position 5

        const result = await service.getStatus('waiting-user');

        expect(result).toEqual({ position: 5, status: 'open' });
      });

      it('대기열에 있으면 heartbeat를 갱신한다', async () => {
        ticketingStateServiceMock.isOpen.mockResolvedValueOnce(true);
        redisMock.exists.mockResolvedValueOnce(0);
        redisMock.zrank.mockResolvedValueOnce(2);

        await service.getStatus('waiting-user');

        expect(heartbeatServiceMock.update).toHaveBeenCalledWith(
          'waiting-user',
        );
      });

      it('대기 rank 0 (첫 번째 대기자)이면 position 1을 반환한다', async () => {
        ticketingStateServiceMock.isOpen.mockResolvedValueOnce(true);
        redisMock.exists.mockResolvedValueOnce(0);
        redisMock.zrank.mockResolvedValueOnce(0);

        const result = await service.getStatus('first-waiter');

        expect(result.position).toBe(1);
      });

      it('티켓팅이 닫혀 있어도 대기 중인 유저의 position을 반환한다', async () => {
        ticketingStateServiceMock.isOpen.mockResolvedValueOnce(false);
        redisMock.exists.mockResolvedValueOnce(0);
        redisMock.zrank.mockResolvedValueOnce(9);

        const result = await service.getStatus('waiting-user');

        expect(result).toEqual({ position: 10, status: 'closed' });
      });
    });

    describe('큐에 없는 유저', () => {
      it('대기열에 없으면 position null을 반환한다', async () => {
        ticketingStateServiceMock.isOpen.mockResolvedValueOnce(true);
        redisMock.exists.mockResolvedValueOnce(0);
        redisMock.zrank.mockResolvedValueOnce(null);

        const result = await service.getStatus('unknown-user');

        expect(result).toEqual({ position: null, status: 'open' });
      });

      it('큐에 없는 유저면 heartbeat를 갱신하지 않는다', async () => {
        ticketingStateServiceMock.isOpen.mockResolvedValueOnce(true);
        redisMock.exists.mockResolvedValueOnce(0);
        redisMock.zrank.mockResolvedValueOnce(null);

        await service.getStatus('unknown-user');

        expect(heartbeatServiceMock.update).not.toHaveBeenCalled();
      });
    });
  });
});
