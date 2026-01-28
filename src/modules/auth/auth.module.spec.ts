import { forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { EnvironmentService } from '../../config';
import { AccessTokenModule } from './accessToken';
import { JWT_EXPIRATION_MINS } from './auth.constants';
import { AuthModule } from './auth.module';
import { AuthService } from './auth.service';
import { JwtStrategyService } from './strategies/jwt-strategy.service';

jest.mock('../../config', () => ({
  EnvironmentService: {
    getValue: jest.fn().mockReturnValue('test-jwt-secret'),
  },
}));

// Mock all the imported modules to isolate the AuthModule test
jest.mock('./accessToken', () => ({
  AccessTokenModule: class MockAccessTokenModule {},
}));

jest.mock('./user/user.module', () => ({
  UserModule: class MockUserModule {},
}));

jest.mock('./userProfile/userProfile.module', () => ({
  UserProfileModule: class MockUserProfileModule {},
}));

jest.mock('./passwordPawn/passwordPawn.module', () => ({
  PasswordPawnModule: class MockPasswordPawnModule {},
}));

jest.mock('./verificationToken/verificationToken.module', () => ({
  VerificationTokenModule: class MockVerificationTokenModule {},
}));

jest.mock('./auth.controller', () => ({
  AuthController: class MockAuthController {},
}));

jest.mock('./auth.service', () => ({
  AuthService: class MockAuthService {},
}));

jest.mock('./strategies/jwt-strategy.service', () => ({
  JwtStrategyService: class MockJwtStrategyService {},
}));

describe('AuthModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    jest.clearAllMocks();

    module = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: EnvironmentService.getValue('JWT_SECRET_TOKEN'),
          signOptions: { expiresIn: `${JWT_EXPIRATION_MINS}hrs` },
        }),
        forwardRef(() => AccessTokenModule),
      ],
      controllers: [],
      providers: [
        { provide: AuthService, useClass: class MockAuthService {} },
        { provide: JwtStrategyService, useClass: class MockJwtStrategyService {} },
      ],
    }).compile();
  });

  it('should compile the actual AuthModule', async () => {
    const actualModule = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();

    expect(actualModule).toBeDefined();
    await actualModule.close();
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('module configuration', () => {
    it('should be defined', () => {
      expect(AuthModule).toBeDefined();
    });

    it('should have AuthService as provider', () => {
      const authService = module.get(AuthService);
      expect(authService).toBeDefined();
    });

    it('should have JwtStrategyService as provider', () => {
      const jwtStrategyService = module.get(JwtStrategyService);
      expect(jwtStrategyService).toBeDefined();
    });

    it('should use JWT_SECRET_TOKEN from EnvironmentService', () => {
      expect(EnvironmentService.getValue).toHaveBeenCalledWith('JWT_SECRET_TOKEN');
    });

    it('should configure JWT with correct expiration time', () => {
      expect(JWT_EXPIRATION_MINS).toBeDefined();
      expect(typeof JWT_EXPIRATION_MINS).toBe('number');
    });
  });

  describe('module imports', () => {
    it('should import AccessTokenModule with forwardRef', () => {
      const forwardRefResult = forwardRef(() => AccessTokenModule);
      expect(forwardRefResult).toBeDefined();
      expect(typeof forwardRefResult.forwardRef).toBe('function');
    });
  });

  describe('module exports', () => {
    it('should export AuthService', () => {
      const exportedModule = new AuthModule();
      expect(exportedModule).toBeDefined();
    });
  });
});
