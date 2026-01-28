import { Injectable, Logger } from '@nestjs/common';
import { IAccessBlockerAttempt } from './accessBlockerAttempt.interface';
import { RedisService } from '../redis.service';

@Injectable()
export class AccessBlockerAttemptService {
  private readonly logger = new Logger(AccessBlockerAttemptService.name);
  private readonly redisKeyPrefix = process.env.ACCESS_BLOCK_ATTEMPT;

  constructor(private readonly redisService: RedisService) {}

  async recordAttempt(data: IAccessBlockerAttempt): Promise<void> {
    try {
      const key = `${this.redisKeyPrefix}:${data.ipAddress}`;
      const attempt = {
        ...data,
        timestamp: Date.now(),
      };

      await this.redisService.lpush(key, JSON.stringify(attempt));

      this.logger.log(`Recorded access block attempt for IP: ${data.ipAddress}`);
    } catch (error) {
      this.logger.error(`Failed to record access block attempt: ${error.message}`);
      throw error;
    }
  }
}
