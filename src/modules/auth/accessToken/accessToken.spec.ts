import { InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../../../services/redis/redis.service';
import { UtilsService } from '../../../utils/utils.service';
import { JWT_EXPIRATION_MINS } from '../auth.constants';
import { AuthService } from '../auth.service';
import { UserRepository } from '../user/user.repository';
import { AccessTokenService, StoredAccessToken } from './accessToken.service';

describe('AccessTokenService', () => {
  let service: AccessTokenService;

  const mockRedisService = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    getClient: jest.fn(),
  };

  const mockRedisClient = {
    keys: jest.fn(),
    del: jest.fn(),
  };

  const mockAuthService = {
    signJwt: jest.fn(),
  };

  const mockUtilsService = {
    hashPassword: jest.fn(),
  };

  const mockUserRepository = {
    findById: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(UtilsService, 'hashPassword').mockImplementation(mockUtilsService.hashPassword);
    mockRedisService.getClient.mockReturnValue(mockRedisClient);
    mockUserRepository.findById.mockResolvedValue({ disable_login_restrictions: false });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessTokenService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: UserRepository, useValue: mockUserRepository },
      ],
    }).compile();

    service = module.get<AccessTokenService>(AccessTokenService);
  });

  describe('create', () => {
    it('should create a new access token and store it in Redis', async () => {
      const data = { id: 'user-1', email: 'test@example.com', phone_number: '1234567890' };
      const token = {
        access_token: 'jwt-token',
        expiration: new Date('2025-12-31T23:59:59Z'),
      };
      const hashedToken = 'hashed-jwt-token';

      mockRedisService.keys.mockResolvedValue([]);
      mockRedisClient.del.mockResolvedValue(0);
      mockAuthService.signJwt.mockResolvedValue(token);
      mockUtilsService.hashPassword.mockResolvedValue(hashedToken);
      mockRedisService.set.mockResolvedValue('OK');

      const result = await service.create(data);

      expect(mockRedisService.keys).toHaveBeenCalled();
      expect(mockAuthService.signJwt).toHaveBeenCalledWith({
        email: data.email,
        id: data.id,
        phone_number: data.phone_number,
        identity: expect.any(String),
      });
      expect(mockUtilsService.hashPassword).toHaveBeenCalledWith(token.access_token);
      expect(mockRedisService.set).toHaveBeenCalledWith(
        expect.stringContaining(`access_token:${data.id}:`),
        expect.any(String),
        expect.any(Number),
      );
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('decodedToken', token);
    });

    it('should store access token with correct TTL based on JWT_EXPIRATION_MINS', async () => {
      const data = { id: 'user-1', email: 'test@example.com', phone_number: '1234567890' };
      const token = {
        access_token: 'jwt-token',
        expiration: new Date('2025-12-31T23:59:59Z'),
      };
      const hashedToken = 'hashed-jwt-token';
      const expectedTtlSeconds = JWT_EXPIRATION_MINS * 60 * 60;

      mockRedisService.keys.mockResolvedValue([]);
      mockAuthService.signJwt.mockResolvedValue(token);
      mockUtilsService.hashPassword.mockResolvedValue(hashedToken);
      mockRedisService.set.mockResolvedValue('OK');

      await service.create(data);

      expect(mockRedisService.set).toHaveBeenCalledWith(expect.any(String), expect.any(String), expectedTtlSeconds);
    });

    it('should return accessToken with correct StoredAccessToken structure', async () => {
      const data = { id: 'user-1', email: 'test@example.com', phone_number: '1234567890' };
      const token = {
        access_token: 'jwt-token',
        expiration: new Date('2025-12-31T23:59:59Z'),
      };
      const hashedToken = 'hashed-jwt-token';

      mockRedisService.keys.mockResolvedValue([]);
      mockAuthService.signJwt.mockResolvedValue(token);
      mockUtilsService.hashPassword.mockResolvedValue(hashedToken);
      mockRedisService.set.mockResolvedValue('OK');

      const result = await service.create(data);

      const accessToken: StoredAccessToken = result.accessToken;
      expect(accessToken).toHaveProperty('user_id', data.id);
      expect(accessToken).toHaveProperty('token', hashedToken);
      expect(accessToken).toHaveProperty('expiration_time');
      expect(accessToken).toHaveProperty('identity');
      expect(typeof accessToken.identity).toBe('string');
      expect(accessToken.identity.length).toBeGreaterThan(0);
    });

    it('should store JSON stringified access token data in Redis', async () => {
      const data = { id: 'user-1', email: 'test@example.com', phone_number: '1234567890' };
      const token = {
        access_token: 'jwt-token',
        expiration: new Date('2025-12-31T23:59:59Z'),
      };
      const hashedToken = 'hashed-jwt-token';

      mockRedisService.keys.mockResolvedValue([]);
      mockAuthService.signJwt.mockResolvedValue(token);
      mockUtilsService.hashPassword.mockResolvedValue(hashedToken);
      mockRedisService.set.mockResolvedValue('OK');

      await service.create(data);

      const storedData = mockRedisService.set.mock.calls[0][1];
      const parsedData = JSON.parse(storedData);
      expect(parsedData).toHaveProperty('user_id', data.id);
      expect(parsedData).toHaveProperty('token', hashedToken);
      expect(parsedData).toHaveProperty('expiration_time');
      expect(parsedData).toHaveProperty('identity');
    });

    it('should delete existing tokens when shallow is false', async () => {
      const data = { id: 'user-1', email: 'test@example.com', phone_number: '1234567890' };
      const token = {
        access_token: 'jwt-token',
        expiration: new Date('2025-12-31T23:59:59Z'),
      };
      const hashedToken = 'hashed-jwt-token';
      const existingKeys = ['access_token:user-1:old-identity'];

      mockRedisService.keys.mockResolvedValue(existingKeys);
      mockRedisClient.del.mockResolvedValue(1);
      mockAuthService.signJwt.mockResolvedValue(token);
      mockUtilsService.hashPassword.mockResolvedValue(hashedToken);
      mockRedisService.set.mockResolvedValue('OK');

      await service.create(data);

      expect(mockRedisService.keys).toHaveBeenCalledWith(expect.stringContaining(`access_token:${data.id}:`));
      expect(mockRedisClient.del).toHaveBeenCalledWith(...existingKeys);
    });

    it('should delete multiple existing tokens when shallow is false', async () => {
      const data = { id: 'user-1', email: 'test@example.com', phone_number: '1234567890' };
      const token = {
        access_token: 'jwt-token',
        expiration: new Date('2025-12-31T23:59:59Z'),
      };
      const hashedToken = 'hashed-jwt-token';
      const existingKeys = [
        'access_token:user-1:old-identity-1',
        'access_token:user-1:old-identity-2',
        'access_token:user-1:old-identity-3',
      ];

      mockRedisService.keys.mockResolvedValue(existingKeys);
      mockRedisClient.del.mockResolvedValue(3);
      mockAuthService.signJwt.mockResolvedValue(token);
      mockUtilsService.hashPassword.mockResolvedValue(hashedToken);
      mockRedisService.set.mockResolvedValue('OK');

      await service.create(data);

      expect(mockRedisClient.del).toHaveBeenCalledWith(...existingKeys);
    });

    it('should not delete existing tokens when shallow is true', async () => {
      const data = { id: 'user-1', email: 'test@example.com', phone_number: '1234567890' };
      const token = {
        access_token: 'jwt-token',
        expiration: new Date('2025-12-31T23:59:59Z'),
      };
      const hashedToken = 'hashed-jwt-token';

      mockAuthService.signJwt.mockResolvedValue(token);
      mockUtilsService.hashPassword.mockResolvedValue(hashedToken);
      mockRedisService.set.mockResolvedValue('OK');

      await service.create(data, undefined, true);

      expect(mockRedisService.keys).not.toHaveBeenCalled();
    });

    it('should not delete existing tokens when user has disable_login_restrictions enabled', async () => {
      const data = { id: 'user-1', email: 'test@example.com', phone_number: '1234567890' };
      const token = {
        access_token: 'jwt-token',
        expiration: new Date('2025-12-31T23:59:59Z'),
      };
      const hashedToken = 'hashed-jwt-token';

      mockUserRepository.findById.mockResolvedValue({ disable_login_restrictions: true } as any);
      mockAuthService.signJwt.mockResolvedValue(token);
      mockUtilsService.hashPassword.mockResolvedValue(hashedToken);
      mockRedisService.set.mockResolvedValue('OK');

      await service.create(data);

      expect(mockRedisService.keys).not.toHaveBeenCalled();
      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-1');
    });

    it('should delete existing tokens when user has disable_login_restrictions disabled', async () => {
      const data = { id: 'user-1', email: 'test@example.com', phone_number: '1234567890' };
      const token = {
        access_token: 'jwt-token',
        expiration: new Date('2025-12-31T23:59:59Z'),
      };
      const hashedToken = 'hashed-jwt-token';

      mockUserRepository.findById.mockResolvedValue({ disable_login_restrictions: false } as any);
      mockRedisService.keys.mockResolvedValue(['access_token:user-1:token1', 'access_token:user-1:token2']);
      mockAuthService.signJwt.mockResolvedValue(token);
      mockUtilsService.hashPassword.mockResolvedValue(hashedToken);
      mockRedisService.set.mockResolvedValue('OK');
      mockRedisService.del.mockResolvedValue(2);

      await service.create(data);

      expect(mockRedisService.keys).toHaveBeenCalled();
      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-1');
    });

    it('should work with only id provided', async () => {
      const data = { id: 'user-1' };
      const token = {
        access_token: 'jwt-token',
        expiration: new Date('2025-12-31T23:59:59Z'),
      };
      const hashedToken = 'hashed-jwt-token';

      mockRedisService.keys.mockResolvedValue([]);
      mockAuthService.signJwt.mockResolvedValue(token);
      mockUtilsService.hashPassword.mockResolvedValue(hashedToken);
      mockRedisService.set.mockResolvedValue('OK');

      const result = await service.create(data);

      expect(mockAuthService.signJwt).toHaveBeenCalledWith({
        email: undefined,
        id: data.id,
        phone_number: undefined,
        identity: expect.any(String),
      });
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('decodedToken', token);
    });

    it('should throw InternalServerErrorException if an error occurs', async () => {
      mockRedisService.keys.mockRejectedValue(new Error('Redis error'));
      await expect(service.create({ id: 'user-1' })).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException with correct message on error', async () => {
      mockRedisService.keys.mockRejectedValue(new Error('Redis error'));
      await expect(service.create({ id: 'user-1' })).rejects.toThrow(
        'Something went wrong While creating access token',
      );
    });

    it('should throw InternalServerErrorException if signJwt fails', async () => {
      mockRedisService.keys.mockResolvedValue([]);
      mockAuthService.signJwt.mockRejectedValue(new Error('JWT signing failed'));

      await expect(service.create({ id: 'user-1' })).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException if Redis set fails', async () => {
      const data = { id: 'user-1', email: 'test@example.com' };
      const token = {
        access_token: 'jwt-token',
        expiration: new Date('2025-12-31T23:59:59Z'),
      };

      mockRedisService.keys.mockResolvedValue([]);
      mockAuthService.signJwt.mockResolvedValue(token);
      mockUtilsService.hashPassword.mockResolvedValue('hashed-token');
      mockRedisService.set.mockRejectedValue(new Error('Redis set failed'));

      await expect(service.create(data)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('findByIdentity', () => {
    it('should return access token data when found', async () => {
      const userId = 'user-1';
      const identity = 'test-identity';
      const storedData: StoredAccessToken = {
        user_id: userId,
        token: 'hashed-token',
        expiration_time: '2025-12-31 23:59:59',
        identity,
      };

      mockRedisService.get.mockResolvedValue(JSON.stringify(storedData));

      const result = await service.findByIdentity(userId, identity);

      expect(mockRedisService.get).toHaveBeenCalledWith(`access_token:${userId}:${identity}`);
      expect(result).toEqual(storedData);
    });

    it('should correctly parse JSON stored data', async () => {
      const userId = 'user-1';
      const identity = 'test-identity';
      const storedData: StoredAccessToken = {
        user_id: userId,
        token: 'hashed-token-with-special-chars-$#@!',
        expiration_time: '2025-12-31 23:59:59',
        identity,
      };

      mockRedisService.get.mockResolvedValue(JSON.stringify(storedData));

      const result = await service.findByIdentity(userId, identity);

      expect(result).not.toBeNull();
      expect(result.user_id).toBe(storedData.user_id);
      expect(result.token).toBe(storedData.token);
      expect(result.expiration_time).toBe(storedData.expiration_time);
      expect(result.identity).toBe(storedData.identity);
    });

    it('should use correct Redis key format', async () => {
      const userId = 'user-123-abc';
      const identity = 'identity-456-xyz';

      mockRedisService.get.mockResolvedValue(null);

      await service.findByIdentity(userId, identity);

      expect(mockRedisService.get).toHaveBeenCalledWith(`access_token:${userId}:${identity}`);
    });

    it('should return null when access token not found', async () => {
      mockRedisService.get.mockResolvedValue(null);

      const result = await service.findByIdentity('user-1', 'non-existent-identity');

      expect(result).toBeNull();
    });

    it('should return null when Redis returns empty string', async () => {
      mockRedisService.get.mockResolvedValue('');

      const result = await service.findByIdentity('user-1', 'test-identity');

      expect(result).toBeNull();
    });

    it('should return null on Redis error', async () => {
      mockRedisService.get.mockRejectedValue(new Error('Redis error'));

      const result = await service.findByIdentity('user-1', 'test-identity');

      expect(result).toBeNull();
    });

    it('should return null on JSON parse error', async () => {
      mockRedisService.get.mockResolvedValue('invalid-json-data');

      const result = await service.findByIdentity('user-1', 'test-identity');

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete all access tokens for a user', async () => {
      const userId = 'user-1';
      const existingKeys = ['access_token:user-1:identity-1', 'access_token:user-1:identity-2'];

      mockRedisService.keys.mockResolvedValue(existingKeys);
      mockRedisClient.del.mockResolvedValue(2);

      const result = await service.delete(userId);

      expect(mockRedisService.keys).toHaveBeenCalledWith(expect.stringContaining(`access_token:${userId}:`));
      expect(mockRedisClient.del).toHaveBeenCalledWith(...existingKeys);
      expect(result).toBe(2);
    });

    it('should use correct Redis pattern for key matching', async () => {
      const userId = 'user-123-abc';

      mockRedisService.keys.mockResolvedValue([]);

      await service.delete(userId);

      expect(mockRedisService.keys).toHaveBeenCalledWith(`access_token:${userId}:*`);
    });

    it('should return 0 when no tokens exist', async () => {
      mockRedisService.keys.mockResolvedValue([]);

      const result = await service.delete('user-1');

      expect(result).toBe(0);
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });

    it('should delete single token when only one exists', async () => {
      const userId = 'user-1';
      const existingKeys = ['access_token:user-1:single-identity'];

      mockRedisService.keys.mockResolvedValue(existingKeys);
      mockRedisClient.del.mockResolvedValue(1);

      const result = await service.delete(userId);

      expect(mockRedisClient.del).toHaveBeenCalledWith('access_token:user-1:single-identity');
      expect(result).toBe(1);
    });

    it('should delete multiple tokens when many exist', async () => {
      const userId = 'user-1';
      const existingKeys = [
        'access_token:user-1:identity-1',
        'access_token:user-1:identity-2',
        'access_token:user-1:identity-3',
        'access_token:user-1:identity-4',
        'access_token:user-1:identity-5',
      ];

      mockRedisService.keys.mockResolvedValue(existingKeys);
      mockRedisClient.del.mockResolvedValue(5);

      const result = await service.delete(userId);

      expect(mockRedisClient.del).toHaveBeenCalledWith(...existingKeys);
      expect(result).toBe(5);
    });

    it('should accept optional transaction parameter for backward compatibility', async () => {
      const userId = 'user-1';
      const mockTrx = { isTransaction: true };

      mockRedisService.keys.mockResolvedValue([]);

      const result = await service.delete(userId, mockTrx);

      expect(result).toBe(0);
    });

    it('should throw InternalServerErrorException if an error occurs', async () => {
      mockRedisService.keys.mockRejectedValue(new Error('Redis error'));
      await expect(service.delete('user-1')).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException with correct message on error', async () => {
      mockRedisService.keys.mockRejectedValue(new Error('Redis error'));
      await expect(service.delete('user-1')).rejects.toThrow('Something went wrong While deleting access token');
    });

    it('should throw InternalServerErrorException if Redis del fails', async () => {
      mockRedisService.keys.mockResolvedValue(['access_token:user-1:identity-1']);
      mockRedisClient.del.mockRejectedValue(new Error('Redis del failed'));

      await expect(service.delete('user-1')).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('StoredAccessToken interface', () => {
    it('should export StoredAccessToken interface with correct properties', () => {
      const token: StoredAccessToken = {
        user_id: 'user-1',
        token: 'hashed-token',
        expiration_time: '2025-12-31 23:59:59',
        identity: 'test-identity',
      };

      expect(token).toHaveProperty('user_id');
      expect(token).toHaveProperty('token');
      expect(token).toHaveProperty('expiration_time');
      expect(token).toHaveProperty('identity');
    });
  });
});
