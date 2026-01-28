import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../../../services/redis/redis.service';
import { AuthService } from '../auth.service';
import { UserRepository } from '../user/user.repository';
import { AccessTokenModule } from './accessToken.module';
import { AccessTokenService } from './accessToken.service';

jest.mock('../auth.module', () => ({ AuthModule: class AuthModule {} }));
jest.mock('../user/user.module', () => ({ UserModule: class UserModule {} }));

describe('AccessTokenModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    const mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      getClient: jest.fn().mockReturnValue({
        keys: jest.fn(),
        options: { keyPrefix: '' },
      }),
    };

    const mockAuthService = {
      signJwt: jest.fn(),
    };

    const mockUserRepository = {
      findById: jest.fn(),
    };

    module = await Test.createTestingModule({
      providers: [
        AccessTokenService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: UserRepository, useValue: mockUserRepository },
      ],
      exports: [AccessTokenService],
    }).compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should export AccessTokenService', () => {
    const accessTokenService = module.get<AccessTokenService>(AccessTokenService);
    expect(accessTokenService).toBeDefined();
  });

  it('should define AccessTokenModule', () => {
    expect(AccessTokenModule).toBeDefined();
  });
});
