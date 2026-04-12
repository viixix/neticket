import { Test, TestingModule } from '@nestjs/testing';
import { QueueWorker } from './queue.worker';
import {
  PROVIDERS,
  REDIS_KEY_PREFIXES,
  REDIS_KEYS,
} from '@neticket/shared-constants';
import { Logger } from '@nestjs/common';
import { QueueConfigService } from './queue-config.service';

describe('QueueWorker', () => {
  let worker: QueueWorker;
  let redisMock: Record<string, jest.Mock>;
  let configServiceMock: Record<string, unknown>;

  const makePipelineMock = (zremResult: number) => ({
    zrem: jest.fn().mockReturnThis(),
    del: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([
      [null, zremResult],
      [null, 1],
    ]),
  });

  beforeEach(async () => {
    redisMock = {
      syncAndPromoteWaiters: jest.fn(),
      pipeline: jest.fn(),
    };
    configServiceMock = {
      worker: {
        maxCapacity: 10,
        heartbeatTimeoutMs: 60000,
        activeTTLMs: 300000,
      },
      heartbeat: {
        enabled: true,
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueWorker,
        { provide: QueueConfigService, useValue: configServiceMock },
        { provide: PROVIDERS.REDIS_QUEUE, useValue: redisMock },
      ],
    }).compile();

    worker = module.get<QueueWorker>(QueueWorker);
  });

  afterEach(() => jest.restoreAllMocks());

  // ────────────────────────────────────────────────────────────────
  // processQueueTransfer
  // ────────────────────────────────────────────────────────────────

  describe('processQueueTransfer', () => {
    describe('정상 동작', () => {
      it('루아 명령어가 올바른 순서와 인자로 실행된다', async () => {
        redisMock.syncAndPromoteWaiters.mockResolvedValue(['user1', 'user2']);

        await worker.processQueueTransfer();

        expect(redisMock.syncAndPromoteWaiters).toHaveBeenCalledTimes(1);
        expect(redisMock.syncAndPromoteWaiters).toHaveBeenCalledWith(
          REDIS_KEYS.WAITING_QUEUE,
          REDIS_KEYS.ACTIVE_QUEUE,
          REDIS_KEYS.HEARTBEAT_QUEUE,
          REDIS_KEYS.VIRTUAL_ACTIVE_QUEUE,
          10,
          expect.any(Number),
          60000,
          300000,
          REDIS_KEY_PREFIXES.ACTIVE_USER,
          true,
        );
      });

      it('이동된 유저가 있으면 디버그 로그를 남긴다', async () => {
        redisMock.syncAndPromoteWaiters.mockResolvedValue(['user1']);
        const loggerSpy = jest
          .spyOn(Logger.prototype, 'debug')
          .mockImplementation();

        await worker.processQueueTransfer();

        expect(loggerSpy).toHaveBeenCalledWith('🚀 유저 활성 큐 이동 완료', {
          count: 1,
          userIds: ['user1'],
        });
      });

      it('이동된 유저가 없으면 이동 완료 로그를 남기지 않는다', async () => {
        redisMock.syncAndPromoteWaiters.mockResolvedValue([]);
        const loggerSpy = jest
          .spyOn(Logger.prototype, 'debug')
          .mockImplementation();

        await worker.processQueueTransfer();

        expect(loggerSpy).not.toHaveBeenCalledWith(
          '🚀 유저 활성 큐 이동 완료',
          expect.anything(),
        );
      });
    });

    describe('중복 실행 방지 (isProcessing)', () => {
      it('첫 번째 처리가 완료되지 않은 상태에서 두 번째 호출은 루아 스크립트를 실행하지 않는다', async () => {
        let resolveFirst!: (v: string[]) => void;
        redisMock.syncAndPromoteWaiters
          .mockReturnValueOnce(
            new Promise<string[]>((resolve) => {
              resolveFirst = resolve;
            }),
          )
          .mockResolvedValue([]);

        const first = worker.processQueueTransfer();
        const second = worker.processQueueTransfer(); // isProcessing 중 → skip

        resolveFirst([]);
        await Promise.all([first, second]);

        expect(redisMock.syncAndPromoteWaiters).toHaveBeenCalledTimes(1);
      });

      it('처리 완료 후 다음 호출은 정상 실행된다', async () => {
        redisMock.syncAndPromoteWaiters.mockResolvedValue([]);

        await worker.processQueueTransfer();
        await worker.processQueueTransfer();

        expect(redisMock.syncAndPromoteWaiters).toHaveBeenCalledTimes(2);
      });
    });

    describe('실패 경로', () => {
      it('에러 발생 시 에러 로그를 남긴다', async () => {
        redisMock.syncAndPromoteWaiters.mockRejectedValue(
          new Error('Redis Error'),
        );
        const loggerErrorSpy = jest
          .spyOn(Logger.prototype, 'error')
          .mockImplementation();

        await worker.processQueueTransfer();

        expect(loggerErrorSpy).toHaveBeenCalledWith(
          '대기열 처리 중 오류가 발생했습니다.',
          expect.stringContaining('Redis Error'),
          { errorCode: 'QUEUE_TRANSFER_FAILED' },
        );
      });

      it('에러 발생 후에도 isProcessing이 초기화되어 다음 호출을 처리한다', async () => {
        redisMock.syncAndPromoteWaiters
          .mockRejectedValueOnce(new Error('Redis Error'))
          .mockResolvedValueOnce([]);
        jest.spyOn(Logger.prototype, 'error').mockImplementation();

        await worker.processQueueTransfer();
        await worker.processQueueTransfer();

        expect(redisMock.syncAndPromoteWaiters).toHaveBeenCalledTimes(2);
      });
    });
  });

  // ────────────────────────────────────────────────────────────────
  // removeActiveUser
  // ────────────────────────────────────────────────────────────────

  describe('removeActiveUser', () => {
    describe('정상 동작', () => {
      it('userId에 대해 ACTIVE_QUEUE zrem과 상태 키 del을 pipeline으로 호출한다', async () => {
        const pipeline = makePipelineMock(1);
        redisMock.pipeline.mockReturnValue(pipeline);

        await worker.removeActiveUser('user-abc', false);

        expect(pipeline.zrem).toHaveBeenCalledWith(
          REDIS_KEYS.ACTIVE_QUEUE,
          'user-abc',
        );
        expect(pipeline.del).toHaveBeenCalledWith(
          `${REDIS_KEY_PREFIXES.ACTIVE_USER}user-abc`,
        );
        expect(pipeline.exec).toHaveBeenCalled();
      });

      it('실제로 제거된 경우 (zrem 결과 > 0) 로그를 남길 수 있다', async () => {
        const pipeline = makePipelineMock(1);
        redisMock.pipeline.mockReturnValue(pipeline);
        // 비가상 유저는 100% 샘플링이므로 반드시 로그 호출됨
        jest.spyOn(Math, 'random').mockReturnValue(0.5);
        const loggerSpy = jest
          .spyOn(Logger.prototype, 'log')
          .mockImplementation();

        await worker.removeActiveUser('user-abc', false);

        expect(loggerSpy).toHaveBeenCalledWith(
          '🛑 유저 퇴장 완료',
          expect.objectContaining({ userId: 'user-abc', isVirtual: false }),
        );
      });
    });

    describe('경계값', () => {
      it('userId가 빈 문자열이면 pipeline을 호출하지 않는다', async () => {
        await worker.removeActiveUser('', false);

        expect(redisMock.pipeline).not.toHaveBeenCalled();
      });

      it('zrem 결과가 0이면 (이미 제거됨) 로그를 남기지 않는다', async () => {
        const pipeline = makePipelineMock(0);
        redisMock.pipeline.mockReturnValue(pipeline);
        const loggerSpy = jest
          .spyOn(Logger.prototype, 'log')
          .mockImplementation();

        await worker.removeActiveUser('already-gone', false);

        expect(loggerSpy).not.toHaveBeenCalled();
      });
    });

    describe('실패 경로', () => {
      it('Redis 에러 발생 시 에러 로그를 남긴다', async () => {
        redisMock.pipeline.mockReturnValue({
          zrem: jest.fn().mockReturnThis(),
          del: jest.fn().mockReturnThis(),
          exec: jest.fn().mockRejectedValue(new Error('Redis Error')),
        });
        const loggerErrorSpy = jest
          .spyOn(Logger.prototype, 'error')
          .mockImplementation();

        await worker.removeActiveUser('user-abc', false);

        expect(loggerErrorSpy).toHaveBeenCalledWith(
          '활성 큐 제거에 실패했습니다.',
          expect.any(String),
          expect.objectContaining({ errorCode: 'QUEUE_REMOVE_ACTIVE_FAILED' }),
        );
      });

      it('에러가 발생해도 예외를 throw하지 않는다', async () => {
        redisMock.pipeline.mockReturnValue({
          zrem: jest.fn().mockReturnThis(),
          del: jest.fn().mockReturnThis(),
          exec: jest.fn().mockRejectedValue(new Error('connection lost')),
        });
        jest.spyOn(Logger.prototype, 'error').mockImplementation();

        await expect(
          worker.removeActiveUser('user-abc', false),
        ).resolves.not.toThrow();
      });
    });
  });
});
