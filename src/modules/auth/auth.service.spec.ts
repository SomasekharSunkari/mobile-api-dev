import { Test, TestingModule } from '@nestjs/testing';
import { addMinutes } from 'date-fns';
import * as jwt from 'jsonwebtoken';
import { EnvironmentService } from '../../config';
import { JWT_EXPIRATION_MINS } from './auth.constants';
import { AuthService } from './auth.service';
import { TokenPayload } from './strategies/tokenPayload.interface';

jest.mock('../../config', () => ({
  EnvironmentService: {
    getValue: jest.fn(),
  },
}));

jest.mock('jsonwebtoken');

describe('AuthService', () => {
  let service: AuthService;
  const mockJwtSecret = 'test-secret-key-for-testing';

  beforeEach(async () => {
    jest.clearAllMocks();

    (EnvironmentService.getValue as jest.Mock).mockReturnValue(mockJwtSecret);

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('signJwt', () => {
    it('should successfully generate JWT token with all payload fields', async () => {
      const payload: Partial<TokenPayload> = {
        id: 'user-123',
        email: 'test@example.com',
        phone: '+1234567890',
        identity: 'user-identity',
      };

      const mockToken = 'mock.jwt.token';
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const result = await service.signJwt(payload);

      expect(jwt.sign).toHaveBeenCalledWith(
        {
          id: 'user-123',
          email: 'test@example.com',
          phone: '+1234567890',
          identity: 'user-identity',
        },
        mockJwtSecret,
        {
          expiresIn: `${JWT_EXPIRATION_MINS}hrs`,
        },
      );

      expect(result.access_token).toBe(mockToken);
      expect(result.expiration).toBeInstanceOf(Date);
    });

    it('should generate JWT token with only id field', async () => {
      const payload: Partial<TokenPayload> = {
        id: 'user-456',
      };

      const mockToken = 'mock.jwt.token.minimal';
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const result = await service.signJwt(payload);

      expect(jwt.sign).toHaveBeenCalledWith(
        {
          id: 'user-456',
          email: undefined,
          phone: undefined,
          identity: undefined,
        },
        mockJwtSecret,
        {
          expiresIn: `${JWT_EXPIRATION_MINS}hrs`,
        },
      );

      expect(result.access_token).toBe(mockToken);
    });

    it('should generate JWT token with only email field', async () => {
      const payload: Partial<TokenPayload> = {
        email: 'user@example.com',
      };

      const mockToken = 'mock.jwt.token.email';
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const result = await service.signJwt(payload);

      expect(jwt.sign).toHaveBeenCalledWith(
        {
          id: undefined,
          email: 'user@example.com',
          phone: undefined,
          identity: undefined,
        },
        mockJwtSecret,
        {
          expiresIn: `${JWT_EXPIRATION_MINS}hrs`,
        },
      );

      expect(result.access_token).toBe(mockToken);
    });

    it('should generate JWT token with only phone field', async () => {
      const payload: Partial<TokenPayload> = {
        phone: '+9876543210',
      };

      const mockToken = 'mock.jwt.token.phone';
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const result = await service.signJwt(payload);

      expect(jwt.sign).toHaveBeenCalledWith(
        {
          id: undefined,
          email: undefined,
          phone: '+9876543210',
          identity: undefined,
        },
        mockJwtSecret,
        {
          expiresIn: `${JWT_EXPIRATION_MINS}hrs`,
        },
      );

      expect(result.access_token).toBe(mockToken);
    });

    it('should generate JWT token with id and email', async () => {
      const payload: Partial<TokenPayload> = {
        id: 'user-789',
        email: 'combo@example.com',
      };

      const mockToken = 'mock.jwt.token.combo';
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const result = await service.signJwt(payload);

      expect(jwt.sign).toHaveBeenCalledWith(
        {
          id: 'user-789',
          email: 'combo@example.com',
          phone: undefined,
          identity: undefined,
        },
        mockJwtSecret,
        {
          expiresIn: `${JWT_EXPIRATION_MINS}hrs`,
        },
      );

      expect(result.access_token).toBe(mockToken);
    });

    it('should generate JWT token with empty payload', async () => {
      const payload: Partial<TokenPayload> = {};

      const mockToken = 'mock.jwt.token.empty';
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const result = await service.signJwt(payload);

      expect(jwt.sign).toHaveBeenCalledWith(
        {
          id: undefined,
          email: undefined,
          phone: undefined,
          identity: undefined,
        },
        mockJwtSecret,
        {
          expiresIn: `${JWT_EXPIRATION_MINS}hrs`,
        },
      );

      expect(result.access_token).toBe(mockToken);
    });

    it('should calculate expiration time correctly', async () => {
      const payload: Partial<TokenPayload> = {
        id: 'user-123',
      };

      const mockToken = 'mock.jwt.token';
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      // Mock Date.now() to have consistent time for testing
      const mockNow = new Date('2024-01-01T12:00:00.000Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockNow as any);

      const result = await service.signJwt(payload);

      const expectedExpiration = addMinutes(mockNow, JWT_EXPIRATION_MINS);

      expect(result.expiration.getTime()).toBe(expectedExpiration.getTime());
    });

    it('should use correct JWT secret from environment', async () => {
      const payload: Partial<TokenPayload> = {
        id: 'user-123',
      };

      const mockToken = 'mock.jwt.token';
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      await service.signJwt(payload);

      expect(EnvironmentService.getValue).toHaveBeenCalledWith('JWT_SECRET_TOKEN');
      expect(jwt.sign).toHaveBeenCalledWith(expect.any(Object), mockJwtSecret, expect.any(Object));
    });

    it('should use correct expiration time in hours', async () => {
      const payload: Partial<TokenPayload> = {
        id: 'user-123',
      };

      const mockToken = 'mock.jwt.token';
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      await service.signJwt(payload);

      expect(jwt.sign).toHaveBeenCalledWith(expect.any(Object), expect.any(String), {
        expiresIn: `${JWT_EXPIRATION_MINS}hrs`,
      });
    });

    it('should return access_token and expiration in response', async () => {
      const payload: Partial<TokenPayload> = {
        id: 'user-123',
        email: 'test@example.com',
      };

      const mockToken = 'mock.jwt.token.complete';
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const result = await service.signJwt(payload);

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('expiration');
      expect(result.access_token).toBe(mockToken);
      expect(typeof result.expiration.getTime).toBe('function');
      expect(result.expiration.getTime()).toBeGreaterThan(0);
    });

    it('should handle special characters in payload values', async () => {
      const payload: Partial<TokenPayload> = {
        id: 'user-!@#$%',
        email: 'test+special@example.com',
        phone: '+1 (234) 567-8900',
        identity: 'identity-with-special-chars!@#',
      };

      const mockToken = 'mock.jwt.token.special';
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const result = await service.signJwt(payload);

      expect(jwt.sign).toHaveBeenCalledWith(
        {
          id: 'user-!@#$%',
          email: 'test+special@example.com',
          phone: '+1 (234) 567-8900',
          identity: 'identity-with-special-chars!@#',
        },
        mockJwtSecret,
        {
          expiresIn: `${JWT_EXPIRATION_MINS}hrs`,
        },
      );

      expect(result.access_token).toBe(mockToken);
    });

    it('should handle long string values in payload', async () => {
      const longId = 'a'.repeat(500);
      const longEmail = `${'b'.repeat(100)}@example.com`;
      const payload: Partial<TokenPayload> = {
        id: longId,
        email: longEmail,
      };

      const mockToken = 'mock.jwt.token.long';
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const result = await service.signJwt(payload);

      expect(jwt.sign).toHaveBeenCalledWith(
        {
          id: longId,
          email: longEmail,
          phone: undefined,
          identity: undefined,
        },
        mockJwtSecret,
        {
          expiresIn: `${JWT_EXPIRATION_MINS}hrs`,
        },
      );

      expect(result.access_token).toBe(mockToken);
    });

    it('should generate unique tokens for different payloads', async () => {
      const payload1: Partial<TokenPayload> = {
        id: 'user-001',
        email: 'user1@example.com',
      };

      const payload2: Partial<TokenPayload> = {
        id: 'user-002',
        email: 'user2@example.com',
      };

      const mockToken1 = 'mock.jwt.token.1';
      const mockToken2 = 'mock.jwt.token.2';

      (jwt.sign as jest.Mock).mockReturnValueOnce(mockToken1).mockReturnValueOnce(mockToken2);

      const result1 = await service.signJwt(payload1);
      const result2 = await service.signJwt(payload2);

      expect(result1.access_token).toBe(mockToken1);
      expect(result2.access_token).toBe(mockToken2);
      expect(result1.access_token).not.toBe(result2.access_token);
    });

    it('should handle numeric strings in payload', async () => {
      const payload: Partial<TokenPayload> = {
        id: '12345',
        phone: '1234567890',
      };

      const mockToken = 'mock.jwt.token.numeric';
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const result = await service.signJwt(payload);

      expect(jwt.sign).toHaveBeenCalledWith(
        {
          id: '12345',
          email: undefined,
          phone: '1234567890',
          identity: undefined,
        },
        mockJwtSecret,
        {
          expiresIn: `${JWT_EXPIRATION_MINS}hrs`,
        },
      );

      expect(result.access_token).toBe(mockToken);
    });

    it('should handle unicode characters in payload', async () => {
      const payload: Partial<TokenPayload> = {
        id: 'user-中文-123',
        email: 'tëst@example.com',
        identity: 'identity-日本語',
      };

      const mockToken = 'mock.jwt.token.unicode';
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const result = await service.signJwt(payload);

      expect(jwt.sign).toHaveBeenCalledWith(
        {
          id: 'user-中文-123',
          email: 'tëst@example.com',
          phone: undefined,
          identity: 'identity-日本語',
        },
        mockJwtSecret,
        {
          expiresIn: `${JWT_EXPIRATION_MINS}hrs`,
        },
      );

      expect(result.access_token).toBe(mockToken);
    });

    it('should generate token that can be returned multiple times with same payload', async () => {
      const payload: Partial<TokenPayload> = {
        id: 'user-repeat',
        email: 'repeat@example.com',
      };

      const mockToken = 'mock.jwt.token.repeat';
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const result1 = await service.signJwt(payload);
      const result2 = await service.signJwt(payload);

      expect(result1.access_token).toBe(mockToken);
      expect(result2.access_token).toBe(mockToken);
      expect(jwt.sign).toHaveBeenCalledTimes(2);
    });
  });
});
