import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../../services/redis/redis.service';
import { WithdrawalSessionService } from './withdrawalSession.service';

describe('WithdrawalSessionService', () => {
  let service: WithdrawalSessionService;
  let redisService: jest.Mocked<RedisService>;

  const mockRedisClient = {
    sadd: jest.fn(),
    srem: jest.fn(),
    smembers: jest.fn(),
  };

  beforeEach(async () => {
    const mockRedisService = {
      getClient: jest.fn().mockReturnValue(mockRedisClient),
      del: jest.fn(),
      expire: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WithdrawalSessionService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<WithdrawalSessionService>(WithdrawalSessionService);
    redisService = module.get(RedisService);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('startSession', () => {
    it('should start a withdrawal session and set TTL', async () => {
      const userId = 'user-123';
      const withdrawalId = 'withdrawal-456';
      const expectedKey = `withdrawal-session:active:${userId}`;

      mockRedisClient.sadd.mockResolvedValue(1);
      redisService.expire.mockResolvedValue(1);

      await service.startSession(userId, withdrawalId);

      expect(mockRedisClient.sadd).toHaveBeenCalledWith(expectedKey, withdrawalId);
      expect(redisService.expire).toHaveBeenCalledWith(expectedKey, 300);
    });

    it('should handle starting multiple sessions for same user', async () => {
      const userId = 'user-123';
      const withdrawalId1 = 'withdrawal-456';
      const withdrawalId2 = 'withdrawal-789';
      const expectedKey = `withdrawal-session:active:${userId}`;

      mockRedisClient.sadd.mockResolvedValue(1);
      redisService.expire.mockResolvedValue(1);

      await service.startSession(userId, withdrawalId1);
      await service.startSession(userId, withdrawalId2);

      expect(mockRedisClient.sadd).toHaveBeenCalledTimes(2);
      expect(mockRedisClient.sadd).toHaveBeenCalledWith(expectedKey, withdrawalId1);
      expect(mockRedisClient.sadd).toHaveBeenCalledWith(expectedKey, withdrawalId2);
      expect(redisService.expire).toHaveBeenCalledTimes(2);
    });
  });

  describe('endSession', () => {
    it('should end a session and delete key when no sessions remain', async () => {
      const userId = 'user-123';
      const withdrawalId = 'withdrawal-456';
      const expectedKey = `withdrawal-session:active:${userId}`;

      mockRedisClient.srem.mockResolvedValue(1);
      mockRedisClient.smembers.mockResolvedValue([]);
      redisService.del.mockResolvedValue(1);

      await service.endSession(userId, withdrawalId);

      expect(mockRedisClient.srem).toHaveBeenCalledWith(expectedKey, withdrawalId);
      expect(mockRedisClient.smembers).toHaveBeenCalledWith(expectedKey);
      expect(redisService.del).toHaveBeenCalledWith(expectedKey);
    });

    it('should end a session but not delete key when other sessions remain', async () => {
      const userId = 'user-123';
      const withdrawalId = 'withdrawal-456';
      const expectedKey = `withdrawal-session:active:${userId}`;

      mockRedisClient.srem.mockResolvedValue(1);
      mockRedisClient.smembers.mockResolvedValue(['withdrawal-789']);
      redisService.del.mockResolvedValue(1);

      await service.endSession(userId, withdrawalId);

      expect(mockRedisClient.srem).toHaveBeenCalledWith(expectedKey, withdrawalId);
      expect(mockRedisClient.smembers).toHaveBeenCalledWith(expectedKey);
      expect(redisService.del).not.toHaveBeenCalled();
    });

    it('should handle ending a session that does not exist', async () => {
      const userId = 'user-123';
      const withdrawalId = 'withdrawal-456';
      const expectedKey = `withdrawal-session:active:${userId}`;

      mockRedisClient.srem.mockResolvedValue(0);
      mockRedisClient.smembers.mockResolvedValue([]);
      redisService.del.mockResolvedValue(0);

      await service.endSession(userId, withdrawalId);

      expect(mockRedisClient.srem).toHaveBeenCalledWith(expectedKey, withdrawalId);
      expect(redisService.del).toHaveBeenCalledWith(expectedKey);
    });
  });

  describe('getActiveSessions', () => {
    it('should return active sessions when they exist', async () => {
      const userId = 'user-123';
      const expectedKey = `withdrawal-session:active:${userId}`;
      const mockSessions = ['withdrawal-456', 'withdrawal-789'];

      mockRedisClient.smembers.mockResolvedValue(mockSessions);

      const result = await service.getActiveSessions(userId);

      expect(mockRedisClient.smembers).toHaveBeenCalledWith(expectedKey);
      expect(result).toEqual(mockSessions);
    });

    it('should return empty array when no active sessions exist', async () => {
      const userId = 'user-123';
      const expectedKey = `withdrawal-session:active:${userId}`;

      mockRedisClient.smembers.mockResolvedValue([]);

      const result = await service.getActiveSessions(userId);

      expect(mockRedisClient.smembers).toHaveBeenCalledWith(expectedKey);
      expect(result).toEqual([]);
    });

    it('should return empty array when smembers returns null', async () => {
      const userId = 'user-123';
      const expectedKey = `withdrawal-session:active:${userId}`;

      mockRedisClient.smembers.mockResolvedValue(null);

      const result = await service.getActiveSessions(userId);

      expect(mockRedisClient.smembers).toHaveBeenCalledWith(expectedKey);
      expect(result).toEqual([]);
    });

    it('should return empty array when smembers returns undefined', async () => {
      const userId = 'user-456';
      const expectedKey = `withdrawal-session:active:${userId}`;

      mockRedisClient.smembers.mockResolvedValue(undefined);

      const result = await service.getActiveSessions(userId);

      expect(mockRedisClient.smembers).toHaveBeenCalledWith(expectedKey);
      expect(result).toEqual([]);
    });
  });

  describe('hasActiveSession', () => {
    it('should return true when user has active sessions', async () => {
      const userId = 'user-123';

      mockRedisClient.smembers.mockResolvedValue(['withdrawal-456']);

      const result = await service.hasActiveSession(userId);

      expect(result).toBe(true);
    });

    it('should return false when user has no active sessions', async () => {
      const userId = 'user-123';

      mockRedisClient.smembers.mockResolvedValue([]);

      const result = await service.hasActiveSession(userId);

      expect(result).toBe(false);
    });

    it('should return false when smembers returns null', async () => {
      const userId = 'user-123';

      mockRedisClient.smembers.mockResolvedValue(null);

      const result = await service.hasActiveSession(userId);

      expect(result).toBe(false);
    });

    it('should return true when user has multiple active sessions', async () => {
      const userId = 'user-123';

      mockRedisClient.smembers.mockResolvedValue(['withdrawal-456', 'withdrawal-789', 'withdrawal-101']);

      const result = await service.hasActiveSession(userId);

      expect(result).toBe(true);
    });
  });

  describe('checkAndBlockConcurrent', () => {
    it('should pass when user has no active sessions', async () => {
      const userId = 'user-123';

      mockRedisClient.smembers.mockResolvedValue([]);

      await expect(service.checkAndBlockConcurrent(userId)).resolves.not.toThrow();
    });

    it('should throw BadRequestException when user has active session', async () => {
      const userId = 'user-123';

      mockRedisClient.smembers.mockResolvedValue(['withdrawal-456']);

      await expect(service.checkAndBlockConcurrent(userId)).rejects.toThrow(BadRequestException);
      await expect(service.checkAndBlockConcurrent(userId)).rejects.toThrow(
        'Another withdrawal is currently in progress. Please wait for it to complete before initiating a new withdrawal.',
      );
    });

    it('should throw BadRequestException when user has multiple active sessions', async () => {
      const userId = 'user-123';

      mockRedisClient.smembers.mockResolvedValue(['withdrawal-456', 'withdrawal-789']);

      await expect(service.checkAndBlockConcurrent(userId)).rejects.toThrow(BadRequestException);
      await expect(service.checkAndBlockConcurrent(userId)).rejects.toThrow(
        'Another withdrawal is currently in progress. Please wait for it to complete before initiating a new withdrawal.',
      );
    });

    it('should call getActiveSessions twice when blocking concurrent withdrawal', async () => {
      const userId = 'user-123';
      const mockSessions = ['withdrawal-456'];

      mockRedisClient.smembers.mockResolvedValue(mockSessions);

      await expect(service.checkAndBlockConcurrent(userId)).rejects.toThrow(BadRequestException);

      expect(mockRedisClient.smembers).toHaveBeenCalledTimes(2);
    });
  });

  describe('clearAllSessions', () => {
    it('should clear all sessions for a user', async () => {
      const userId = 'user-123';
      const expectedKey = `withdrawal-session:active:${userId}`;

      redisService.del.mockResolvedValue(1);

      await service.clearAllSessions(userId);

      expect(redisService.del).toHaveBeenCalledWith(expectedKey);
    });

    it('should handle clearing sessions when none exist', async () => {
      const userId = 'user-456';
      const expectedKey = `withdrawal-session:active:${userId}`;

      redisService.del.mockResolvedValue(0);

      await service.clearAllSessions(userId);

      expect(redisService.del).toHaveBeenCalledWith(expectedKey);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete workflow: start, check, and end session', async () => {
      const userId = 'user-123';
      const withdrawalId = 'withdrawal-456';

      // Start session
      mockRedisClient.sadd.mockResolvedValue(1);
      redisService.expire.mockResolvedValue(1);
      await service.startSession(userId, withdrawalId);

      // Check for active session - should have one
      mockRedisClient.smembers.mockResolvedValue([withdrawalId]);
      let hasActive = await service.hasActiveSession(userId);
      expect(hasActive).toBe(true);

      // Try to start another withdrawal - should be blocked
      await expect(service.checkAndBlockConcurrent(userId)).rejects.toThrow(BadRequestException);

      // End session
      mockRedisClient.srem.mockResolvedValue(1);
      mockRedisClient.smembers.mockResolvedValue([]);
      redisService.del.mockResolvedValue(1);
      await service.endSession(userId, withdrawalId);

      // Check for active session - should have none
      hasActive = await service.hasActiveSession(userId);
      expect(hasActive).toBe(false);

      // Now should be able to proceed
      await expect(service.checkAndBlockConcurrent(userId)).resolves.not.toThrow();
    });

    it('should handle multiple concurrent session starts and ends', async () => {
      const userId = 'user-123';
      const withdrawal1 = 'withdrawal-456';
      const withdrawal2 = 'withdrawal-789';

      // Start first session
      mockRedisClient.sadd.mockResolvedValue(1);
      redisService.expire.mockResolvedValue(1);
      await service.startSession(userId, withdrawal1);

      // Start second session (simulating race condition)
      await service.startSession(userId, withdrawal2);

      // Check both sessions are active
      mockRedisClient.smembers.mockResolvedValue([withdrawal1, withdrawal2]);
      const sessions = await service.getActiveSessions(userId);
      expect(sessions).toHaveLength(2);

      // End first session - second should remain
      mockRedisClient.srem.mockResolvedValue(1);
      mockRedisClient.smembers.mockResolvedValue([withdrawal2]);
      await service.endSession(userId, withdrawal1);
      expect(redisService.del).not.toHaveBeenCalled();

      // End second session - should delete key
      mockRedisClient.smembers.mockResolvedValue([]);
      redisService.del.mockResolvedValue(1);
      await service.endSession(userId, withdrawal2);
      expect(redisService.del).toHaveBeenCalledWith(`withdrawal-session:active:${userId}`);
    });

    it('should handle clearing all sessions during active withdrawals', async () => {
      const userId = 'user-123';
      const withdrawalId = 'withdrawal-456';

      // Start session
      mockRedisClient.sadd.mockResolvedValue(1);
      redisService.expire.mockResolvedValue(1);
      await service.startSession(userId, withdrawalId);

      // Verify session exists
      mockRedisClient.smembers.mockResolvedValue([withdrawalId]);
      let hasActive = await service.hasActiveSession(userId);
      expect(hasActive).toBe(true);

      // Clear all sessions
      redisService.del.mockResolvedValue(1);
      await service.clearAllSessions(userId);

      // Verify sessions are cleared
      mockRedisClient.smembers.mockResolvedValue([]);
      hasActive = await service.hasActiveSession(userId);
      expect(hasActive).toBe(false);
    });

    it('should handle multiple users independently', async () => {
      const user1 = 'user-001';
      const user2 = 'user-002';
      const withdrawal1 = 'withdrawal-111';
      const withdrawal2 = 'withdrawal-222';

      // Start session for user 1
      mockRedisClient.sadd.mockResolvedValue(1);
      redisService.expire.mockResolvedValue(1);
      await service.startSession(user1, withdrawal1);

      // Start session for user 2
      await service.startSession(user2, withdrawal2);

      // Check user 1 has active session
      mockRedisClient.smembers.mockResolvedValue([withdrawal1]);
      let hasActive = await service.hasActiveSession(user1);
      expect(hasActive).toBe(true);

      // Check user 2 has active session
      mockRedisClient.smembers.mockResolvedValue([withdrawal2]);
      hasActive = await service.hasActiveSession(user2);
      expect(hasActive).toBe(true);

      // Verify they have different keys
      expect(mockRedisClient.sadd).toHaveBeenCalledWith(`withdrawal-session:active:${user1}`, withdrawal1);
      expect(mockRedisClient.sadd).toHaveBeenCalledWith(`withdrawal-session:active:${user2}`, withdrawal2);
    });
  });

  describe('edge cases', () => {
    it('should handle session TTL correctly set to 300 seconds', async () => {
      const userId = 'user-123';
      const withdrawalId = 'withdrawal-456';

      mockRedisClient.sadd.mockResolvedValue(1);
      redisService.expire.mockResolvedValue(1);

      await service.startSession(userId, withdrawalId);

      expect(redisService.expire).toHaveBeenCalledWith(`withdrawal-session:active:${userId}`, 300);
    });

    it('should handle ending the same session multiple times', async () => {
      const userId = 'user-123';
      const withdrawalId = 'withdrawal-456';

      mockRedisClient.srem.mockResolvedValue(0);
      mockRedisClient.smembers.mockResolvedValue([]);
      redisService.del.mockResolvedValue(0);

      await service.endSession(userId, withdrawalId);
      await service.endSession(userId, withdrawalId);

      expect(mockRedisClient.srem).toHaveBeenCalledTimes(2);
    });

    it('should handle starting a session with empty withdrawal ID', async () => {
      const userId = 'user-123';
      const withdrawalId = '';

      mockRedisClient.sadd.mockResolvedValue(1);
      redisService.expire.mockResolvedValue(1);

      await service.startSession(userId, withdrawalId);

      expect(mockRedisClient.sadd).toHaveBeenCalledWith(`withdrawal-session:active:${userId}`, '');
    });

    it('should return correct key format for different user IDs', async () => {
      const userId1 = 'user-abc-123';
      const userId2 = 'user-xyz-789';
      const withdrawalId = 'withdrawal-456';

      mockRedisClient.sadd.mockResolvedValue(1);
      redisService.expire.mockResolvedValue(1);

      await service.startSession(userId1, withdrawalId);
      await service.startSession(userId2, withdrawalId);

      expect(mockRedisClient.sadd).toHaveBeenCalledWith(`withdrawal-session:active:${userId1}`, withdrawalId);
      expect(mockRedisClient.sadd).toHaveBeenCalledWith(`withdrawal-session:active:${userId2}`, withdrawalId);
    });
  });
});
