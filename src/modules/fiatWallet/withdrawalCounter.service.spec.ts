import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DateTime } from 'luxon';
import { RedisService } from '../../services/redis/redis.service';
import { WithdrawalCounterService } from './withdrawalCounter.service';

describe('WithdrawalCounterService', () => {
  let service: WithdrawalCounterService;
  let redisService: jest.Mocked<RedisService>;

  const mockRedisClient = {
    incr: jest.fn(),
  };

  beforeEach(async () => {
    const mockRedisService = {
      getClient: jest.fn().mockReturnValue(mockRedisClient),
      get: jest.fn(),
      del: jest.fn(),
      expire: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WithdrawalCounterService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<WithdrawalCounterService>(WithdrawalCounterService);
    redisService = module.get(RedisService);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('incrementDailyAttempts', () => {
    it('should increment counter and set TTL on first attempt', async () => {
      const userId = 'user-123';
      const mockNow = DateTime.fromObject({ year: 2025, month: 11, day: 10, hour: 14, minute: 30 }, { zone: 'utc' });
      const mockEndOfDay = mockNow.endOf('day');
      const expectedTTL = Math.floor(mockEndOfDay.diff(mockNow, 'seconds').seconds);

      jest.spyOn(DateTime, 'now').mockReturnValue(mockNow as DateTime<true>);
      mockRedisClient.incr.mockResolvedValue(1);
      redisService.expire.mockResolvedValue(1);

      const result = await service.incrementDailyAttempts(userId);

      expect(mockRedisClient.incr).toHaveBeenCalledWith(`withdrawal-attempts:daily:${userId}`);
      expect(redisService.expire).toHaveBeenCalledWith(`withdrawal-attempts:daily:${userId}`, expectedTTL);
      expect(result).toBe(1);
    });

    it('should increment counter without setting TTL on subsequent attempts', async () => {
      const userId = 'user-123';

      mockRedisClient.incr.mockResolvedValue(5);

      const result = await service.incrementDailyAttempts(userId);

      expect(mockRedisClient.incr).toHaveBeenCalledWith(`withdrawal-attempts:daily:${userId}`);
      expect(redisService.expire).not.toHaveBeenCalled();
      expect(result).toBe(5);
    });

    it('should handle increment to 2 without setting TTL', async () => {
      const userId = 'user-456';

      mockRedisClient.incr.mockResolvedValue(2);

      const result = await service.incrementDailyAttempts(userId);

      expect(mockRedisClient.incr).toHaveBeenCalledWith(`withdrawal-attempts:daily:${userId}`);
      expect(redisService.expire).not.toHaveBeenCalled();
      expect(result).toBe(2);
    });
  });

  describe('getDailyAttempts', () => {
    it('should return current attempt count when attempts exist', async () => {
      const userId = 'user-123';

      redisService.get.mockResolvedValue('7');

      const result = await service.getDailyAttempts(userId);

      expect(redisService.get).toHaveBeenCalledWith(`withdrawal-attempts:daily:${userId}`);
      expect(result).toBe(7);
    });

    it('should return 0 when no attempts exist', async () => {
      const userId = 'user-123';

      redisService.get.mockResolvedValue(null);

      const result = await service.getDailyAttempts(userId);

      expect(redisService.get).toHaveBeenCalledWith(`withdrawal-attempts:daily:${userId}`);
      expect(result).toBe(0);
    });

    it('should return 0 when attempts is undefined', async () => {
      const userId = 'user-456';

      redisService.get.mockResolvedValue(undefined);

      const result = await service.getDailyAttempts(userId);

      expect(result).toBe(0);
    });
  });

  describe('checkDailyLimit', () => {
    it('should pass when user is under daily limit', async () => {
      const userId = 'user-123';
      const maxAttempts = 10;

      redisService.get.mockResolvedValue('5');

      await expect(service.checkDailyLimit(userId, maxAttempts)).resolves.not.toThrow();

      expect(redisService.get).toHaveBeenCalledWith(`withdrawal-attempts:daily:${userId}`);
    });

    it('should pass when user has no attempts yet', async () => {
      const userId = 'user-123';
      const maxAttempts = 10;

      redisService.get.mockResolvedValue(null);

      await expect(service.checkDailyLimit(userId, maxAttempts)).resolves.not.toThrow();
    });

    it('should throw BadRequestException when user has reached daily limit', async () => {
      const userId = 'user-123';
      const maxAttempts = 10;
      const mockNow = DateTime.fromObject({ year: 2025, month: 11, day: 10, hour: 20, minute: 30 }, { zone: 'utc' });
      const mockEndOfDay = mockNow.endOf('day');
      const expectedHours = Math.ceil(mockEndOfDay.diff(mockNow, 'hours').hours);

      jest.spyOn(DateTime, 'now').mockReturnValue(mockNow as DateTime<true>);
      redisService.get.mockResolvedValue('10');

      await expect(service.checkDailyLimit(userId, maxAttempts)).rejects.toThrow(BadRequestException);
      await expect(service.checkDailyLimit(userId, maxAttempts)).rejects.toThrow(
        `You have reached your daily withdrawal attempt limit of ${maxAttempts}. Please try again in ${expectedHours} hour(s).`,
      );
    });

    it('should throw BadRequestException when user has exceeded daily limit', async () => {
      const userId = 'user-123';
      const maxAttempts = 10;
      const mockNow = DateTime.fromObject({ year: 2025, month: 11, day: 10, hour: 23, minute: 45 }, { zone: 'utc' });
      const mockEndOfDay = mockNow.endOf('day');
      const expectedHours = Math.ceil(mockEndOfDay.diff(mockNow, 'hours').hours);

      jest.spyOn(DateTime, 'now').mockReturnValue(mockNow as DateTime<true>);
      redisService.get.mockResolvedValue('15');

      await expect(service.checkDailyLimit(userId, maxAttempts)).rejects.toThrow(BadRequestException);
      await expect(service.checkDailyLimit(userId, maxAttempts)).rejects.toThrow(
        `You have reached your daily withdrawal attempt limit of ${maxAttempts}. Please try again in ${expectedHours} hour(s).`,
      );
    });

    it('should calculate correct hours until reset at different times of day', async () => {
      const userId = 'user-123';
      const maxAttempts = 5;
      const mockNow = DateTime.fromObject({ year: 2025, month: 11, day: 10, hour: 2, minute: 15 }, { zone: 'utc' });
      const mockEndOfDay = mockNow.endOf('day');
      const expectedHours = Math.ceil(mockEndOfDay.diff(mockNow, 'hours').hours);

      jest.spyOn(DateTime, 'now').mockReturnValue(mockNow as DateTime<true>);
      redisService.get.mockResolvedValue('5');

      await expect(service.checkDailyLimit(userId, maxAttempts)).rejects.toThrow(
        `You have reached your daily withdrawal attempt limit of ${maxAttempts}. Please try again in ${expectedHours} hour(s).`,
      );
    });

    it('should pass when attempts are just below limit', async () => {
      const userId = 'user-123';
      const maxAttempts = 10;

      redisService.get.mockResolvedValue('9');

      await expect(service.checkDailyLimit(userId, maxAttempts)).resolves.not.toThrow();
    });
  });

  describe('resetDailyAttempts', () => {
    it('should delete the daily attempts key', async () => {
      const userId = 'user-123';

      redisService.del.mockResolvedValue(1);

      await service.resetDailyAttempts(userId);

      expect(redisService.del).toHaveBeenCalledWith(`withdrawal-attempts:daily:${userId}`);
    });

    it('should handle resetting attempts that do not exist', async () => {
      const userId = 'user-456';

      redisService.del.mockResolvedValue(0);

      await service.resetDailyAttempts(userId);

      expect(redisService.del).toHaveBeenCalledWith(`withdrawal-attempts:daily:${userId}`);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete workflow: increment, check, and reset', async () => {
      const userId = 'user-789';
      const maxAttempts = 3;
      const mockNow = DateTime.fromObject({ year: 2025, month: 11, day: 10, hour: 12, minute: 0 }, { zone: 'utc' });

      jest.spyOn(DateTime, 'now').mockReturnValue(mockNow as DateTime<true>);

      // First attempt
      mockRedisClient.incr.mockResolvedValue(1);
      redisService.expire.mockResolvedValue(1);
      let attempts = await service.incrementDailyAttempts(userId);
      expect(attempts).toBe(1);
      expect(redisService.expire).toHaveBeenCalled();

      // Check limit - should pass
      redisService.get.mockResolvedValue('1');
      await expect(service.checkDailyLimit(userId, maxAttempts)).resolves.not.toThrow();

      // Second attempt
      mockRedisClient.incr.mockResolvedValue(2);
      redisService.expire.mockClear();
      attempts = await service.incrementDailyAttempts(userId);
      expect(attempts).toBe(2);
      expect(redisService.expire).not.toHaveBeenCalled();

      // Third attempt
      mockRedisClient.incr.mockResolvedValue(3);
      attempts = await service.incrementDailyAttempts(userId);
      expect(attempts).toBe(3);

      // Check limit - should fail
      redisService.get.mockResolvedValue('3');
      await expect(service.checkDailyLimit(userId, maxAttempts)).rejects.toThrow(BadRequestException);

      // Reset attempts
      redisService.del.mockResolvedValue(1);
      await service.resetDailyAttempts(userId);
      expect(redisService.del).toHaveBeenCalledWith(`withdrawal-attempts:daily:${userId}`);

      // Check after reset - should pass
      redisService.get.mockResolvedValue(null);
      await expect(service.checkDailyLimit(userId, maxAttempts)).resolves.not.toThrow();
    });

    it('should handle edge case at midnight boundary', async () => {
      const userId = 'user-midnight';
      const mockNow = DateTime.fromObject(
        { year: 2025, month: 11, day: 10, hour: 23, minute: 59, second: 30 },
        { zone: 'utc' },
      );
      const mockEndOfDay = mockNow.endOf('day');
      const expectedTTL = Math.floor(mockEndOfDay.diff(mockNow, 'seconds').seconds);

      jest.spyOn(DateTime, 'now').mockReturnValue(mockNow as DateTime<true>);
      mockRedisClient.incr.mockResolvedValue(1);
      redisService.expire.mockResolvedValue(1);

      await service.incrementDailyAttempts(userId);

      expect(redisService.expire).toHaveBeenCalledWith(`withdrawal-attempts:daily:${userId}`, expectedTTL);
      expect(expectedTTL).toBeLessThan(60);
    });

    it('should handle multiple users independently', async () => {
      const user1 = 'user-001';
      const user2 = 'user-002';

      // User 1 makes attempts
      mockRedisClient.incr.mockResolvedValueOnce(1);
      redisService.expire.mockResolvedValue(1);
      await service.incrementDailyAttempts(user1);

      // User 2 makes attempts
      mockRedisClient.incr.mockResolvedValueOnce(1);
      await service.incrementDailyAttempts(user2);

      // Check they have different keys
      redisService.get.mockResolvedValueOnce('5');
      await service.getDailyAttempts(user1);
      expect(redisService.get).toHaveBeenCalledWith(`withdrawal-attempts:daily:${user1}`);

      redisService.get.mockResolvedValueOnce('3');
      await service.getDailyAttempts(user2);
      expect(redisService.get).toHaveBeenCalledWith(`withdrawal-attempts:daily:${user2}`);
    });
  });

  describe('edge cases', () => {
    it('should handle zero maxAttempts', async () => {
      const userId = 'user-123';
      const maxAttempts = 0;

      redisService.get.mockResolvedValue('0');

      await expect(service.checkDailyLimit(userId, maxAttempts)).rejects.toThrow(BadRequestException);
    });

    it('should handle very large maxAttempts', async () => {
      const userId = 'user-123';
      const maxAttempts = 1000000;

      redisService.get.mockResolvedValue('999999');

      await expect(service.checkDailyLimit(userId, maxAttempts)).resolves.not.toThrow();
    });

    it('should handle TTL calculation at start of day', async () => {
      const userId = 'user-start-day';
      const mockNow = DateTime.fromObject(
        { year: 2025, month: 11, day: 10, hour: 0, minute: 0, second: 1 },
        { zone: 'utc' },
      );
      const mockEndOfDay = mockNow.endOf('day');
      const expectedTTL = Math.floor(mockEndOfDay.diff(mockNow, 'seconds').seconds);

      jest.spyOn(DateTime, 'now').mockReturnValue(mockNow as DateTime<true>);
      mockRedisClient.incr.mockResolvedValue(1);
      redisService.expire.mockResolvedValue(1);

      await service.incrementDailyAttempts(userId);

      expect(redisService.expire).toHaveBeenCalledWith(`withdrawal-attempts:daily:${userId}`, expectedTTL);
      expect(expectedTTL).toBeGreaterThan(86000);
      expect(expectedTTL).toBeLessThanOrEqual(86400);
    });

    it('should handle numeric string parsing correctly', async () => {
      const userId = 'user-123';

      redisService.get.mockResolvedValue('0');
      let result = await service.getDailyAttempts(userId);
      expect(result).toBe(0);

      redisService.get.mockResolvedValue('999');
      result = await service.getDailyAttempts(userId);
      expect(result).toBe(999);
    });
  });
});
