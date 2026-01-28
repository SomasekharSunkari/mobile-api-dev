import { Logger } from '@nestjs/common';
import { RedisCacheService } from '../../services/redis/redis-cache.service';
import { RedisService } from '../../services/redis/redis.service';
import { HttpCacheService } from './index';

describe('HttpCacheService', () => {
  let service: HttpCacheService;
  let redisCacheService: jest.Mocked<RedisCacheService>;
  let redisService: jest.Mocked<RedisService>;
  let mockRedisClient: { del: jest.Mock };

  beforeEach(() => {
    mockRedisClient = {
      del: jest.fn(),
    };

    redisService = {
      keys: jest.fn(),
      getClient: jest.fn().mockReturnValue(mockRedisClient),
    } as unknown as jest.Mocked<RedisService>;

    redisCacheService = {
      getRedisService: jest.fn().mockReturnValue(redisService),
      del: jest.fn(),
    } as unknown as jest.Mocked<RedisCacheService>;

    service = new HttpCacheService(redisCacheService);

    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('clearByPrefix', () => {
    it('should clear cache entries matching the prefix pattern', async () => {
      const keys = ['http_cache:banks:path1', 'http_cache:banks:path2'];
      redisService.keys.mockResolvedValue(keys);
      mockRedisClient.del.mockResolvedValue(2);

      const result = await service.clearByPrefix('banks');

      expect(redisService.keys).toHaveBeenCalledWith('http_cache:banks:*');
      expect(mockRedisClient.del).toHaveBeenCalledWith(...keys);
      expect(result).toBe(2);
    });

    it('should return 0 when no keys match the prefix', async () => {
      redisService.keys.mockResolvedValue([]);

      const result = await service.clearByPrefix('nonexistent');

      expect(result).toBe(0);
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });

  describe('clearByPath', () => {
    it('should clear cache entries matching the path pattern', async () => {
      const keys = ['http_cache:prefix:/banks'];
      redisService.keys.mockResolvedValue(keys);
      mockRedisClient.del.mockResolvedValue(1);

      const result = await service.clearByPath('/banks');

      expect(redisService.keys).toHaveBeenCalledWith('http_cache:*:/banks*');
      expect(mockRedisClient.del).toHaveBeenCalledWith(...keys);
      expect(result).toBe(1);
    });

    it('should return 0 when no keys match the path', async () => {
      redisService.keys.mockResolvedValue([]);

      const result = await service.clearByPath('/nonexistent');

      expect(result).toBe(0);
    });
  });

  describe('clearAll', () => {
    it('should clear all HTTP cache entries', async () => {
      const keys = ['http_cache:a', 'http_cache:b', 'http_cache:c'];
      redisService.keys.mockResolvedValue(keys);
      mockRedisClient.del.mockResolvedValue(3);

      const result = await service.clearAll();

      expect(redisService.keys).toHaveBeenCalledWith('http_cache:*');
      expect(mockRedisClient.del).toHaveBeenCalledWith(...keys);
      expect(result).toBe(3);
    });

    it('should return 0 when no cache entries exist', async () => {
      redisService.keys.mockResolvedValue([]);

      const result = await service.clearAll();

      expect(result).toBe(0);
    });
  });

  describe('clearByPattern', () => {
    it('should clear cache entries matching the custom pattern', async () => {
      const pattern = 'http_cache:custom:*';
      const keys = ['http_cache:custom:key1', 'http_cache:custom:key2'];
      redisService.keys.mockResolvedValue(keys);
      mockRedisClient.del.mockResolvedValue(2);

      const result = await service.clearByPattern(pattern);

      expect(redisService.keys).toHaveBeenCalledWith(pattern);
      expect(mockRedisClient.del).toHaveBeenCalledWith(...keys);
      expect(result).toBe(2);
    });

    it('should return 0 and log debug message when no keys match', async () => {
      redisService.keys.mockResolvedValue([]);
      const debugSpy = jest.spyOn(Logger.prototype, 'debug');

      const result = await service.clearByPattern('http_cache:empty:*');

      expect(result).toBe(0);
      expect(debugSpy).toHaveBeenCalledWith('No cache keys found matching pattern: http_cache:empty:*');
    });

    it('should log success message when keys are deleted', async () => {
      const keys = ['key1', 'key2'];
      redisService.keys.mockResolvedValue(keys);
      mockRedisClient.del.mockResolvedValue(2);
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      await service.clearByPattern('http_cache:test:*');

      expect(logSpy).toHaveBeenCalledWith('Cleared 2 cache entries matching pattern: http_cache:test:*');
    });

    it('should throw error and log when Redis operation fails', async () => {
      const error = new Error('Redis connection failed');
      redisService.keys.mockRejectedValue(error);
      const errorSpy = jest.spyOn(Logger.prototype, 'error');

      await expect(service.clearByPattern('http_cache:fail:*')).rejects.toThrow('Redis connection failed');
      expect(errorSpy).toHaveBeenCalledWith('Failed to clear cache for pattern http_cache:fail:*:', error);
    });
  });

  describe('clearByKey', () => {
    it('should return true when key is successfully deleted', async () => {
      redisCacheService.del.mockResolvedValue(1);

      const result = await service.clearByKey('banks:/banks:query');

      expect(redisCacheService.del).toHaveBeenCalledWith('http_cache:banks:/banks:query');
      expect(result).toBe(true);
    });

    it('should return false when key does not exist', async () => {
      redisCacheService.del.mockResolvedValue(0);

      const result = await service.clearByKey('nonexistent:key');

      expect(redisCacheService.del).toHaveBeenCalledWith('http_cache:nonexistent:key');
      expect(result).toBe(false);
    });
  });
});
