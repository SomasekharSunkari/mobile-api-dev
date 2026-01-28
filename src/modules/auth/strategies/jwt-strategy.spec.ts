import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  RestrictionCategory,
  RestrictionErrorType,
  RestrictionException,
} from '../../../exceptions/restriction_exception';
import { AccessTokenService } from '../accessToken/accessToken.service';
import { UserRepository } from '../user/user.repository';
import { JwtStrategyService } from './jwt-strategy.service';
import { TokenPayload } from './tokenPayload.interface';

describe('JwtStrategyService', () => {
  let service: JwtStrategyService;

  const mockUserRepository = {
    query: jest.fn(),
  };

  const mockAccessTokenService = {
    findByIdentity: jest.fn(),
  };

  const mockQueryBuilder = {
    where: jest.fn().mockImplementation(function (arg: any) {
      // If the argument is a function (callback), execute it with the builder
      if (typeof arg === 'function') {
        arg(mockQueryBuilder);
      }
      return mockQueryBuilder;
    }),
    whereILike: jest.fn().mockReturnThis(),
    orWhereILike: jest.fn().mockReturnThis(),
    withGraphFetched: jest.fn().mockReturnThis(),
    first: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Reset the where mock implementation for each test
    mockQueryBuilder.where.mockImplementation(function (arg: any) {
      if (typeof arg === 'function') {
        arg(mockQueryBuilder);
      }
      return mockQueryBuilder;
    });

    mockUserRepository.query.mockReturnValue(mockQueryBuilder);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategyService,
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: AccessTokenService, useValue: mockAccessTokenService },
      ],
    }).compile();

    service = module.get<JwtStrategyService>(JwtStrategyService);
  });

  describe('validate', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      phone_number: '+1234567890',
      username: 'testuser',
      status: 'active',
      password: 'hashed-password',
      userRoles: [{ slug: 'active_user' }],
    };

    const mockAccessToken = {
      id: 'token-123',
      user_id: 'user-123',
      identity: 'test-identity',
    };

    it('should throw ForbiddenException when id is not provided', async () => {
      const payload: TokenPayload = {
        email: 'test@example.com',
        phone_number: '+1234567890',
        username: 'testuser',
        id: undefined as any,
        identity: 'test-identity',
      };

      await expect(service.validate(payload)).rejects.toThrow(ForbiddenException);
      await expect(service.validate(payload)).rejects.toThrow('Unauthorized');
    });

    it('should throw RestrictionException when identity is provided but access token not found', async () => {
      const payload: TokenPayload = {
        email: 'test@example.com',
        phone_number: '+1234567890',
        username: 'testuser',
        id: 'user-123',
        identity: 'invalid-identity',
      };

      mockAccessTokenService.findByIdentity.mockResolvedValue(null);

      try {
        await service.validate(payload);
        fail('Expected RestrictionException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RestrictionException);
        expect(error.type).toBe(RestrictionErrorType.ERR_USER_SESSION_EXPIRED);
        expect(error.restrictionCategory).toBe(RestrictionCategory.USER);
      }
      expect(mockAccessTokenService.findByIdentity).toHaveBeenCalledWith('user-123', 'invalid-identity');
    });

    it('should proceed without token check when identity is not provided', async () => {
      const payload: TokenPayload = {
        email: 'test@example.com',
        phone_number: '+1234567890',
        username: 'testuser',
        id: 'user-123',
        identity: undefined as any,
      };

      mockQueryBuilder.first.mockResolvedValue(mockUser);

      const result = await service.validate(payload);

      expect(mockAccessTokenService.findByIdentity).not.toHaveBeenCalled();
      expect(result.id).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
    });

    it('should validate successfully when identity matches access token', async () => {
      const payload: TokenPayload = {
        email: 'test@example.com',
        phone_number: '+1234567890',
        username: 'testuser',
        id: 'user-123',
        identity: 'test-identity',
      };

      mockAccessTokenService.findByIdentity.mockResolvedValue(mockAccessToken);
      mockQueryBuilder.first.mockResolvedValue(mockUser);

      const result = await service.validate(payload);

      expect(mockAccessTokenService.findByIdentity).toHaveBeenCalledWith('user-123', 'test-identity');
      expect(result.id).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
      expect(result.password).toBeUndefined();
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      const payload: TokenPayload = {
        email: 'nonexistent@example.com',
        phone_number: '+1234567890',
        username: 'testuser',
        id: 'user-123',
        identity: 'test-identity',
      };

      mockAccessTokenService.findByIdentity.mockResolvedValue(mockAccessToken);
      mockQueryBuilder.first.mockResolvedValue(null);

      await expect(service.validate(payload)).rejects.toThrow(UnauthorizedException);
      await expect(service.validate(payload)).rejects.toThrow('Expired login session');
    });

    it('should throw UnauthorizedException when user is not active', async () => {
      const inactiveUser = { ...mockUser, status: 'inactive' };
      const payload: TokenPayload = {
        email: 'test@example.com',
        phone_number: '+1234567890',
        username: 'testuser',
        id: 'user-123',
        identity: 'test-identity',
      };

      mockAccessTokenService.findByIdentity.mockResolvedValue(mockAccessToken);
      mockQueryBuilder.first.mockResolvedValue(inactiveUser);

      await expect(service.validate(payload)).rejects.toThrow(UnauthorizedException);
      await expect(service.validate(payload)).rejects.toThrow('Account not active');
    });

    it('should remove password from returned user object', async () => {
      const payload: TokenPayload = {
        email: 'test@example.com',
        phone_number: '+1234567890',
        username: 'testuser',
        id: 'user-123',
        identity: 'test-identity',
      };

      mockAccessTokenService.findByIdentity.mockResolvedValue(mockAccessToken);
      mockQueryBuilder.first.mockResolvedValue({ ...mockUser });

      const result = await service.validate(payload);

      expect(result.password).toBeUndefined();
    });

    it('should query with email using whereILike when email is provided', async () => {
      const payload: TokenPayload = {
        email: 'test@example.com',
        phone_number: undefined as any,
        username: undefined as any,
        id: 'user-123',
        identity: 'test-identity',
      };

      mockAccessTokenService.findByIdentity.mockResolvedValue(mockAccessToken);
      mockQueryBuilder.first.mockResolvedValue(mockUser);

      await service.validate(payload);

      expect(mockQueryBuilder.whereILike).toHaveBeenCalledWith('email', 'test@example.com');
      expect(mockQueryBuilder.orWhereILike).not.toHaveBeenCalled();
    });

    it('should query with username using orWhereILike when username is provided', async () => {
      const payload: TokenPayload = {
        email: undefined as any,
        phone_number: undefined as any,
        username: 'testuser',
        id: 'user-123',
        identity: 'test-identity',
      };

      mockAccessTokenService.findByIdentity.mockResolvedValue(mockAccessToken);
      mockQueryBuilder.first.mockResolvedValue(mockUser);

      await service.validate(payload);

      expect(mockQueryBuilder.orWhereILike).toHaveBeenCalledWith('username', 'testuser');
    });

    it('should query with phone_number using orWhereILike when phone_number is provided', async () => {
      const payload: TokenPayload = {
        email: undefined as any,
        phone_number: '+1234567890',
        username: undefined as any,
        id: 'user-123',
        identity: 'test-identity',
      };

      mockAccessTokenService.findByIdentity.mockResolvedValue(mockAccessToken);
      mockQueryBuilder.first.mockResolvedValue(mockUser);

      await service.validate(payload);

      expect(mockQueryBuilder.orWhereILike).toHaveBeenCalledWith('phone_number', '+1234567890');
    });

    it('should query with all identifiers when all are provided', async () => {
      const payload: TokenPayload = {
        email: 'test@example.com',
        phone_number: '+1234567890',
        username: 'testuser',
        id: 'user-123',
        identity: 'test-identity',
      };

      mockAccessTokenService.findByIdentity.mockResolvedValue(mockAccessToken);
      mockQueryBuilder.first.mockResolvedValue(mockUser);

      await service.validate(payload);

      expect(mockUserRepository.query).toHaveBeenCalled();
      expect(mockQueryBuilder.whereILike).toHaveBeenCalledWith('email', 'test@example.com');
      expect(mockQueryBuilder.orWhereILike).toHaveBeenCalledWith('username', 'testuser');
      expect(mockQueryBuilder.orWhereILike).toHaveBeenCalledWith('phone_number', '+1234567890');
      expect(mockQueryBuilder.withGraphFetched).toHaveBeenCalledWith('[userRoles]');
    });

    it('should not call whereILike or orWhereILike when no identifiers provided', async () => {
      const payload: TokenPayload = {
        email: undefined as any,
        phone_number: undefined as any,
        username: undefined as any,
        id: 'user-123',
        identity: 'test-identity',
      };

      mockAccessTokenService.findByIdentity.mockResolvedValue(mockAccessToken);
      mockQueryBuilder.first.mockResolvedValue(mockUser);

      await service.validate(payload);

      expect(mockQueryBuilder.whereILike).not.toHaveBeenCalled();
      expect(mockQueryBuilder.orWhereILike).not.toHaveBeenCalled();
    });

    it('should query by id in the second where clause', async () => {
      const payload: TokenPayload = {
        email: 'test@example.com',
        phone_number: '+1234567890',
        username: 'testuser',
        id: 'user-123',
        identity: 'test-identity',
      };

      mockAccessTokenService.findByIdentity.mockResolvedValue(mockAccessToken);
      mockQueryBuilder.first.mockResolvedValue(mockUser);

      await service.validate(payload);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('id', 'user-123');
    });

    it('should return user with userRoles', async () => {
      const payload: TokenPayload = {
        email: 'test@example.com',
        phone_number: '+1234567890',
        username: 'testuser',
        id: 'user-123',
        identity: 'test-identity',
      };

      mockAccessTokenService.findByIdentity.mockResolvedValue(mockAccessToken);
      mockQueryBuilder.first.mockResolvedValue(mockUser);

      const result = await service.validate(payload);

      expect(result.userRoles).toEqual([{ slug: 'active_user' }]);
    });
  });
});
