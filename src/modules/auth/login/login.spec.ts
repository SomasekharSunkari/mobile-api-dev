import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { compare } from 'bcryptjs';
import { sign, verify } from 'jsonwebtoken';
import { EnvironmentService } from '../../../config';
import { OtpRequiredException } from '../../../exceptions/otp_required_exception';
import {
  RestrictionCategory,
  RestrictionErrorType,
  RestrictionException,
} from '../../../exceptions/restriction_exception';
import { UserTierService } from '../../userTier/userTier.service';
import { AccessTokenService } from '../accessToken';
import { AuthService } from '../auth.service';
import { KycVerificationRepository } from '../kycVerification/kycVerification.repository';
import { KycVerificationService } from '../kycVerification/kycVerification.service';
import { LoginDeviceRepository } from '../loginDevice/loginDevice.repository';
import { LoginEventRepository } from '../loginEvent/loginEvent.repository';
import { LoginEventService } from '../loginEvent/loginEvent.service';
import { LoginSecurityService } from '../loginSecurity/loginSecurity.service';
import { RefreshTokenService } from '../refreshToken';
import { UserRepository } from '../user/user.repository';
import { UserService } from '../user/user.service';
import { LoginService } from './login.service';

jest.mock('bcryptjs', () => ({ compare: jest.fn() }));
jest.mock('jsonwebtoken', () => {
  const actual = jest.requireActual('jsonwebtoken');
  return {
    ...actual,
    verify: jest.fn(actual.verify),
  };
});
jest.mock('../../../config', () => ({
  EnvironmentService: {
    getValue: jest.fn(),
  },
}));

const mockUser = {
  id: 'user-id',
  email: 'test@example.com',
  username: 'testuser',
  phone_number: '1234567890',
  password: 'hashed-password',
  is_email_verified: true,
  is_phone_verified: false,
  first_name: 'Test',
  last_name: 'User',
  country: { id: '1', name: 'United States' },
  userRoles: [],
  $fetchGraph: jest.fn().mockResolvedValue(undefined),
};

const mockUserRepository = {
  findActiveByEmail: jest.fn(),
  findActiveByUsername: jest.fn(),
  findActiveByPhone: jest.fn(),
  findActiveById: jest.fn(),
  findById: jest.fn(),
};

const mockAuthService = {};

const mockLoginDeviceRepository = {
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};

const mockLoginEventRepository = {
  create: jest.fn(),
};

const mockKycVerificationRepository = {
  findByUserId: jest.fn(),
};

const mockAccessTokenService = {
  create: jest.fn(),
};

const mockRefreshTokenService = {
  create: jest.fn(),
  verify: jest.fn(),
};

const mockLoginSecurityService = {
  checkIdentifierRateLimit: jest.fn(),
  hasActiveOtp: jest.fn(),
  calculateRiskScore: jest.fn(),
  handleHighRiskLogin: jest.fn(),
  getCurrentLocation: jest.fn(),
  clearIdentifierAttempts: jest.fn(),
  getMaskedContactFromRedis: jest.fn(),
};

const mockLoginEventService = {
  createLoginEvent: jest.fn(),
  getLastKnownLocation: jest.fn(),
};

const mockKycVerificationService = {
  findByUserId: jest.fn(),
};

const mockUserService = {
  getUserDetails: jest.fn(),
};

const mockUserTierService = {
  getUserTier: jest.fn(),
};

