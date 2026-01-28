import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { UserModel, UserStatus } from '../../../database/models/user';
import { AuthService } from '../auth.service';
import { ROLES } from '../guard';
import { UserRepository } from '../user/user.repository';
import { LocalStrategy } from './local-strategies';

jest.mock('bcryptjs');

const mockJwtTokenResponse = {
  access_token: 'mock-auth-token',
  expiration: new Date(),
};

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;
  let userRepository: jest.Mocked<UserRepository>;
  let authService: jest.Mocked<AuthService>;

  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    modify: jest.fn().mockReturnThis(),
    whereILike: jest.fn().mockReturnThis(),
    first: jest.fn(),
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    first_name: 'Test',
    last_name: 'User',
    password: 'hashedPassword123',
    is_email_verified: true,
    status: UserStatus.ACTIVE,
    userRoles: [{ slug: ROLES.ACTIVE_USER }],
  } as unknown as UserModel;

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockUserRepository = {
      query: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const mockAuthService = {
      signJwt: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalStrategy,
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    strategy = module.get<LocalStrategy>(LocalStrategy);
    userRepository = module.get(UserRepository);
    authService = module.get(AuthService);
  });

  describe('validate', () => {
    it('should throw BadRequestException when password is not provided', async () => {
      await expect(strategy.validate('test@example.com', '')).rejects.toThrow(BadRequestException);
      await expect(strategy.validate('test@example.com', '')).rejects.toThrow('Password is required');
    });

    it('should throw BadRequestException when password is null', async () => {
      await expect(strategy.validate('test@example.com', null as any)).rejects.toThrow(BadRequestException);
      await expect(strategy.validate('test@example.com', null as any)).rejects.toThrow('Password is required');
    });

    it('should convert email to lowercase before querying', async () => {
      mockQueryBuilder.first.mockResolvedValue(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      try {
        await strategy.validate('TEST@EXAMPLE.COM', 'password123');
      } catch {
        // Expected to throw
      }

      expect(mockQueryBuilder.whereILike).toHaveBeenCalledWith('email', 'test@example.com');
    });

    it('should throw ForbiddenException when user is not found', async () => {
      mockQueryBuilder.first.mockResolvedValue(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(strategy.validate('test@example.com', 'password123')).rejects.toThrow(ForbiddenException);
      await expect(strategy.validate('test@example.com', 'password123')).rejects.toThrow('Invalid credentials');
    });

    it('should throw ForbiddenException when password is incorrect', async () => {
      mockQueryBuilder.first.mockResolvedValue({ ...mockUser });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(strategy.validate('test@example.com', 'wrongPassword')).rejects.toThrow(ForbiddenException);
      await expect(strategy.validate('test@example.com', 'wrongPassword')).rejects.toThrow('Invalid credentials');
    });

    it('should use dummy hash for password comparison when user not found (timing attack prevention)', async () => {
      mockQueryBuilder.first.mockResolvedValue(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      try {
        await strategy.validate('test@example.com', 'password123');
      } catch {
        // Expected to throw
      }

      expect(bcrypt.compare).toHaveBeenCalledWith(
        'password123',
        '$2a$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ12',
      );
    });

    it('should throw ForbiddenException with account info when user status is not active', async () => {
      const inactiveUser = { ...mockUser, status: UserStatus.INACTIVE };
      mockQueryBuilder.first.mockResolvedValue(inactiveUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      authService.signJwt.mockResolvedValue(mockJwtTokenResponse);

      try {
        await strategy.validate('test@example.com', 'password123');
        fail('Expected ForbiddenException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response).toEqual({
          message: 'Account not active',
          data: {
            user: inactiveUser,
            authToken: mockJwtTokenResponse,
            accountActive: false,
          },
        });
      }
    });

    it('should throw ForbiddenException with account info when user does not have ACTIVE_USER role', async () => {
      const userWithoutActiveRole = { ...mockUser, userRoles: [{ slug: ROLES.USER }] };
      mockQueryBuilder.first.mockResolvedValue(userWithoutActiveRole);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      authService.signJwt.mockResolvedValue(mockJwtTokenResponse);

      try {
        await strategy.validate('test@example.com', 'password123');
        fail('Expected ForbiddenException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response).toEqual({
          message: 'Account not active',
          data: {
            user: userWithoutActiveRole,
            authToken: mockJwtTokenResponse,
            accountActive: false,
          },
        });
      }
    });

    it('should throw ForbiddenException when user has no roles', async () => {
      const userWithNoRoles = { ...mockUser, userRoles: [] };
      mockQueryBuilder.first.mockResolvedValue(userWithNoRoles);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      authService.signJwt.mockResolvedValue(mockJwtTokenResponse);

      try {
        await strategy.validate('test@example.com', 'password123');
        fail('Expected ForbiddenException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe('Account not active');
      }
    });

    it('should call authService.signJwt with correct params when account is not active', async () => {
      const inactiveUser = { ...mockUser, status: UserStatus.INACTIVE };
      mockQueryBuilder.first.mockResolvedValue(inactiveUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      authService.signJwt.mockResolvedValue(mockJwtTokenResponse);

      try {
        await strategy.validate('test@example.com', 'password123');
      } catch {
        // Expected to throw
      }

      expect(authService.signJwt).toHaveBeenCalledWith({
        id: 'user-123',
        email: 'test@example.com',
      });
    });

    it('should return user without password on successful validation', async () => {
      const userWithPassword = { ...mockUser, password: 'hashedPassword123' };
      mockQueryBuilder.first.mockResolvedValue(userWithPassword);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await strategy.validate('test@example.com', 'password123');

      expect(result.password).toBeUndefined();
      expect(result.id).toBe('user-123');
      expect(result.email).toBe('test@example.com');
    });

    it('should query repository with correct methods', async () => {
      mockQueryBuilder.first.mockResolvedValue({ ...mockUser });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await strategy.validate('test@example.com', 'password123');

      expect(userRepository.query).toHaveBeenCalled();
      expect(mockQueryBuilder.select).toHaveBeenCalledWith(UserModel.publicProperty());
      expect(mockQueryBuilder.modify).toHaveBeenCalledWith('notDeleted');
      expect(mockQueryBuilder.whereILike).toHaveBeenCalledWith('email', 'test@example.com');
      expect(mockQueryBuilder.first).toHaveBeenCalled();
    });

    it('should handle user with blocked status', async () => {
      const blockedUser = { ...mockUser, status: UserStatus.BLOCKED };
      mockQueryBuilder.first.mockResolvedValue(blockedUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      authService.signJwt.mockResolvedValue(mockJwtTokenResponse);

      try {
        await strategy.validate('test@example.com', 'password123');
        fail('Expected ForbiddenException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe('Account not active');
      }
    });

    it('should handle user with pending_deactivation status', async () => {
      const pendingDeactivationUser = { ...mockUser, status: UserStatus.PENDING_DEACTIVATION };
      mockQueryBuilder.first.mockResolvedValue(pendingDeactivationUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      authService.signJwt.mockResolvedValue(mockJwtTokenResponse);

      try {
        await strategy.validate('test@example.com', 'password123');
        fail('Expected ForbiddenException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe('Account not active');
      }
    });
  });

  describe('error', () => {
    it('should log error message to console', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const testError = new Error('Test error message');

      strategy.error(testError);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Test error message');
      consoleErrorSpy.mockRestore();
    });
  });
});
