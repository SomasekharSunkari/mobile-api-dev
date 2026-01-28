import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { RedisService } from '../../../services/redis/redis.service';
import { UserRepository } from '../user/user.repository';
import { ChangePinDto } from './dtos/changePin.dto';
import { SetPinDto } from './dtos/setPin.dto';
import { TransactionPinRepository } from './transactionPin.repository';
import { TransactionPinService } from './transactionPin.service';

jest.mock('bcrypt');

describe('TransactionPinService', () => {
  let service: TransactionPinService;
  let transactionPinRepository: jest.Mocked<TransactionPinRepository>;
  let redisService: jest.Mocked<RedisService>;

  const mockRedisClient = {
    incr: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const mockTransactionPinRepository = {
      findByUserId: jest.fn(),
      createPin: jest.fn(),
      updatePin: jest.fn(),
    };

    const mockUserRepository = {
      findById: jest.fn(),
    };

    const mockRedisService = {
      getClient: jest.fn().mockReturnValue(mockRedisClient),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      expire: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionPinService,
        {
          provide: TransactionPinRepository,
          useValue: mockTransactionPinRepository,
        },
        {
          provide: UserRepository,
          useValue: mockUserRepository,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<TransactionPinService>(TransactionPinService);
    transactionPinRepository = module.get(TransactionPinRepository);
    redisService = module.get(RedisService);

    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should inject dependencies via constructor when provided', () => {
      const customRepo = {} as TransactionPinRepository;
      const customUserRepo = {} as UserRepository;
      const customRedisService = {} as RedisService;

      const customService = new TransactionPinService(customRepo, customUserRepo, customRedisService);

      expect(customService).toBeDefined();
    });

    it('should work with undefined dependencies', () => {
      const customService = new TransactionPinService(undefined, undefined, undefined);

      expect(customService).toBeDefined();
    });
  });

  describe('setPin', () => {
    it('should successfully set a new transaction PIN', async () => {
      const userId = 'user-123';
      const dto: SetPinDto = { pin: '123456', confirm_pin: '123456' };
      const hashedPin = 'hashed-1234';

      transactionPinRepository.findByUserId.mockResolvedValue(null);
      (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPin);
      transactionPinRepository.createPin.mockResolvedValue(undefined);

      const result = await service.setPin(userId, dto);

      expect(transactionPinRepository.findByUserId).toHaveBeenCalledWith(userId);
      expect(bcrypt.genSalt).toHaveBeenCalledWith(12);
      expect(bcrypt.hash).toHaveBeenCalledWith('123456', 'salt');
      expect(transactionPinRepository.createPin).toHaveBeenCalledWith(userId, hashedPin);
      expect(result).toBe(true);
    });

    it('should throw ConflictException if PIN already exists with value', async () => {
      const userId = 'user-123';
      const dto: SetPinDto = { pin: '123456', confirm_pin: '123456' };

      transactionPinRepository.findByUserId.mockResolvedValue({
        id: 'pin-id',
        user_id: userId,
        pin: 'existing-hashed-pin',
      } as any);

      await expect(service.setPin(userId, dto)).rejects.toThrow(ConflictException);
      await expect(service.setPin(userId, dto)).rejects.toThrow('Transaction PIN already set');
    });

    it('should throw BadRequestException if existing record found without pin', async () => {
      const userId = 'user-123';
      const dto: SetPinDto = { pin: '123456', confirm_pin: '123456' };

      transactionPinRepository.findByUserId.mockResolvedValue({
        id: 'pin-id',
        user_id: userId,
        pin: null,
      } as any);

      (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-1234');

      await expect(service.setPin(userId, dto)).rejects.toThrow(BadRequestException);
      await expect(service.setPin(userId, dto)).rejects.toThrow('Transaction PIN already set');
    });
  });

  describe('verifyTransactionPin', () => {
    it('should return true for valid PIN', async () => {
      const userId = 'user-123';
      const inputPin = '1234';
      const hashedPin = 'hashed-1234';

      transactionPinRepository.findByUserId.mockResolvedValue({
        id: 'pin-id',
        user_id: userId,
        pin: hashedPin,
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.verifyTransactionPin(userId, inputPin);

      expect(transactionPinRepository.findByUserId).toHaveBeenCalledWith(userId);
      expect(bcrypt.compare).toHaveBeenCalledWith(inputPin, hashedPin);
      expect(result).toBe(true);
    });

    it('should throw BadRequestException if PIN not set', async () => {
      const userId = 'user-123';
      const inputPin = '1234';

      transactionPinRepository.findByUserId.mockResolvedValue(null);

      await expect(service.verifyTransactionPin(userId, inputPin)).rejects.toThrow(BadRequestException);
      await expect(service.verifyTransactionPin(userId, inputPin)).rejects.toThrow(
        'Transaction PIN not set for this user',
      );
    });

    it('should throw BadRequestException for invalid PIN', async () => {
      const userId = 'user-123';
      const inputPin = '1234';
      const hashedPin = 'hashed-1234';

      transactionPinRepository.findByUserId.mockResolvedValue({
        id: 'pin-id',
        user_id: userId,
        pin: hashedPin,
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.verifyTransactionPin(userId, inputPin)).rejects.toThrow(BadRequestException);
      await expect(service.verifyTransactionPin(userId, inputPin)).rejects.toThrow('Invalid transaction PIN');
    });
  });

  describe('changePin', () => {
    it('should successfully change PIN', async () => {
      const userId = 'user-123';
      const dto: ChangePinDto = {
        old_pin: '123456',
        pin: '567890',
        confirm_pin: '567890',
      };
      const oldHashedPin = 'hashed-1234';
      const newHashedPin = 'hashed-5678';

      transactionPinRepository.findByUserId.mockResolvedValue({
        id: 'pin-id',
        user_id: userId,
        pin: oldHashedPin,
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
      (bcrypt.hash as jest.Mock).mockResolvedValue(newHashedPin);
      transactionPinRepository.updatePin.mockResolvedValue(undefined);

      const result = await service.changePin(userId, dto);

      expect(transactionPinRepository.findByUserId).toHaveBeenCalledWith(userId);
      expect(bcrypt.compare).toHaveBeenCalledWith(dto.old_pin, oldHashedPin);
      expect(bcrypt.genSalt).toHaveBeenCalledWith(12);
      expect(bcrypt.hash).toHaveBeenCalledWith(dto.pin, 'salt');
      expect(transactionPinRepository.updatePin).toHaveBeenCalledWith(userId, newHashedPin);
      expect(result).toBe(true);
    });

    it('should throw BadRequestException if PIN not set', async () => {
      const userId = 'user-123';
      const dto: ChangePinDto = {
        old_pin: '123456',
        pin: '567890',
        confirm_pin: '567890',
      };

      transactionPinRepository.findByUserId.mockResolvedValue(null);

      await expect(service.changePin(userId, dto)).rejects.toThrow(BadRequestException);
      await expect(service.changePin(userId, dto)).rejects.toThrow('Transaction PIN not set for this user');
    });

    it('should throw BadRequestException if userSecurity exists but pin is null', async () => {
      const userId = 'user-123';
      const dto: ChangePinDto = {
        old_pin: '123456',
        pin: '567890',
        confirm_pin: '567890',
      };

      transactionPinRepository.findByUserId.mockResolvedValue({
        id: 'pin-id',
        user_id: userId,
        pin: null,
      } as any);

      await expect(service.changePin(userId, dto)).rejects.toThrow(BadRequestException);
      await expect(service.changePin(userId, dto)).rejects.toThrow('Transaction PIN not set for this user');
    });

    it('should throw BadRequestException if old PIN is incorrect', async () => {
      const userId = 'user-123';
      const dto: ChangePinDto = {
        old_pin: '123456',
        pin: '567890',
        confirm_pin: '567890',
      };

      transactionPinRepository.findByUserId.mockResolvedValue({
        id: 'pin-id',
        user_id: userId,
        pin: 'hashed-1234',
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.changePin(userId, dto)).rejects.toThrow(BadRequestException);
      await expect(service.changePin(userId, dto)).rejects.toThrow('Old PIN is incorrect');
    });

    it('should throw BadRequestException if new PIN is same as old PIN', async () => {
      const userId = 'user-123';
      const dto: ChangePinDto = {
        old_pin: '123456',
        pin: '123456',
        confirm_pin: '123456',
      };

      transactionPinRepository.findByUserId.mockResolvedValue({
        id: 'pin-id',
        user_id: userId,
        pin: 'hashed-1234',
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.changePin(userId, dto)).rejects.toThrow(BadRequestException);
      await expect(service.changePin(userId, dto)).rejects.toThrow('New PIN must be different from old PIN');
    });
  });

  describe('verifyTransactionPinWithoutThrowing', () => {
    it('should return true for valid PIN', async () => {
      const userId = 'user-123';
      const inputPin = '1234';
      const hashedPin = 'hashed-1234';

      transactionPinRepository.findByUserId.mockResolvedValue({
        id: 'pin-id',
        user_id: userId,
        pin: hashedPin,
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.verifyTransactionPinWithoutThrowing(userId, inputPin);

      expect(result).toBe(true);
    });

    it('should return false if PIN not set', async () => {
      const userId = 'user-123';
      const inputPin = '1234';

      transactionPinRepository.findByUserId.mockResolvedValue(null);

      const result = await service.verifyTransactionPinWithoutThrowing(userId, inputPin);

      expect(result).toBe(false);
    });

    it('should return false for invalid PIN', async () => {
      const userId = 'user-123';
      const inputPin = '1234';
      const hashedPin = 'hashed-1234';

      transactionPinRepository.findByUserId.mockResolvedValue({
        id: 'pin-id',
        user_id: userId,
        pin: hashedPin,
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.verifyTransactionPinWithoutThrowing(userId, inputPin);

      expect(result).toBe(false);
    });
  });

  describe('incrementFailedAttempts', () => {
    it('should increment failed attempts and set expiry on first attempt', async () => {
      const userId = 'user-123';
      const key = `transaction_pin_failed_attempts:${userId}`;

      mockRedisClient.incr.mockResolvedValue(1);
      redisService.expire.mockResolvedValue(undefined);

      const result = await service.incrementFailedAttempts(userId);

      expect(mockRedisClient.incr).toHaveBeenCalledWith(key);
      expect(redisService.expire).toHaveBeenCalledWith(key, 86400);
      expect(result).toBe(1);
    });

    it('should increment failed attempts without setting expiry on subsequent attempts', async () => {
      const userId = 'user-123';
      const key = `transaction_pin_failed_attempts:${userId}`;

      mockRedisClient.incr.mockResolvedValue(2);

      const result = await service.incrementFailedAttempts(userId);

      expect(mockRedisClient.incr).toHaveBeenCalledWith(key);
      expect(redisService.expire).not.toHaveBeenCalled();
      expect(result).toBe(2);
    });
  });

  describe('resetFailedAttempts', () => {
    it('should delete failed attempts key', async () => {
      const userId = 'user-123';
      const key = `transaction_pin_failed_attempts:${userId}`;

      mockRedisClient.del.mockResolvedValue(undefined);

      await service.resetFailedAttempts(userId);

      expect(mockRedisClient.del).toHaveBeenCalledWith(key);
    });
  });

  describe('getFailedAttempts', () => {
    it('should return failed attempts count', async () => {
      const userId = 'user-123';
      const key = `transaction_pin_failed_attempts:${userId}`;

      mockRedisClient.get.mockResolvedValue('5');

      const result = await service.getFailedAttempts(userId);

      expect(mockRedisClient.get).toHaveBeenCalledWith(key);
      expect(result).toBe(5);
    });

    it('should return 0 if no failed attempts recorded', async () => {
      const userId = 'user-123';
      const key = `transaction_pin_failed_attempts:${userId}`;

      mockRedisClient.get.mockResolvedValue(null);

      const result = await service.getFailedAttempts(userId);

      expect(mockRedisClient.get).toHaveBeenCalledWith(key);
      expect(result).toBe(0);
    });

    it('should return 0 if Redis returns undefined', async () => {
      const userId = 'user-123';
      const key = `transaction_pin_failed_attempts:${userId}`;

      mockRedisClient.get.mockResolvedValue(undefined);

      const result = await service.getFailedAttempts(userId);

      expect(mockRedisClient.get).toHaveBeenCalledWith(key);
      expect(result).toBe(0);
    });

    it('should handle string number conversion correctly', async () => {
      const userId = 'user-123';
      const key = `transaction_pin_failed_attempts:${userId}`;

      mockRedisClient.get.mockResolvedValue('15');

      const result = await service.getFailedAttempts(userId);

      expect(mockRedisClient.get).toHaveBeenCalledWith(key);
      expect(result).toBe(15);
    });
  });

  describe('checkPinRateLimitAndLockout', () => {
    it('should pass if no lockout exists', async () => {
      const userId = 'user-123';
      const lockoutKey = `transaction-pin-lockout:${userId}`;

      redisService.get.mockResolvedValue(null);

      await expect(service.checkPinRateLimitAndLockout(userId)).resolves.not.toThrow();

      expect(redisService.get).toHaveBeenCalledWith(lockoutKey);
    });

    it('should throw BadRequestException if user is locked out', async () => {
      const userId = 'user-123';
      const futureTimestamp = Date.now() + 600000; // 10 minutes in future

      redisService.get.mockResolvedValue(futureTimestamp.toString());

      await expect(service.checkPinRateLimitAndLockout(userId)).rejects.toThrow(BadRequestException);
      await expect(service.checkPinRateLimitAndLockout(userId)).rejects.toThrow(
        /Too many failed attempts.*try again in \d+ minute/,
      );
      expect(redisService.get).toHaveBeenCalledWith(`transaction-pin-lockout:${userId}`);
    });

    it('should delete expired lockout key', async () => {
      const userId = 'user-123';
      const lockoutKey = `transaction-pin-lockout:${userId}`;
      const pastTimestamp = Date.now() - 1000; // 1 second in past

      redisService.get.mockResolvedValue(pastTimestamp.toString());
      redisService.del.mockResolvedValue(undefined);

      await service.checkPinRateLimitAndLockout(userId);

      expect(redisService.del).toHaveBeenCalledWith(lockoutKey);
    });

    it('should handle boundary case when lockout just expired (0 seconds remaining)', async () => {
      const userId = 'user-123';
      const lockoutKey = `transaction-pin-lockout:${userId}`;
      const currentTimestamp = Date.now();

      redisService.get.mockResolvedValue(currentTimestamp.toString());
      redisService.del.mockResolvedValue(undefined);

      await service.checkPinRateLimitAndLockout(userId);

      expect(redisService.del).toHaveBeenCalledWith(lockoutKey);
    });

    it('should calculate remaining minutes correctly for short lockouts', async () => {
      const userId = 'user-123';
      const futureTimestamp = Date.now() + 90000; // 90 seconds = 1.5 minutes

      redisService.get.mockResolvedValue(futureTimestamp.toString());

      await expect(service.checkPinRateLimitAndLockout(userId)).rejects.toThrow(/try again in 2 minute/);
    });

    it('should calculate remaining minutes correctly for long lockouts', async () => {
      const userId = 'user-123';
      const futureTimestamp = Date.now() + 3540000; // 59 minutes

      redisService.get.mockResolvedValue(futureTimestamp.toString());

      await expect(service.checkPinRateLimitAndLockout(userId)).rejects.toThrow(/try again in 59 minute/);
    });
  });

  describe('applyProgressiveLockout', () => {
    it('should apply 15-minute lockout for 3 failed attempts', async () => {
      const userId = 'user-123';
      const failedAttempts = 3;
      const lockoutKey = `transaction-pin-lockout:${userId}`;

      redisService.set.mockResolvedValue(undefined);

      await service.applyProgressiveLockout(userId, failedAttempts);

      expect(redisService.set).toHaveBeenCalledWith(lockoutKey, expect.any(String), 900);
    });

    it('should apply 15-minute lockout for 4 failed attempts', async () => {
      const userId = 'user-123';
      const failedAttempts = 4;
      const lockoutKey = `transaction-pin-lockout:${userId}`;

      redisService.set.mockResolvedValue(undefined);

      await service.applyProgressiveLockout(userId, failedAttempts);

      expect(redisService.set).toHaveBeenCalledWith(lockoutKey, expect.any(String), 900);
    });

    it('should apply 30-minute lockout for 5 failed attempts', async () => {
      const userId = 'user-123';
      const failedAttempts = 5;
      const lockoutKey = `transaction-pin-lockout:${userId}`;

      redisService.set.mockResolvedValue(undefined);

      await service.applyProgressiveLockout(userId, failedAttempts);

      expect(redisService.set).toHaveBeenCalledWith(lockoutKey, expect.any(String), 1800);
    });

    it('should apply 30-minute lockout for 6 failed attempts', async () => {
      const userId = 'user-123';
      const failedAttempts = 6;
      const lockoutKey = `transaction-pin-lockout:${userId}`;

      redisService.set.mockResolvedValue(undefined);

      await service.applyProgressiveLockout(userId, failedAttempts);

      expect(redisService.set).toHaveBeenCalledWith(lockoutKey, expect.any(String), 1800);
    });

    it('should apply 1-hour lockout for 7 failed attempts', async () => {
      const userId = 'user-123';
      const failedAttempts = 7;
      const lockoutKey = `transaction-pin-lockout:${userId}`;

      redisService.set.mockResolvedValue(undefined);

      await service.applyProgressiveLockout(userId, failedAttempts);

      expect(redisService.set).toHaveBeenCalledWith(lockoutKey, expect.any(String), 3600);
    });

    it('should apply 1-hour lockout for 10 failed attempts', async () => {
      const userId = 'user-123';
      const failedAttempts = 10;
      const lockoutKey = `transaction-pin-lockout:${userId}`;

      redisService.set.mockResolvedValue(undefined);

      await service.applyProgressiveLockout(userId, failedAttempts);

      expect(redisService.set).toHaveBeenCalledWith(lockoutKey, expect.any(String), 3600);
    });

    it('should not apply lockout for less than 3 failed attempts', async () => {
      const userId = 'user-123';
      const failedAttempts = 2;

      await service.applyProgressiveLockout(userId, failedAttempts);

      expect(redisService.set).not.toHaveBeenCalled();
    });

    it('should not apply lockout for 0 failed attempts', async () => {
      const userId = 'user-123';
      const failedAttempts = 0;

      await service.applyProgressiveLockout(userId, failedAttempts);

      expect(redisService.set).not.toHaveBeenCalled();
    });

    it('should store future timestamp for 15-minute lockout', async () => {
      const userId = 'user-123';
      const failedAttempts = 3;
      const lockoutKey = `transaction-pin-lockout:${userId}`;
      const now = Date.now();

      redisService.set.mockResolvedValue(undefined);

      await service.applyProgressiveLockout(userId, failedAttempts);

      expect(redisService.set).toHaveBeenCalled();
      const callArgs = redisService.set.mock.calls[0];
      expect(callArgs[0]).toBe(lockoutKey);
      expect(callArgs[2]).toBe(900); // 15 minutes in seconds

      const storedTimestamp = Number.parseInt(callArgs[1] as string);
      expect(storedTimestamp).toBeGreaterThan(now);
      expect(storedTimestamp).toBeLessThanOrEqual(now + 900000 + 100); // Allow 100ms tolerance
    });

    it('should store future timestamp for 30-minute lockout', async () => {
      const userId = 'user-123';
      const failedAttempts = 5;
      const lockoutKey = `transaction-pin-lockout:${userId}`;
      const now = Date.now();

      redisService.set.mockResolvedValue(undefined);

      await service.applyProgressiveLockout(userId, failedAttempts);

      expect(redisService.set).toHaveBeenCalled();
      const callArgs = redisService.set.mock.calls[0];
      expect(callArgs[0]).toBe(lockoutKey);
      expect(callArgs[2]).toBe(1800); // 30 minutes in seconds

      const storedTimestamp = Number.parseInt(callArgs[1] as string);
      expect(storedTimestamp).toBeGreaterThan(now);
      expect(storedTimestamp).toBeLessThanOrEqual(now + 1800000 + 100); // Allow 100ms tolerance
    });

    it('should store future timestamp for 1-hour lockout', async () => {
      const userId = 'user-123';
      const failedAttempts = 7;
      const lockoutKey = `transaction-pin-lockout:${userId}`;
      const now = Date.now();

      redisService.set.mockResolvedValue(undefined);

      await service.applyProgressiveLockout(userId, failedAttempts);

      expect(redisService.set).toHaveBeenCalled();
      const callArgs = redisService.set.mock.calls[0];
      expect(callArgs[0]).toBe(lockoutKey);
      expect(callArgs[2]).toBe(3600); // 1 hour in seconds

      const storedTimestamp = Number.parseInt(callArgs[1] as string);
      expect(storedTimestamp).toBeGreaterThan(now);
      expect(storedTimestamp).toBeLessThanOrEqual(now + 3600000 + 100); // Allow 100ms tolerance
    });

    it('should apply 1-hour lockout for very high number of failed attempts', async () => {
      const userId = 'user-123';
      const failedAttempts = 100;
      const lockoutKey = `transaction-pin-lockout:${userId}`;

      redisService.set.mockResolvedValue(undefined);

      await service.applyProgressiveLockout(userId, failedAttempts);

      expect(redisService.set).toHaveBeenCalledWith(lockoutKey, expect.any(String), 3600);
    });
  });

  describe('clearLockout', () => {
    it('should delete lockout key', async () => {
      const userId = 'user-123';

      redisService.del.mockResolvedValue(undefined);

      await service.clearLockout(userId);

      expect(redisService.del).toHaveBeenCalledWith(`transaction-pin-lockout:${userId}`);
    });

    it('should handle clearing lockout when no lockout exists', async () => {
      const userId = 'user-123';
      const lockoutKey = `transaction-pin-lockout:${userId}`;

      redisService.del.mockResolvedValue(undefined);

      await expect(service.clearLockout(userId)).resolves.not.toThrow();

      expect(redisService.del).toHaveBeenCalledWith(lockoutKey);
    });

    it('should use correct lockout key format', async () => {
      const userId = 'test-user-456';
      const expectedKey = `transaction-pin-lockout:${userId}`;

      redisService.del.mockResolvedValue(undefined);

      await service.clearLockout(userId);

      expect(redisService.del).toHaveBeenCalledWith(expectedKey);
    });
  });

  describe('validateTransactionPin', () => {
    it('should return isValid true for valid PIN', async () => {
      const userId = 'user-123';
      const inputPin = '123456';
      const hashedPin = 'hashed-123456';

      transactionPinRepository.findByUserId.mockResolvedValue({
        id: 'pin-id',
        user_id: userId,
        pin: hashedPin,
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateTransactionPin(userId, inputPin);

      expect(transactionPinRepository.findByUserId).toHaveBeenCalledWith(userId);
      expect(bcrypt.compare).toHaveBeenCalledWith(inputPin, hashedPin);
      expect(result).toEqual({ isValid: true });
    });

    it('should return isValid false if user security not found', async () => {
      const userId = 'user-123';
      const inputPin = '123456';

      transactionPinRepository.findByUserId.mockResolvedValue(null);

      const result = await service.validateTransactionPin(userId, inputPin);

      expect(transactionPinRepository.findByUserId).toHaveBeenCalledWith(userId);
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(result).toEqual({ isValid: false });
    });

    it('should return isValid false for invalid PIN', async () => {
      const userId = 'user-123';
      const inputPin = '123456';
      const hashedPin = 'hashed-123456';

      transactionPinRepository.findByUserId.mockResolvedValue({
        id: 'pin-id',
        user_id: userId,
        pin: hashedPin,
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateTransactionPin(userId, inputPin);

      expect(transactionPinRepository.findByUserId).toHaveBeenCalledWith(userId);
      expect(bcrypt.compare).toHaveBeenCalledWith(inputPin, hashedPin);
      expect(result).toEqual({ isValid: false });
    });

    it('should throw BadRequestException on repository error', async () => {
      const userId = 'user-123';
      const inputPin = '123456';

      transactionPinRepository.findByUserId.mockRejectedValue(new Error('Database error'));

      await expect(service.validateTransactionPin(userId, inputPin)).rejects.toThrow(BadRequestException);
      await expect(service.validateTransactionPin(userId, inputPin)).rejects.toThrow(
        'Failed to validate transaction PIN',
      );
    });

    it('should throw BadRequestException on bcrypt comparison error', async () => {
      const userId = 'user-123';
      const inputPin = '123456';
      const hashedPin = 'hashed-123456';

      transactionPinRepository.findByUserId.mockResolvedValue({
        id: 'pin-id',
        user_id: userId,
        pin: hashedPin,
      } as any);
      (bcrypt.compare as jest.Mock).mockRejectedValue(new Error('Bcrypt error'));

      await expect(service.validateTransactionPin(userId, inputPin)).rejects.toThrow(BadRequestException);
      await expect(service.validateTransactionPin(userId, inputPin)).rejects.toThrow(
        'Failed to validate transaction PIN',
      );
    });
  });

  describe('Integration Tests - Lockout Flow', () => {
    it('should increment attempts and apply lockout after 3 failed attempts', async () => {
      const userId = 'user-123';
      const lockoutKey = `transaction-pin-lockout:${userId}`;

      mockRedisClient.incr.mockResolvedValue(3);
      redisService.set.mockResolvedValue(undefined);

      const attempts = await service.incrementFailedAttempts(userId);
      await service.applyProgressiveLockout(userId, attempts);

      expect(attempts).toBe(3);
      expect(redisService.set).toHaveBeenCalledWith(lockoutKey, expect.any(String), 900);
    });

    it('should reset attempts and clear lockout on successful verification', async () => {
      const userId = 'user-123';
      const attemptKey = `transaction_pin_failed_attempts:${userId}`;
      const lockoutKey = `transaction-pin-lockout:${userId}`;

      mockRedisClient.del.mockResolvedValue(undefined);
      redisService.del.mockResolvedValue(undefined);

      await service.resetFailedAttempts(userId);
      await service.clearLockout(userId);

      expect(mockRedisClient.del).toHaveBeenCalledWith(attemptKey);
      expect(redisService.del).toHaveBeenCalledWith(lockoutKey);
    });

    it('should properly track progressive lockouts across multiple attempts', async () => {
      const userId = 'user-123';

      // First 2 attempts - no lockout
      mockRedisClient.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(2);

      await service.incrementFailedAttempts(userId);
      await service.applyProgressiveLockout(userId, 1);
      expect(redisService.set).not.toHaveBeenCalled();

      await service.incrementFailedAttempts(userId);
      await service.applyProgressiveLockout(userId, 2);
      expect(redisService.set).not.toHaveBeenCalled();

      // 3rd attempt - 15 minute lockout
      mockRedisClient.incr.mockResolvedValueOnce(3);
      await service.incrementFailedAttempts(userId);
      await service.applyProgressiveLockout(userId, 3);
      expect(redisService.set).toHaveBeenCalledWith(`transaction-pin-lockout:${userId}`, expect.any(String), 900);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long user IDs in Redis keys', async () => {
      const userId = 'a'.repeat(100);
      const expectedKey = `transaction_pin_failed_attempts:${userId}`;

      mockRedisClient.incr.mockResolvedValue(1);
      redisService.expire.mockResolvedValue(undefined);

      await service.incrementFailedAttempts(userId);

      expect(mockRedisClient.incr).toHaveBeenCalledWith(expectedKey);
    });

    it('should handle special characters in user IDs', async () => {
      const userId = 'user-123@test.com';
      const expectedKey = `transaction_pin_failed_attempts:${userId}`;

      mockRedisClient.incr.mockResolvedValue(1);
      redisService.expire.mockResolvedValue(undefined);

      await service.incrementFailedAttempts(userId);

      expect(mockRedisClient.incr).toHaveBeenCalledWith(expectedKey);
    });

    it('should maintain consistency between failed attempts key and lockout key naming', async () => {
      const userId = 'user-456';
      const attemptKey = `transaction_pin_failed_attempts:${userId}`;
      const lockoutKey = `transaction-pin-lockout:${userId}`;

      mockRedisClient.incr.mockResolvedValue(1);
      mockRedisClient.del.mockResolvedValue(undefined);
      redisService.get.mockResolvedValue(null);
      redisService.del.mockResolvedValue(undefined);

      await service.incrementFailedAttempts(userId);
      await service.checkPinRateLimitAndLockout(userId);
      await service.resetFailedAttempts(userId);
      await service.clearLockout(userId);

      expect(mockRedisClient.incr).toHaveBeenCalledWith(attemptKey);
      expect(redisService.get).toHaveBeenCalledWith(lockoutKey);
      expect(mockRedisClient.del).toHaveBeenCalledWith(attemptKey);
      expect(redisService.del).toHaveBeenCalledWith(lockoutKey);
    });

    it('should handle Redis incr returning negative values gracefully', async () => {
      const userId = 'user-123';

      mockRedisClient.incr.mockResolvedValue(-1);

      const result = await service.incrementFailedAttempts(userId);

      expect(result).toBe(-1);
    });

    it('should handle very large attempt counts', async () => {
      const userId = 'user-123';

      mockRedisClient.incr.mockResolvedValue(999999);

      const result = await service.incrementFailedAttempts(userId);

      expect(result).toBe(999999);
    });
  });
});
