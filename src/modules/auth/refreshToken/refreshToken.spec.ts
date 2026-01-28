import { BadRequestException, HttpStatus, InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DateTime } from 'luxon';
import { EnvironmentService } from '../../../config';
import { AppLoggerService } from '../../../services/logger/logger.service';
import { UtilsService } from '../../../utils/utils.service';
import { RefreshTokenController } from './refreshToken.controller';
import { RefreshTokenService } from './refreshToken.service';

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'jwt-token'),
  verify: jest.fn((token) => {
    if (token === 'bad-token') throw new Error('Invalid token');
    return { userId: 'user-1', identity: 'test-identity' };
  }),
}));

jest.mock('@paralleldrive/cuid2', () => ({
  createId: jest.fn(() => 'test-identity'),
}));

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;

  const mockRedisService = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    getClient: jest.fn(() => ({
      ttl: jest.fn().mockResolvedValue(86400),
    })),
  };
  const mockAuthService = {
    signJwt: jest.fn(),
  };
  const mockAccessTokenService = {
    create: jest.fn(),
  };
  const mockUserRepository = {
    findById: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(UtilsService, 'hashPassword').mockResolvedValue('hashed-token');
    jest.spyOn(UtilsService, 'comparePassword').mockResolvedValue(true);
    jest.spyOn(UtilsService, 'isDatePassed').mockReturnValue(false);
    jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('jwt-secret');
    (DateTime.now as any) = () => DateTime.fromISO('2025-05-27T00:00:00Z');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: RefreshTokenService,
          useFactory: () => {
            const service = new RefreshTokenService();
            (service as any).redisService = mockRedisService;
            (service as any).authService = mockAuthService;
            (service as any).accessTokenService = mockAccessTokenService;
            (service as any).userRepository = mockUserRepository;
            return service;
          },
        },
      ],
    }).compile();

    service = module.get<RefreshTokenService>(RefreshTokenService);
  });

  describe('create', () => {
    it('should create a new refresh token and return it', async () => {
      mockRedisService.del.mockResolvedValue(1);
      mockRedisService.set.mockResolvedValue('OK');
      const result = await service.create('user-1');
      expect(mockRedisService.del).toHaveBeenCalledWith('refresh_token:user-1');
      expect(mockRedisService.set).toHaveBeenCalledWith('refresh_token:user-1', expect.any(String), expect.any(Number));
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('encodedToken', 'jwt-token');
    });

    it('should throw InternalServerErrorException if an error occurs', async () => {
      mockRedisService.del.mockRejectedValue(new Error('Redis error'));
      await expect(service.create('user-1')).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('refreshAuthToken', () => {
    it('should refresh auth token and return new tokens', async () => {
      const user = { id: 'user-1', email: 'test@example.com', phone_number: '1234567890' };
      const storedToken = {
        user_id: 'user-1',
        identity: 'test-identity',
        is_used: false,
        expiration_time: '2026-01-01T00:00:00Z',
      };
      mockRedisService.get.mockResolvedValue(JSON.stringify(storedToken));
      mockUserRepository.findById.mockResolvedValue(user);
      mockAccessTokenService.create.mockResolvedValue({
        decodedToken: { access_token: 'access-token', expiration: new Date() },
      });
      mockRedisService.set.mockResolvedValue('OK');
      const result = await service.refreshAuthToken('good-token');
      expect(result).toHaveProperty('refreshToken', 'jwt-token');
      expect(result).toHaveProperty('authToken');
    });

    it('should throw BadRequestException if refresh token not found', async () => {
      mockRedisService.get.mockResolvedValue(null);
      await expect(service.refreshAuthToken('good-token')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if token does not match', async () => {
      const storedToken = {
        user_id: 'user-1',
        identity: 'wrong-identity',
        is_used: false,
        expiration_time: '2026-01-01T00:00:00Z',
      };
      mockRedisService.get.mockResolvedValue(JSON.stringify(storedToken));
      await expect(service.refreshAuthToken('good-token')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if token is used', async () => {
      const storedToken = {
        user_id: 'user-1',
        identity: 'test-identity',
        is_used: true,
        expiration_time: '2026-01-01T00:00:00Z',
      };
      mockRedisService.get.mockResolvedValue(JSON.stringify(storedToken));
      await expect(service.refreshAuthToken('good-token')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if token is expired', async () => {
      jest.spyOn(UtilsService, 'isDatePassed').mockReturnValue(true);
      const storedToken = {
        user_id: 'user-1',
        identity: 'test-identity',
        is_used: false,
        expiration_time: '2024-01-01T00:00:00Z',
      };
      mockRedisService.get.mockResolvedValue(JSON.stringify(storedToken));
      await expect(service.refreshAuthToken('good-token')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if user is not found', async () => {
      const storedToken = {
        user_id: 'user-1',
        identity: 'test-identity',
        is_used: false,
        expiration_time: '2026-01-01T00:00:00Z',
      };
      mockRedisService.get.mockResolvedValue(JSON.stringify(storedToken));
      mockUserRepository.findById.mockResolvedValue(null);
      await expect(service.refreshAuthToken('good-token')).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException if an error occurs', async () => {
      const user = { id: 'user-1', email: 'test@example.com', phone_number: '1234567890' };
      const storedToken = {
        user_id: 'user-1',
        identity: 'test-identity',
        is_used: false,
        expiration_time: '2026-01-01T00:00:00Z',
      };
      mockRedisService.get.mockResolvedValue(JSON.stringify(storedToken));
      mockUserRepository.findById.mockResolvedValue(user);
      mockAccessTokenService.create.mockRejectedValue(new Error('Redis error'));
      await expect(service.refreshAuthToken('good-token')).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getRefreshTokenByUserId', () => {
    it('should return refresh token if found', async () => {
      const storedToken = { user_id: 'user-1', identity: 'test-identity', is_used: false };
      mockRedisService.get.mockResolvedValue(JSON.stringify(storedToken));
      const result = await service.getRefreshTokenByUserId('user-1');
      expect(result).toEqual(storedToken);
    });
    it('should throw BadRequestException if not found', async () => {
      mockRedisService.get.mockResolvedValue(null);
      await expect(service.getRefreshTokenByUserId('user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('verify', () => {
    it('should return true for valid refresh token', async () => {
      const storedToken = {
        user_id: 'user-1',
        identity: 'test-identity',
        is_used: false,
        expiration_time: '2026-01-01T00:00:00Z',
      };
      mockRedisService.get.mockResolvedValue(JSON.stringify(storedToken));
      const result = await service.verify('user-1', 'good-token');
      expect(result).toBe(true);
    });

    it('should return false if token not found in Redis', async () => {
      mockRedisService.get.mockResolvedValue(null);
      const result = await service.verify('user-1', 'good-token');
      expect(result).toBe(false);
    });

    it('should return false if identity does not match', async () => {
      const storedToken = {
        user_id: 'user-1',
        identity: 'different-identity',
        is_used: false,
        expiration_time: '2026-01-01T00:00:00Z',
      };
      mockRedisService.get.mockResolvedValue(JSON.stringify(storedToken));
      const result = await service.verify('user-1', 'good-token');
      expect(result).toBe(false);
    });

    it('should return false if token is marked as used', async () => {
      const storedToken = {
        user_id: 'user-1',
        identity: 'test-identity',
        is_used: true,
        expiration_time: '2026-01-01T00:00:00Z',
      };
      mockRedisService.get.mockResolvedValue(JSON.stringify(storedToken));
      const result = await service.verify('user-1', 'good-token');
      expect(result).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete refresh token from Redis', async () => {
      mockRedisService.del.mockResolvedValue(1);
      const result = await service.delete('user-1');
      expect(mockRedisService.del).toHaveBeenCalledWith('refresh_token:user-1');
      expect(result).toBe(1);
    });
  });
});

describe('RefreshTokenController', () => {
  let controller: RefreshTokenController;
  let service: RefreshTokenService;

  const mockRefreshTokenService = {
    refreshAuthToken: jest.fn(),
  };

  const mockAppLoggerService = {
    logInfo: jest.fn(),
    logError: jest.fn(),
    logUserAction: jest.fn(),
    setContext: jest.fn(),
    createChild: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RefreshTokenController],
      providers: [
        { provide: RefreshTokenService, useValue: mockRefreshTokenService },
        { provide: AppLoggerService, useValue: mockAppLoggerService },
      ],
    }).compile();
    controller = module.get<RefreshTokenController>(RefreshTokenController);
    service = module.get<RefreshTokenService>(RefreshTokenService);
  });

  describe('create', () => {
    it('should call refreshAuthToken and return transformed response', async () => {
      const tokens = { refreshToken: 'jwt-token', authToken: { access_token: 'access-token' } };
      mockRefreshTokenService.refreshAuthToken.mockResolvedValue(tokens);
      const dto = { token: 'refresh-token' };
      const result = await controller.create(dto);
      expect(service.refreshAuthToken).toHaveBeenCalledWith('refresh-token');
      expect(result).toMatchObject({
        message: 'User token refreshed successfully',
        data: tokens,
        statusCode: HttpStatus.CREATED,
      });
    });
  });
});
