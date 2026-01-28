import { Inject, Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { KnexDB } from './database';
import { PlatformStatusService } from './modules/platformStatus/platformStatus.service';
import { RedisService } from './services/redis/redis.service';

@Injectable()
export class AppService {
  private readonly gitMeta: { commit: string; branch: string; buildTime: string };

  constructor(
    @Inject(RedisService)
    private readonly redisService: RedisService,
    @Inject(PlatformStatusService)
    private readonly platformStatusService: PlatformStatusService,
  ) {
    try {
      const json = readFileSync(join(__dirname, '..', '..', 'git-commit.json'), 'utf8');
      this.gitMeta = JSON.parse(json);
    } catch {
      this.gitMeta = { commit: 'unknown', branch: 'unknown', buildTime: 'unknown' };
    }
  }

  async getHealth() {
    // Check database connection
    let databaseStatus = 'ok';
    let databaseError: string | null = null;
    try {
      await KnexDB.connection().raw('SELECT 1');
    } catch (error) {
      databaseStatus = 'error';
      databaseError = error?.message || 'Database connection failed';
    }

    // Check Redis connection
    let redisStatus = 'ok';
    let redisError: string | null = null;
    try {
      const redisClient = this.redisService.getClient();
      await redisClient.ping();
    } catch (error) {
      redisStatus = 'error';
      redisError = error?.message || 'Redis connection failed';
    }

    // Get platform status
    const platformStatus = await this.platformStatusService.getPlatformStatus({});

    return {
      status: databaseStatus === 'ok' && redisStatus === 'ok' ? 'ok' : 'degraded',
      ...this.gitMeta,
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: databaseStatus,
          ...(databaseError && { error: databaseError }),
        },
        redis: {
          status: redisStatus,
          ...(redisError && { error: redisError }),
        },
      },
      platform_status: platformStatus,
    };
  }

  getHello(): string {
    return 'OneDosh API Service Up and Running';
  }
}
