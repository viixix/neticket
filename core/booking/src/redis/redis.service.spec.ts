import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service';
import { PROVIDERS } from '@neticket/contracts';
import { Redis } from 'ioredis';

describe('RedisService', () => {
  let service: RedisService;
  let redisClient: jest.Mocked<Partial<Redis>>;

  beforeEach(async () => {
    redisClient = {
      set: jest.fn(),
      get: jest.fn(),
      setnx: jest.fn(),
      del: jest.fn(),
      flushall: jest.fn(),
      incr: jest.fn(),
      sadd: jest.fn(),
      sismember: jest.fn(),
      mget: jest.fn(),
      msetnx: jest.fn(),
      disconnect: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: PROVIDERS.REDIS_CORE,
          useValue: redisClient,
        },
        {
          provide: PROVIDERS.REDIS_QUEUE,
          useValue: redisClient,
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  describe('setNx', () => {
    it('키가 설정되면 true를 반환해야 한다', async () => {
      jest.mocked(redisClient.setnx!).mockResolvedValue(1);
      const result = await service.setNx('key', 'value');
      expect(result).toBe(true);
    });

    it('키가 설정되지 않으면 false를 반환해야 한다', async () => {
      jest.mocked(redisClient.setnx!).mockResolvedValue(0);
      const result = await service.setNx('key', 'value');
      expect(result).toBe(false);
    });
  });

  describe('incr', () => {
    it('키 값을 증가시키고 새로운 값을 반환해야 한다', async () => {
      jest.mocked(redisClient.incr!).mockResolvedValue(2);
      const result = await service.incr('key');
      expect(result).toBe(2);
      expect(jest.mocked(redisClient.incr!)).toHaveBeenCalledWith('key');
    });
  });

  describe('sadd', () => {
    it('멤버들을 set에 추가해야 한다', async () => {
      jest.mocked(redisClient.sadd!).mockResolvedValue(2);
      const result = await service.sadd('key', 'm1', 'm2');
      expect(result).toBe(2);
      expect(jest.mocked(redisClient.sadd!)).toHaveBeenCalledWith(
        'key',
        'm1',
        'm2',
      );
    });
  });

  describe('sismember', () => {
    it('멤버가 존재하면 true를 반환해야 한다', async () => {
      jest.mocked(redisClient.sismember!).mockResolvedValue(1);
      const result = await service.sismember('key', 'member');
      expect(result).toBe(true);
    });

    it('멤버가 존재하지 않으면 false를 반환해야 한다', async () => {
      jest.mocked(redisClient.sismember!).mockResolvedValue(0);
      const result = await service.sismember('key', 'member');
      expect(result).toBe(false);
    });
  });

  describe('mget', () => {
    it('주어진 키들에 대한 값을 반환해야 한다', async () => {
      jest.mocked(redisClient.mget!).mockResolvedValue(['v1', null]);
      const result = await service.mget(['k1', 'k2']);
      expect(result).toEqual(['v1', null]);
    });

    it('키가 비어있으면 빈 배열을 반환해야 한다', async () => {
      const result = await service.mget([]);
      expect(result).toEqual([]);
      expect(jest.mocked(redisClient.mget!)).not.toHaveBeenCalled();
    });
  });

  describe('msetnx', () => {
    it('모든 키가 설정되면 true를 반환해야 한다', async () => {
      jest.mocked(redisClient.msetnx!).mockResolvedValue(1);
      const result = await service.msetnx({ k1: 'v1', k2: 'v2' });
      expect(result).toBe(true);
    });

    it('하나의 키라도 존재하여 설정되지 않으면 false를 반환해야 한다', async () => {
      jest.mocked(redisClient.msetnx!).mockResolvedValue(0);
      const result = await service.msetnx({ k1: 'v1', k2: 'v2' });
      expect(result).toBe(false);
    });
  });
});