describe('LoginService', () => {
  let service: LoginService;
  let originalDisableLoginRegionCheck: string | undefined;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Store original env value and ensure DISABLE_LOGIN_REGION_CHECK is not set
    originalDisableLoginRegionCheck = process.env.DISABLE_LOGIN_REGION_CHECK;
    delete process.env.DISABLE_LOGIN_REGION_CHECK;

    // Default mock for EnvironmentService.getValue - returns undefined unless overridden in specific tests
    (EnvironmentService.getValue as jest.Mock).mockImplementation((key: string) => {
      if (key === 'JWT_SECRET_TOKEN') {
        return process.env.JWT_SECRET_TOKEN || 'test-secret';
      }
      return undefined;
    });

    // Setup UserService mock
    mockUserService.getUserDetails.mockResolvedValue({
      id: 'user-id',
      email: 'test@example.com',
      username: 'testuser',
      first_name: 'Test',
      last_name: 'User',
      phone_number: '1234567890',
      account_verified: false,
      kyc_status: 'verified',
      linked_external_account_status: null,
      isBlacklistedRegion: false,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginService,
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: UserTierService, useValue: mockUserTierService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: LoginDeviceRepository, useValue: mockLoginDeviceRepository },
        { provide: LoginEventRepository, useValue: mockLoginEventRepository },
        { provide: KycVerificationRepository, useValue: mockKycVerificationRepository },
        { provide: AccessTokenService, useValue: mockAccessTokenService },
        { provide: RefreshTokenService, useValue: mockRefreshTokenService },
        { provide: LoginSecurityService, useValue: mockLoginSecurityService },
        { provide: LoginEventService, useValue: mockLoginEventService },
        { provide: KycVerificationService, useValue: mockKycVerificationService },
        { provide: UserService, useValue: mockUserService },
      ],
    }).compile();

    service = module.get<LoginService>(LoginService);
  });

  afterEach(() => {
    // Restore original env value
    if (originalDisableLoginRegionCheck === undefined) {
      delete process.env.DISABLE_LOGIN_REGION_CHECK;
    } else {
      process.env.DISABLE_LOGIN_REGION_CHECK = originalDisableLoginRegionCheck;
    }
  });

  describe('login', () => {
    // testing login
    it('should login user and return tokens', async () => {
      const dto = { email: 'test@example.com', password: 'plaintext' };
      (compare as jest.Mock).mockResolvedValue(true);
      mockUserRepository.findActiveByEmail.mockResolvedValue(mockUser);
      mockAccessTokenService.create.mockResolvedValue({ decodedToken: { access_token: 'token', expiration: 1234 } });
      mockRefreshTokenService.create.mockResolvedValue({ encodedToken: 'refresh' });
      mockKycVerificationRepository.findByUserId.mockResolvedValue({ status: 'verified' });
      mockKycVerificationService.findByUserId.mockResolvedValue({ status: 'verified' });

      // Mock security checks to allow login
      mockLoginSecurityService.checkIdentifierRateLimit.mockResolvedValue({ allowed: true });
      mockLoginSecurityService.hasActiveOtp.mockResolvedValue(false);
      mockLoginSecurityService.calculateRiskScore.mockResolvedValue({ score: 0, reasons: [] });
      mockLoginSecurityService.getCurrentLocation.mockResolvedValue({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
      });

      // Mock device repository calls
      mockLoginDeviceRepository.findOne.mockResolvedValue({
        id: 'device-id',
        user_id: 'user-id',
        device_fingerprint: 'test-fingerprint',
        is_trusted: true,
        last_login: '2023-01-01T00:00:00.000Z',
      });
      mockLoginDeviceRepository.update.mockResolvedValue(undefined);
      mockLoginEventService.createLoginEvent.mockResolvedValue(undefined);
      mockLoginSecurityService.clearIdentifierAttempts.mockResolvedValue(undefined);

      const mockSecurityContext = {
        clientIp: '192.168.1.1',
        fingerprint: 'test-fingerprint',
      };
      const result = await service.login(dto, mockSecurityContext);

      // Cast to AuthPayload since we know this is a successful login (low risk score)
      const authResult = result as any;
      expect(authResult.credentials.access_token).toBe('token');
      expect(authResult.credentials.refresh_token).toBe('refresh');
      expect(authResult.user.id).toBe('user-id');
      expect(authResult.user.kyc_status).toBe('verified');
    });

    it('should throw UnauthorizedException if password does not match', async () => {
      const dto = { email: 'test@example.com', password: 'wrong' };
      (compare as jest.Mock).mockResolvedValue(false);
      mockUserRepository.findActiveByEmail.mockResolvedValue(mockUser);

      const mockSecurityContext = {
        clientIp: '192.168.1.1',
        fingerprint: 'test-fingerprint',
      };
      await expect(service.login(dto, mockSecurityContext)).rejects.toThrow(UnauthorizedException);
    });

    it('should bypass security checks when user has disable_login_restrictions enabled via identifier', async () => {
      const dto = { email: 'test@example.com', password: 'plaintext' };
      const userWithDisabledRestrictions = {
        ...mockUser,
        disable_login_restrictions: true,
      };
      (compare as jest.Mock).mockResolvedValue(true);
      mockUserRepository.findActiveByEmail.mockResolvedValue(userWithDisabledRestrictions);

      mockLoginSecurityService.checkIdentifierRateLimit.mockResolvedValue({
        allowed: false,
        reason: 'Too many attempts',
      });
      mockLoginSecurityService.hasActiveOtp.mockResolvedValue(false);
      mockLoginSecurityService.calculateRiskScore.mockResolvedValue({ score: 0, reasons: [], locationData: null });
      mockAccessTokenService.create.mockResolvedValue({ decodedToken: { access_token: 'token', expiration: 1234 } });
      mockRefreshTokenService.create.mockResolvedValue({ encodedToken: 'refresh' });
      mockKycVerificationService.findByUserId.mockResolvedValue({ status: 'verified' });
      mockLoginDeviceRepository.findOne.mockResolvedValue(null);
      mockLoginDeviceRepository.create.mockResolvedValue({ id: 'device-id' } as any);
      mockLoginDeviceRepository.update.mockResolvedValue(undefined);
      mockLoginEventService.createLoginEvent.mockResolvedValue(undefined);
      mockLoginSecurityService.getCurrentLocation.mockResolvedValue({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
      });
      mockLoginSecurityService.clearIdentifierAttempts.mockResolvedValue(undefined);
      mockUserService.getUserDetails.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        kyc_status: 'verified',
      } as any);

      const mockSecurityContext = {
        clientIp: '192.168.1.1',
        fingerprint: 'test-fingerprint',
      };
      const result = await service.login(dto, mockSecurityContext);

      const authResult = result as any;
      expect(authResult.credentials.access_token).toBe('token');
    });

    it('should check userId when identifier user not found but userId provided', async () => {
      const dto = { email: 'test@example.com', password: 'plaintext' };
      (compare as jest.Mock).mockResolvedValue(true);
      mockUserRepository.findActiveByEmail.mockResolvedValue(null);
      mockUserRepository.findActiveByUsername.mockResolvedValue(null);
      mockUserRepository.findActiveByPhone.mockResolvedValue(null);
      mockLoginSecurityService.checkIdentifierRateLimit.mockResolvedValue({ allowed: true });
      mockLoginSecurityService.hasActiveOtp.mockResolvedValue(false);

      const mockSecurityContext = {
        clientIp: '192.168.1.1',
        fingerprint: 'test-fingerprint',
      };

      await expect(service.login(dto, mockSecurityContext)).rejects.toThrow(UnauthorizedException);
    });

    it('should check userId when only userId provided', async () => {
      const dto = { email: 'test@example.com', password: 'plaintext' };
      const userWithDisabledRestrictions = {
        ...mockUser,
        disable_login_restrictions: true,
      };
      (compare as jest.Mock).mockResolvedValue(true);
      mockUserRepository.findActiveByEmail.mockResolvedValue(mockUser);
      mockUserRepository.findById.mockResolvedValue(userWithDisabledRestrictions);

      mockLoginSecurityService.checkIdentifierRateLimit.mockResolvedValue({ allowed: true });
      mockLoginSecurityService.hasActiveOtp.mockResolvedValue(false);
      mockLoginSecurityService.calculateRiskScore.mockResolvedValue({ score: 0, reasons: [], locationData: null });
      mockAccessTokenService.create.mockResolvedValue({ decodedToken: { access_token: 'token', expiration: 1234 } });
      mockRefreshTokenService.create.mockResolvedValue({ encodedToken: 'refresh' });
      mockKycVerificationService.findByUserId.mockResolvedValue({ status: 'verified' });
      mockLoginDeviceRepository.findOne.mockResolvedValue(null);
      mockLoginDeviceRepository.create.mockResolvedValue({ id: 'device-id' } as any);
      mockLoginDeviceRepository.update.mockResolvedValue(undefined);
      mockLoginEventService.createLoginEvent.mockResolvedValue(undefined);
      mockLoginSecurityService.getCurrentLocation.mockResolvedValue({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
      });
      mockLoginSecurityService.clearIdentifierAttempts.mockResolvedValue(undefined);
      mockUserService.getUserDetails.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        kyc_status: 'verified',
      } as any);

      const mockSecurityContext = {
        clientIp: '192.168.1.1',
        fingerprint: 'test-fingerprint',
      };

      const result = await service.login(dto, mockSecurityContext);
      const authResult = result as any;
      expect(authResult.credentials.access_token).toBe('token');
    });

    it('should bypass OTP check when DISABLE_LOGIN_REGION_CHECK is set', async () => {
      (EnvironmentService.getValue as jest.Mock).mockImplementation((key: string) => {
        if (key === 'DISABLE_LOGIN_REGION_CHECK') {
          return 'true';
        }
        if (key === 'JWT_SECRET_TOKEN') {
          return process.env.JWT_SECRET_TOKEN || 'test-secret';
        }
        return undefined;
      });

      const dto = { email: 'test@example.com', password: 'plaintext' };
      (compare as jest.Mock).mockResolvedValue(true);
      mockUserRepository.findActiveByEmail.mockResolvedValue(mockUser);

      mockLoginSecurityService.checkIdentifierRateLimit.mockResolvedValue({ allowed: true });
      mockLoginSecurityService.calculateRiskScore.mockResolvedValue({ score: 0, reasons: [], locationData: null });
      mockAccessTokenService.create.mockResolvedValue({ decodedToken: { access_token: 'token', expiration: 1234 } });
      mockRefreshTokenService.create.mockResolvedValue({ encodedToken: 'refresh' });
      mockKycVerificationService.findByUserId.mockResolvedValue({ status: 'verified' });
      mockLoginDeviceRepository.findOne.mockResolvedValue(null);
      mockLoginDeviceRepository.create.mockResolvedValue({ id: 'device-id' } as any);
      mockLoginDeviceRepository.update.mockResolvedValue(undefined);
      mockLoginEventService.createLoginEvent.mockResolvedValue(undefined);
      mockLoginSecurityService.getCurrentLocation.mockResolvedValue({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
      });
      mockLoginSecurityService.clearIdentifierAttempts.mockResolvedValue(undefined);

      const mockSecurityContext = {
        clientIp: '192.168.1.1',
        fingerprint: 'test-fingerprint',
      };

      const result = await service.login(dto, mockSecurityContext);
      const authResult = result as any;
      expect(authResult.credentials.access_token).toBe('token');
      expect(mockLoginSecurityService.hasActiveOtp).not.toHaveBeenCalled();
    });

    it('should bypass risk assessment when user has disable_login_restrictions enabled', async () => {
      const dto = { email: 'test@example.com', password: 'plaintext' };
      const userWithDisabledRestrictions = {
        ...mockUser,
        disable_login_restrictions: true,
      };
      (compare as jest.Mock).mockResolvedValue(true);
      mockUserRepository.findActiveByEmail.mockResolvedValue(userWithDisabledRestrictions);

      mockLoginSecurityService.checkIdentifierRateLimit.mockResolvedValue({ allowed: true });
      mockLoginSecurityService.hasActiveOtp.mockResolvedValue(false);
      mockLoginSecurityService.calculateRiskScore.mockResolvedValue({ score: 0, reasons: [], locationData: null });
      mockAccessTokenService.create.mockResolvedValue({ decodedToken: { access_token: 'token', expiration: 1234 } });
      mockRefreshTokenService.create.mockResolvedValue({ encodedToken: 'refresh' });
      mockKycVerificationService.findByUserId.mockResolvedValue({ status: 'verified' });
      mockLoginDeviceRepository.findOne.mockResolvedValue(null);
      mockLoginDeviceRepository.create.mockResolvedValue({ id: 'device-id' } as any);
      mockLoginDeviceRepository.update.mockResolvedValue(undefined);
      mockLoginEventService.createLoginEvent.mockResolvedValue(undefined);
      mockLoginSecurityService.getCurrentLocation.mockResolvedValue({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
      });
      mockLoginSecurityService.clearIdentifierAttempts.mockResolvedValue(undefined);

      const mockSecurityContext = {
        clientIp: '192.168.1.1',
        fingerprint: 'test-fingerprint',
      };
      const result = await service.login(dto, mockSecurityContext);

      const authResult = result as any;
      expect(authResult.credentials.access_token).toBe('token');
      expect(mockLoginSecurityService.calculateRiskScore).toHaveBeenCalledWith(
        'user-id',
        mockSecurityContext,
        userWithDisabledRestrictions,
      );
      expect(mockLoginDeviceRepository.create).toHaveBeenCalled();
      expect(mockUserService.getUserDetails).toHaveBeenCalled();
    });

    it('should handle high risk login when DISABLE_LOGIN_REGION_CHECK is set', async () => {
      (EnvironmentService.getValue as jest.Mock).mockImplementation((key: string) => {
        if (key === 'DISABLE_LOGIN_REGION_CHECK') {
          return 'true';
        }
        if (key === 'JWT_SECRET_TOKEN') {
          return process.env.JWT_SECRET_TOKEN || 'test-secret';
        }
        return undefined;
      });

      const dto = { email: 'test@example.com', password: 'plaintext' };
      (compare as jest.Mock).mockResolvedValue(true);
      mockUserRepository.findActiveByEmail.mockResolvedValue(mockUser);

      mockLoginSecurityService.checkIdentifierRateLimit.mockResolvedValue({ allowed: true });
      mockLoginSecurityService.hasActiveOtp.mockResolvedValue(false);
      mockLoginSecurityService.calculateRiskScore.mockResolvedValue({
        score: 40,
        reasons: ['unusual_location'],
        locationData: null,
      });
      mockAccessTokenService.create.mockResolvedValue({ decodedToken: { access_token: 'token', expiration: 1234 } });
      mockRefreshTokenService.create.mockResolvedValue({ encodedToken: 'refresh' });
      mockKycVerificationService.findByUserId.mockResolvedValue({ status: 'verified' });
      mockLoginDeviceRepository.findOne.mockResolvedValue(null);
      mockLoginDeviceRepository.create.mockResolvedValue({ id: 'device-id' } as any);
      mockLoginDeviceRepository.update.mockResolvedValue(undefined);
      mockLoginEventService.createLoginEvent.mockResolvedValue(undefined);
      mockLoginSecurityService.getCurrentLocation.mockResolvedValue({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
      });
      mockLoginSecurityService.clearIdentifierAttempts.mockResolvedValue(undefined);
      mockUserService.getUserDetails.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        kyc_status: 'verified',
      } as any);

      const mockSecurityContext = {
        clientIp: '192.168.1.1',
        fingerprint: 'test-fingerprint',
      };

      const result = await service.login(dto, mockSecurityContext);
      const authResult = result as any;
      expect(authResult.credentials.access_token).toBe('token');
      expect(mockLoginSecurityService.handleHighRiskLogin).not.toHaveBeenCalled();
    });

    it('should throw RestrictionException when securityCheck.reason is not provided', async () => {
      const dto = { email: 'test@example.com', password: 'plaintext' };
      (compare as jest.Mock).mockResolvedValue(true);
      mockUserRepository.findActiveByEmail.mockResolvedValue(mockUser);

      mockLoginSecurityService.checkIdentifierRateLimit.mockResolvedValue({ allowed: false });

      const mockSecurityContext = {
        clientIp: '192.168.1.1',
        fingerprint: 'test-fingerprint',
      };

      try {
        await service.login(dto, mockSecurityContext);
        fail('Expected RestrictionException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RestrictionException);
        expect(error.type).toBe(RestrictionErrorType.ERR_USER_ACCOUNT_LOCKED);
        expect(error.restrictionCategory).toBe(RestrictionCategory.USER);
      }
    });
  });

  describe('loginWithBiometrics', () => {
    it('should return token and user info for biometric login', async () => {
      const originalJwtSecret = process.env.JWT_SECRET_TOKEN;
      const token = sign({ userId: 'user-id' }, 'secret');
      process.env.JWT_SECRET_TOKEN = 'secret';

      mockUserRepository.findActiveById.mockResolvedValue(mockUser);
      mockRefreshTokenService.verify.mockResolvedValue(true);
      mockAccessTokenService.create.mockResolvedValue({ decodedToken: { access_token: 'token', expiration: 1234 } });
      mockRefreshTokenService.create.mockResolvedValue({ encodedToken: 'refresh' });
      mockKycVerificationService.findByUserId.mockResolvedValue({ status: 'verified' });

      // Mock security checks for low-risk biometric login
      mockLoginSecurityService.checkIdentifierRateLimit.mockResolvedValue({ allowed: true });
      mockLoginSecurityService.hasActiveOtp.mockResolvedValue(false);
      mockLoginSecurityService.calculateRiskScore.mockResolvedValue({ score: 5, reasons: [] });

      // Mock device and location for biometric login
      mockLoginDeviceRepository.findOne.mockResolvedValue({
        id: 'device-id',
        user_id: 'user-id',
        device_fingerprint: 'test-fingerprint',
        is_trusted: true,
        last_login: '2023-01-01T00:00:00.000Z',
      });
      mockLoginDeviceRepository.update.mockResolvedValue(undefined);
      mockLoginEventService.createLoginEvent.mockResolvedValue(undefined);
      mockLoginSecurityService.getCurrentLocation.mockResolvedValue({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
      });
      mockLoginSecurityService.clearIdentifierAttempts.mockResolvedValue(undefined);

      const mockSecurityContext = {
        clientIp: '192.168.1.1',
        fingerprint: 'test-fingerprint',
      };
      const result = await service.loginWithBiometrics(token, mockSecurityContext);

      // Cast to AuthPayload since this is a successful biometric login
      const authResult = result as any;
      expect(authResult.user.id).toBe('user-id');
      expect(authResult.credentials.access_token).toBe('token');
      expect(authResult.credentials.refresh_token).toBe('refresh');
      expect(authResult.user).toHaveProperty('kyc_status'); // Should be regular user format
      expect(authResult.user).toHaveProperty('phone_number');

      if (originalJwtSecret) {
        process.env.JWT_SECRET_TOKEN = originalJwtSecret;
      } else {
        delete process.env.JWT_SECRET_TOKEN;
      }
    });

    it('should handle high-risk biometric login with OTP', async () => {
      const originalJwtSecret = process.env.JWT_SECRET_TOKEN;
      const token = sign({ userId: 'user-id' }, 'secret');
      process.env.JWT_SECRET_TOKEN = 'secret';

      mockUserRepository.findActiveById.mockResolvedValue(mockUser);
      mockRefreshTokenService.verify.mockResolvedValue(true);

      // Mock high-risk security checks for biometric login
      mockLoginSecurityService.checkIdentifierRateLimit.mockResolvedValue({ allowed: true });
      mockLoginSecurityService.hasActiveOtp.mockResolvedValue(false);
      mockLoginSecurityService.calculateRiskScore.mockResolvedValue({
        score: 40,
        reasons: ['unusual_location'],
      });
      mockLoginSecurityService.handleHighRiskLogin.mockResolvedValue({
        maskedContact: '+1****567890',
        reasons: ['unusual_location'],
      });

      const mockSecurityContext = {
        clientIp: '192.168.1.1',
        fingerprint: 'test-fingerprint',
      };

      try {
        await service.loginWithBiometrics(token, mockSecurityContext);
        fail('Expected OtpRequiredException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(OtpRequiredException);
        expect(error.data.otpMessage).toBe('Code sent to ******+1****567890');
        expect(error.data.requiresOtp).toBe(true);
        expect(error.data.maskedContact).toBe('+1****567890');
      }

      if (originalJwtSecret) {
        process.env.JWT_SECRET_TOKEN = originalJwtSecret;
      } else {
        delete process.env.JWT_SECRET_TOKEN;
      }
    });
  });

  describe('successfulLogin', () => {
    beforeEach(() => {
      // Mock common dependencies for successfulLogin tests
      mockAccessTokenService.create.mockResolvedValue({
        decodedToken: { access_token: 'token', expiration: new Date() },
      });
      mockRefreshTokenService.create.mockResolvedValue({ encodedToken: 'refresh' });
      mockKycVerificationService.findByUserId.mockResolvedValue({ status: 'verified' });
      mockLoginDeviceRepository.findOne.mockResolvedValue({
        id: 'device-id',
        user_id: 'user-id',
        device_fingerprint: 'test-fingerprint',
        is_trusted: true,
        last_login: '2023-01-01T00:00:00.000Z',
      });
      mockLoginDeviceRepository.update.mockResolvedValue(undefined);
      mockLoginEventService.createLoginEvent.mockResolvedValue(undefined);
      mockLoginSecurityService.getCurrentLocation.mockResolvedValue({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
      });
      mockLoginSecurityService.clearIdentifierAttempts.mockResolvedValue(undefined);
    });

    it('should return user format for successful login', async () => {
      const mockSecurityContext = {
        clientIp: '192.168.1.1',
        fingerprint: 'test-fingerprint',
      };

      const result = await service.successfulLogin(mockUser as any, mockSecurityContext, {
        score: 10,
        reasons: [],
        locationData: { country: 'US', region: 'CA', city: 'Los Angeles' },
      });

      const authResult = result as any;
      expect(authResult.message).toBe('Login successful');
      expect(authResult.user.phone_number).toBe('1234567890');
      expect(authResult.user.kyc_status).toBe('verified');
      expect(authResult.user).toHaveProperty('kyc_status');
      expect(authResult.user).toHaveProperty('phone_number');
    });

    it('should default to regular user format when isAdmin is not provided', async () => {
      const mockSecurityContext = {
        clientIp: '192.168.1.1',
        fingerprint: 'test-fingerprint',
      };

      const result = await service.successfulLogin(mockUser as any, mockSecurityContext, {
        score: 10,
        reasons: [],
        locationData: { country: 'US', region: 'CA', city: 'Los Angeles' },
      });

      const authResult = result as any;
      expect(authResult.user).toHaveProperty('kyc_status');
      expect(authResult.user).toHaveProperty('phone_number');
    });
  });

  describe('security flow integration', () => {
    it('should handle identifier rate limiting in preValidation checks', async () => {
      const dto = { email: 'test@example.com', password: 'plaintext' };
      mockLoginSecurityService.checkIdentifierRateLimit.mockResolvedValue({
        allowed: false,
        reason: 'Too many attempts',
      });

      const mockSecurityContext = {
        clientIp: '192.168.1.1',
        fingerprint: 'test-fingerprint',
      };

      try {
        await service.login(dto, mockSecurityContext);
        fail('Expected RestrictionException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RestrictionException);
        expect(error.type).toBe(RestrictionErrorType.ERR_USER_ACCOUNT_LOCKED);
        expect(error.message).toBe('Too many attempts');
      }
    });

    it('should throw OTP required exception when active OTP exists', async () => {
      const dto = { email: 'test@example.com', password: 'plaintext' };
      mockLoginSecurityService.checkIdentifierRateLimit.mockResolvedValue({ allowed: true });
      mockLoginSecurityService.hasActiveOtp.mockResolvedValue(true);
      mockLoginSecurityService.getMaskedContactFromRedis.mockResolvedValue('te***@example.com');

      const mockSecurityContext = {
        clientIp: '192.168.1.1',
        fingerprint: 'test-fingerprint',
      };

      try {
        await service.login(dto, mockSecurityContext);
        fail('Expected OtpRequiredException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(OtpRequiredException);
        expect(error.data.otpMessage).toBe(
          'A verification code is already pending. Please check your messages before requesting a new one.',
        );
        expect(error.data.requiresOtp).toBe(true);
        expect(error.data.maskedContact).toBe('te***@example.com');
      }
    });

    it('should throw OTP exception for high-risk login flow for regular users', async () => {
      const dto = { email: 'test@example.com', password: 'plaintext' };
      (compare as jest.Mock).mockResolvedValue(true);
      mockUserRepository.findActiveByEmail.mockResolvedValue(mockUser);

      // Mock high-risk scenario
      mockLoginSecurityService.checkIdentifierRateLimit.mockResolvedValue({ allowed: true });
      mockLoginSecurityService.hasActiveOtp.mockResolvedValue(false);
      mockLoginSecurityService.calculateRiskScore.mockResolvedValue({
        score: 45,
        reasons: ['new_device', 'suspicious_location'],
      });
      mockLoginSecurityService.handleHighRiskLogin.mockResolvedValue({
        maskedContact: 'te***@example.com',
        reasons: ['new_device', 'suspicious_location'],
      });

      const mockSecurityContext = {
        clientIp: '192.168.1.1',
        fingerprint: 'test-fingerprint',
      };

      try {
        await service.login(dto, mockSecurityContext);
        fail('Expected OtpRequiredException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(OtpRequiredException);
        expect(error.data.otpMessage).toBe('Code sent to te***@example.com');
        expect(error.data.requiresOtp).toBe(true);
        expect(error.data.maskedContact).toBe('te***@example.com');
      }
    });
  });

  describe('performPreValidationSecurityChecks', () => {
    it('should bypass rate limits when restrictions are disabled via userId lookup', async () => {
      const mockSecurityContext = { clientIp: '192.168.1.1', fingerprint: 'test-fingerprint' };
      mockUserRepository.findActiveByEmail.mockResolvedValue(null);
      mockUserRepository.findActiveByUsername.mockResolvedValue(null);
      mockUserRepository.findActiveByPhone.mockResolvedValue(null);
      mockUserRepository.findById.mockResolvedValue({ id: 'user-id', disable_login_restrictions: true });

      mockLoginSecurityService.checkIdentifierRateLimit.mockResolvedValue({
        allowed: false,
        reason: 'Too many attempts',
      });
      mockLoginSecurityService.hasActiveOtp.mockResolvedValue(false);

      const result = await (service as any).performPreValidationSecurityChecks(
        mockSecurityContext,
        'test@example.com',
        'user-id',
      );

      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-id');
      expect(mockLoginSecurityService.checkIdentifierRateLimit).toHaveBeenCalledWith(
        { identifier: 'test@example.com' },
        'user-id',
      );
      expect(mockLoginSecurityService.hasActiveOtp).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should return true when active OTP exists and identifier is missing', async () => {
      const mockSecurityContext = { clientIp: '192.168.1.1', fingerprint: 'test-fingerprint' };
      mockUserRepository.findById.mockResolvedValue({ id: 'user-id', disable_login_restrictions: false });
      mockLoginSecurityService.hasActiveOtp.mockResolvedValue(true);

      const result = await (service as any).performPreValidationSecurityChecks(
        mockSecurityContext,
        undefined,
        'user-id',
      );

      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-id');
      expect(mockLoginSecurityService.checkIdentifierRateLimit).not.toHaveBeenCalled();
      expect(mockLoginSecurityService.hasActiveOtp).toHaveBeenCalledWith(mockSecurityContext, undefined);
      expect(result).toBe(true);
    });
  });

  describe('validateUser edge cases', () => {
    it('should find user by username when email not found', async () => {
      const dto = { username: 'testuser', password: 'plaintext' };
      (compare as jest.Mock).mockResolvedValue(true);
      mockUserRepository.findActiveByEmail.mockResolvedValue(null);
      mockUserRepository.findActiveByUsername.mockResolvedValue(mockUser);
      mockAccessTokenService.create.mockResolvedValue({ decodedToken: { access_token: 'token', expiration: 1234 } });
      mockRefreshTokenService.create.mockResolvedValue({ encodedToken: 'refresh' });
      mockKycVerificationService.findByUserId.mockResolvedValue({ status: 'verified' });
      mockLoginSecurityService.checkIdentifierRateLimit.mockResolvedValue({ allowed: true });
      mockLoginSecurityService.hasActiveOtp.mockResolvedValue(false);
      mockLoginSecurityService.calculateRiskScore.mockResolvedValue({ score: 0, reasons: [] });
      mockLoginSecurityService.getCurrentLocation.mockResolvedValue({});
      mockLoginDeviceRepository.findOne.mockResolvedValue({ id: 'device-id', is_trusted: true });
      mockLoginDeviceRepository.update.mockResolvedValue(undefined);
      mockLoginEventService.createLoginEvent.mockResolvedValue(undefined);
      mockLoginSecurityService.clearIdentifierAttempts.mockResolvedValue(undefined);

      const mockSecurityContext = { clientIp: '192.168.1.1', fingerprint: 'test-fingerprint' };
      const result = await service.login(dto, mockSecurityContext);

      expect(mockUserRepository.findActiveByUsername).toHaveBeenCalledWith('testuser');
      expect((result as any).credentials.access_token).toBe('token');
    });

    it('should find user by phone when email and username not found', async () => {
      const dto = { phone_number: '1234567890', password: 'plaintext' };
      (compare as jest.Mock).mockResolvedValue(true);
      mockUserRepository.findActiveByEmail.mockResolvedValue(null);
      mockUserRepository.findActiveByUsername.mockResolvedValue(null);
      mockUserRepository.findActiveByPhone.mockResolvedValue(mockUser);
      mockAccessTokenService.create.mockResolvedValue({ decodedToken: { access_token: 'token', expiration: 1234 } });
      mockRefreshTokenService.create.mockResolvedValue({ encodedToken: 'refresh' });
      mockKycVerificationService.findByUserId.mockResolvedValue({ status: 'verified' });
      mockLoginSecurityService.checkIdentifierRateLimit.mockResolvedValue({ allowed: true });
      mockLoginSecurityService.hasActiveOtp.mockResolvedValue(false);
      mockLoginSecurityService.calculateRiskScore.mockResolvedValue({ score: 0, reasons: [] });
      mockLoginSecurityService.getCurrentLocation.mockResolvedValue({});
      mockLoginDeviceRepository.findOne.mockResolvedValue({ id: 'device-id', is_trusted: true });
      mockLoginDeviceRepository.update.mockResolvedValue(undefined);
      mockLoginEventService.createLoginEvent.mockResolvedValue(undefined);
      mockLoginSecurityService.clearIdentifierAttempts.mockResolvedValue(undefined);

      const mockSecurityContext = { clientIp: '192.168.1.1', fingerprint: 'test-fingerprint' };
      const result = await service.login(dto, mockSecurityContext);

      expect(mockUserRepository.findActiveByPhone).toHaveBeenCalledWith('1234567890');
      expect((result as any).credentials.access_token).toBe('token');
    });

    it('should throw UnauthorizedException when user not found by any identifier', async () => {
      const dto = { email: 'nonexistent@example.com', password: 'plaintext' };
      mockUserRepository.findActiveByEmail.mockResolvedValue(null);
      mockUserRepository.findActiveByUsername.mockResolvedValue(null);
      mockUserRepository.findActiveByPhone.mockResolvedValue(null);
      mockLoginSecurityService.checkIdentifierRateLimit.mockResolvedValue({ allowed: true });
      mockLoginSecurityService.hasActiveOtp.mockResolvedValue(false);

      const mockSecurityContext = { clientIp: '192.168.1.1', fingerprint: 'test-fingerprint' };

      await expect(service.login(dto, mockSecurityContext)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw RestrictionException for user with PENDING_ACCOUNT_DELETION status', async () => {
      const deletedUser = { ...mockUser, status: 'pending_account_deletion' };
      const dto = { email: 'test@example.com', password: 'plaintext' };
      (compare as jest.Mock).mockResolvedValue(true);
      mockUserRepository.findActiveByEmail.mockResolvedValue(deletedUser);
      mockLoginSecurityService.checkIdentifierRateLimit.mockResolvedValue({ allowed: true });
      mockLoginSecurityService.hasActiveOtp.mockResolvedValue(false);

      const mockSecurityContext = { clientIp: '192.168.1.1', fingerprint: 'test-fingerprint' };

      try {
        await service.login(dto, mockSecurityContext);
        fail('Expected RestrictionException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RestrictionException);
        expect(error.type).toBe(RestrictionErrorType.ERR_USER_PENDING_DELETION);
        expect(error.restrictionCategory).toBe(RestrictionCategory.USER);
      }
    });

    it('should throw RestrictionException for user with PENDING_DEACTIVATION status', async () => {
      const deactivatedUser = { ...mockUser, status: 'pending_deactivation' };
      const dto = { email: 'test@example.com', password: 'plaintext' };
      (compare as jest.Mock).mockResolvedValue(true);
      mockUserRepository.findActiveByEmail.mockResolvedValue(deactivatedUser);
      mockLoginSecurityService.checkIdentifierRateLimit.mockResolvedValue({ allowed: true });
      mockLoginSecurityService.hasActiveOtp.mockResolvedValue(false);

      const mockSecurityContext = { clientIp: '192.168.1.1', fingerprint: 'test-fingerprint' };

      try {
        await service.login(dto, mockSecurityContext);
        fail('Expected RestrictionException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RestrictionException);
        expect(error.type).toBe(RestrictionErrorType.ERR_USER_PENDING_DELETION);
        expect(error.restrictionCategory).toBe(RestrictionCategory.USER);
      }
    });
  });

  describe('trackLoginAndDevice', () => {
    it('should create new device when not found', async () => {
      const dto = { email: 'test@example.com', password: 'plaintext' };
      (compare as jest.Mock).mockResolvedValue(true);
      mockUserRepository.findActiveByEmail.mockResolvedValue(mockUser);
      mockAccessTokenService.create.mockResolvedValue({ decodedToken: { access_token: 'token', expiration: 1234 } });
      mockRefreshTokenService.create.mockResolvedValue({ encodedToken: 'refresh' });
      mockKycVerificationService.findByUserId.mockResolvedValue({ status: 'verified' });
      mockLoginSecurityService.checkIdentifierRateLimit.mockResolvedValue({ allowed: true });
      mockLoginSecurityService.hasActiveOtp.mockResolvedValue(false);
      mockLoginSecurityService.calculateRiskScore.mockResolvedValue({ score: 0, reasons: [] });
      mockLoginSecurityService.getCurrentLocation.mockResolvedValue({ city: 'NYC', region: 'NY', country: 'US' });
      mockLoginDeviceRepository.findOne.mockResolvedValue(null);
      mockLoginDeviceRepository.create.mockResolvedValue({ id: 'new-device-id' });
      mockLoginEventService.createLoginEvent.mockResolvedValue(undefined);
      mockLoginSecurityService.clearIdentifierAttempts.mockResolvedValue(undefined);

      const mockSecurityContext = {
        clientIp: '192.168.1.1',
        fingerprint: 'test-fingerprint',
        deviceInfo: { device_name: 'iPhone', device_type: 'mobile', os: 'iOS', browser: 'Safari' },
      };

      await service.login(dto, mockSecurityContext);

      expect(mockLoginDeviceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-id',
          device_fingerprint: 'test-fingerprint',
          is_trusted: true,
        }),
      );
    });

    it('should update untrusted device to trusted on successful login', async () => {
      const dto = { email: 'test@example.com', password: 'plaintext' };
      (compare as jest.Mock).mockResolvedValue(true);
      mockUserRepository.findActiveByEmail.mockResolvedValue(mockUser);
      mockAccessTokenService.create.mockResolvedValue({ decodedToken: { access_token: 'token', expiration: 1234 } });
      mockRefreshTokenService.create.mockResolvedValue({ encodedToken: 'refresh' });
      mockKycVerificationService.findByUserId.mockResolvedValue({ status: 'verified' });
      mockLoginSecurityService.checkIdentifierRateLimit.mockResolvedValue({ allowed: true });
      mockLoginSecurityService.hasActiveOtp.mockResolvedValue(false);
      mockLoginSecurityService.calculateRiskScore.mockResolvedValue({ score: 0, reasons: [] });
      mockLoginSecurityService.getCurrentLocation.mockResolvedValue({});
      mockLoginDeviceRepository.findOne.mockResolvedValue({ id: 'device-id', is_trusted: false });
      mockLoginDeviceRepository.update.mockResolvedValue(undefined);
      mockLoginEventService.createLoginEvent.mockResolvedValue(undefined);
      mockLoginSecurityService.clearIdentifierAttempts.mockResolvedValue(undefined);

      const mockSecurityContext = { clientIp: '192.168.1.1', fingerprint: 'test-fingerprint' };
      await service.login(dto, mockSecurityContext);

      expect(mockLoginDeviceRepository.update).toHaveBeenCalledWith(
        'device-id',
        expect.objectContaining({
          is_trusted: true,
          last_verified_at: expect.any(String),
        }),
      );
    });
  });

  describe('loginWithBiometrics edge cases', () => {
    it('should throw UnauthorizedException when user not found', async () => {
      const originalJwtSecret = process.env.JWT_SECRET_TOKEN;
      const token = sign({ userId: 'nonexistent-user' }, 'secret');
      process.env.JWT_SECRET_TOKEN = 'secret';

      mockUserRepository.findActiveById.mockResolvedValue(null);
      mockLoginSecurityService.checkIdentifierRateLimit.mockResolvedValue({ allowed: true });

      const mockSecurityContext = { clientIp: '192.168.1.1', fingerprint: 'test-fingerprint' };

      await expect(service.loginWithBiometrics(token, mockSecurityContext)).rejects.toThrow(UnauthorizedException);

      if (originalJwtSecret) {
        process.env.JWT_SECRET_TOKEN = originalJwtSecret;
      } else {
        delete process.env.JWT_SECRET_TOKEN;
      }
    });

    it('should throw UnauthorizedException for invalid JWT token', async () => {
      const originalJwtSecret = process.env.JWT_SECRET_TOKEN;
      process.env.JWT_SECRET_TOKEN = 'secret';

      const mockSecurityContext = { clientIp: '192.168.1.1', fingerprint: 'test-fingerprint' };

      await expect(service.loginWithBiometrics('invalid-token', mockSecurityContext)).rejects.toThrow(
        UnauthorizedException,
      );

      if (originalJwtSecret) {
        process.env.JWT_SECRET_TOKEN = originalJwtSecret;
      } else {
        delete process.env.JWT_SECRET_TOKEN;
      }
    });

    it('should throw UnauthorizedException when decoded token is falsy', async () => {
      const originalJwtSecret = process.env.JWT_SECRET_TOKEN;
      process.env.JWT_SECRET_TOKEN = 'secret';

      (verify as jest.Mock).mockReturnValueOnce(null);

      const mockSecurityContext = { clientIp: '192.168.1.1', fingerprint: 'test-fingerprint' };

      await expect(service.loginWithBiometrics('some-token', mockSecurityContext)).rejects.toThrow(
        UnauthorizedException,
      );

      if (originalJwtSecret) {
        process.env.JWT_SECRET_TOKEN = originalJwtSecret;
      } else {
        delete process.env.JWT_SECRET_TOKEN;
      }
    });

    it('should throw OTP required exception when active OTP exists for biometric login', async () => {
      const originalJwtSecret = process.env.JWT_SECRET_TOKEN;
      const token = sign({ userId: 'user-id' }, 'secret');
      process.env.JWT_SECRET_TOKEN = 'secret';

      mockUserRepository.findActiveById.mockResolvedValue(mockUser);
      mockRefreshTokenService.verify.mockResolvedValue(true);
      mockLoginSecurityService.checkIdentifierRateLimit.mockResolvedValue({ allowed: true });
      mockLoginSecurityService.hasActiveOtp.mockResolvedValue(true);
      mockLoginSecurityService.getMaskedContactFromRedis.mockResolvedValue('te***@example.com');

      const mockSecurityContext = { clientIp: '192.168.1.1', fingerprint: 'test-fingerprint' };

      try {
        await service.loginWithBiometrics(token, mockSecurityContext);
        fail('Expected OtpRequiredException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(OtpRequiredException);
      }

      if (originalJwtSecret) {
        process.env.JWT_SECRET_TOKEN = originalJwtSecret;
      } else {
        delete process.env.JWT_SECRET_TOKEN;
      }
    });
  });

  describe('getAllTokenAndKYCDetails', () => {
    it('should return tokens and KYC details', async () => {
      mockAccessTokenService.create.mockResolvedValue({ decodedToken: { access_token: 'token', expiration: 1234 } });
      mockRefreshTokenService.create.mockResolvedValue({ encodedToken: 'refresh' });
      mockKycVerificationService.findByUserId.mockResolvedValue({ status: 'verified' });

      const result = await service.getAllTokenAndKYCDetails(mockUser as any, 'test@example.com', '1234567890');

      expect(result.tokenData.decodedToken.access_token).toBe('token');
      expect(result.refreshToken.encodedToken).toBe('refresh');
      expect(result.kycStatus).toBe('verified');
    });

    it('should handle missing KYC record', async () => {
      mockAccessTokenService.create.mockResolvedValue({ decodedToken: { access_token: 'token', expiration: 1234 } });
      mockRefreshTokenService.create.mockResolvedValue({ encodedToken: 'refresh' });
      mockKycVerificationService.findByUserId.mockResolvedValue(null);

      const result = await service.getAllTokenAndKYCDetails(mockUser as any, 'test@example.com', '1234567890');

      expect(result.kycStatus).toBeUndefined();
    });
  });
});
