import { Injectable, Logger } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { RedisService } from '../../services/redis/redis.service';

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);

  constructor(private readonly redisService: RedisService) {}

  async increment(key: string, ttl: number, limit: number, blockDuration: number): Promise<ThrottlerStorageRecord> {
    const redisClient = this.redisService.getClient();
    const hits = await redisClient.incr(key);

    // ─── Start the normal window on first hit ───────────────────────────────
    if (hits === 1) {
      await redisClient.expire(key, ttl);
    }

    // ─── When crossing the limit, switch to the block window exactly once ────
    if (hits === limit + 1) {
      await redisClient.expire(key, blockDuration);
    }

    // ─── Compute remaining time and block status ─────────────────────────────
    const timeLeft = await redisClient.ttl(key);
    const isBlocked = hits > limit;
    const windowSize = isBlocked ? blockDuration : ttl;
    const windowType = isBlocked ? 'block' : 'window';

    // ─── Debug output ────────────────────────────────────────────────────────
    this.logger.debug(
      `[RedisThrottlerStorage] key=${key} hits=${hits}/${limit} ` +
        `timeLeft=${timeLeft}s of ${windowSize}s (${windowType})`,
    );

    // ─── Return the ThrottlerStorageRecord ────────────────────────
    return {
      totalHits: hits,
      timeToExpire: timeLeft,
      isBlocked,
      timeToBlockExpire: isBlocked ? timeLeft : 0,
    };
  }
}
