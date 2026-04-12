import { Test, TestingModule } from '@nestjs/testing';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';
import type { Request, Response } from 'express';

type MockedQueueService = {
  createEntry: jest.Mock;
  getStatus: jest.Mock;
};

const createRequest = (cookies?: Record<string, string>): Request =>
  ({ cookies }) as unknown as Request;

const createResponse = () => {
  const cookie = jest.fn();
  return {
    response: { cookie } as unknown as Response,
    cookie,
  };
};

describe('QueueController', () => {
  let controller: QueueController;
  let queueService: MockedQueueService;

  beforeEach(async () => {
    queueService = {
      createEntry: jest.fn(),
      getStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [QueueController],
      providers: [
        {
          provide: QueueService,
          useValue: queueService,
        },
      ],
    }).compile();

    controller = module.get<QueueController>(QueueController);
  });

  describe('POST /entries', () => {
    it('포지션이 있을 때 서비스 결과를 반환하고 쿠키를 설정한다', async () => {
      const { response, cookie } = createResponse();
      queueService.createEntry.mockResolvedValue({
        userId: 'abc',
        position: 1,
      });

      const result = await controller.createEntry(createRequest(), response);

      expect(queueService.createEntry).toHaveBeenCalledWith(undefined);
      expect(cookie).toHaveBeenCalledWith('waiting-token', 'abc', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 1000 * 60 * 60 * 24,
      });
      expect(result).toEqual({ userId: 'abc', position: 1 });
    });

    it('포지션이 null이면 쿠키를 설정하지 않는다', async () => {
      const { response, cookie } = createResponse();
      queueService.createEntry.mockResolvedValue({
        userId: 'abc',
        position: null,
      });

      const result = await controller.createEntry(createRequest(), response);

      expect(cookie).not.toHaveBeenCalled();
      expect(result.position).toBeNull();
    });

    it('쿠키에 있는 토큰을 서비스로 전달한다', async () => {
      const { response } = createResponse();
      const request = createRequest({ 'waiting-token': 'token-123' });
      queueService.createEntry.mockResolvedValue({
        userId: 'token-123',
        position: 2,
      });

      await controller.createEntry(request, response);

      expect(queueService.createEntry).toHaveBeenCalledWith('token-123');
    });
  });

  describe('GET /entries/me', () => {
    it('쿠키에 토큰이 있고 대기열에 있으면 position을 반환한다', async () => {
      const request = createRequest({ 'waiting-token': 'token-123' });
      queueService.getStatus.mockResolvedValue({ position: 5 });

      const result = await controller.getStatus(request);

      expect(queueService.getStatus).toHaveBeenCalledWith('token-123');
      expect(result).toEqual({ position: 5 });
    });

    it('쿠키에 토큰이 없으면 position null을 반환한다', async () => {
      const request = createRequest();
      queueService.getStatus.mockResolvedValue({ position: null });

      const result = await controller.getStatus(request);

      expect(queueService.getStatus).toHaveBeenCalledWith(undefined);
      expect(result).toEqual({ position: null });
    });

    it('쿠키에 토큰은 있지만 대기열에 없으면 position null을 반환한다', async () => {
      const request = createRequest({ 'waiting-token': 'unknown-token' });
      queueService.getStatus.mockResolvedValue({ position: null });

      const result = await controller.getStatus(request);

      expect(queueService.getStatus).toHaveBeenCalledWith('unknown-token');
      expect(result).toEqual({ position: null });
    });
  });
});
