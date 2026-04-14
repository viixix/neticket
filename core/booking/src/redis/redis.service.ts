import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { PROVIDERS } from '@neticket/contracts';
import { ChainableCommander, Redis } from 'ioredis';

interface RedisWithCommands extends Redis {
  atomicReservation(
    numKeys: number,
    ...args: (string | number)[]
  ): Promise<[number, number]>;
}

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(
    @Inject(PROVIDERS.REDIS_CORE)
    private readonly coreClient: RedisWithCommands,
    @Inject(PROVIDERS.REDIS_QUEUE)
    private readonly queueClient: Redis,
  ) {}

  onModuleDestroy() {
    this.coreClient.disconnect();
    this.queueClient.disconnect();
  }

  async atomicReservation(
    seatKeys: string[],
    userId: string,
    rankKey: string,
    userReservedKey: string,
  ): Promise<[number, number]> {
    return this.coreClient.atomicReservation(
      seatKeys.length,
      ...seatKeys,
      userId,
      rankKey,
      userReservedKey,
    );
  }

  async setNx(key: string, value: string): Promise<boolean> {
    const result = await this.coreClient.setnx(key, value);
    return result === 1;
  }

  async setNxWithTtl(
    key: string,
    value: string,
    ttlMs: number,
  ): Promise<boolean> {
    const result = await this.coreClient.set(key, value, 'PX', ttlMs, 'NX');
    return result === 'OK';
  }

  async msetnx(kv: Record<string, string>): Promise<boolean> {
    const result = await this.coreClient.msetnx(...Object.entries(kv).flat());
    return Number(result) === 1;
  }

  async set(key: string, value: string): Promise<string> {
    return this.coreClient.set(key, value);
  }

  async setWithTtl(
    key: string,
    value: string,
    ttlSec: number,
  ): Promise<string> {
    return this.coreClient.set(key, value, 'EX', ttlSec);
  }

  async get(key: string): Promise<string | null> {
    return this.coreClient.get(key);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.coreClient.hget(key, field);
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    return this.coreClient.hset(key, field, value);
  }

  async hsetnx(key: string, field: string, value: string): Promise<number> {
    return this.coreClient.hsetnx(key, field, value);
  }

  async getQueue(key: string): Promise<string | null> {
    return this.queueClient.get(key);
  }

  async hgetQueue(key: string, field: string): Promise<string | null> {
    return this.queueClient.hget(key, field);
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    if (keys.length === 0) return [];
    return this.coreClient.mget(...keys);
  }

  async del(key: string): Promise<number> {
    return this.coreClient.del(key);
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    return this.coreClient.sadd(key, ...members);
  }

  async srandmember(key: string): Promise<string | null> {
    return this.coreClient.srandmember(key);
  }

  async incr(key: string): Promise<number> {
    return this.coreClient.incr(key);
  }

  async sismember(key: string, member: string): Promise<boolean> {
    const result = await this.coreClient.sismember(key, member);
    return result === 1;
  }

  async flushAll(): Promise<string> {
    return this.coreClient.flushall();
  }

  async flushAllQueue(): Promise<string> {
    return this.queueClient.flushall();
  }

  async deleteAllExceptPrefix(prefix: string): Promise<number> {
    return this.deleteAllExceptPrefixWithClient(this.coreClient, prefix);
  }

  async deleteAllExceptPrefixQueue(prefix: string): Promise<number> {
    return this.deleteAllExceptPrefixWithClient(this.queueClient, prefix);
  }

  async publishToQueue(channel: string, message: string): Promise<number> {
    return this.queueClient.publish(channel, message);
  }

  async publishToCore(channel: string, message: string): Promise<number> {
    return this.coreClient.publish(channel, message);
  }

  pipeline(): ChainableCommander {
    return this.coreClient.pipeline();
  }

  async brpopQueueList(
    key: string,
    timeoutSeconds: number,
  ): Promise<[string, string] | null> {
    return this.queueClient.brpop(key, timeoutSeconds);
  }

  async existsInQueue(key: string): Promise<boolean> {
    const result = await this.queueClient.exists(key);
    return result > 0;
  }

  private async deleteAllExceptPrefixWithClient(
    client: Redis,
    prefix: string,
  ): Promise<number> {
    let totalDeleted = 0;

    const stream = client.scanStream({
      match: `*`,
      count: 1000,
    });

    for await (const rawKeys of stream) {
      const keys = rawKeys as string[];
      const targets = keys.filter((key: string) => !key.startsWith(prefix));

      if (targets.length > 0) {
        const deletedCount = await client.unlink(...targets);
        totalDeleted += deletedCount;
      }
    }

    return totalDeleted;
  }
}
