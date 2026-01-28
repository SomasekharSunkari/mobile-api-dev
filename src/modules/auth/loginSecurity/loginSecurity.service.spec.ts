import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TransactionMonitoringAdapter } from '../../../adapters/transaction-monitoring/transaction-monitoring-adapter';
import { LoginSecurityConfigProvider } from '../../../config/login-security.config';
import { SecurityContext } from '../../../decorators/http/http_context.interface';
import { OtpRequiredException } from '../../../exceptions/otp_required_exception';
import {
  RestrictionCategory,
  RestrictionErrorType,
  RestrictionException,
} from '../../../exceptions/restriction_exception';
import { MailerService } from '../../../services/queue/processors/mailer/mailer.service';
import { RedisService } from '../../../services/redis/redis.service';
import { UtilsService } from '../../../utils/utils.service';
import { IpCountryBanService } from '../ipCountryBan/ipCountryBan.service';
import { KycVerificationService } from '../kycVerification/kycVerification.service';
import { LoginDeviceService } from '../loginDevice/loginDevice.service';
import { LoginEventService } from '../loginEvent/loginEvent.service';
import { UserRepository } from '../user/user.repository';
import { LoginSecurityCheck } from './loginSecurity.interface';
import { LoginSecurityService } from './loginSecurity.service';

jest.mock('../../../utils/utils.service');

describe('LoginSecurityService', () => {
  let service: LoginSecurityService;
  let redisService: jest.Mocked<RedisService>;
  let loginDeviceService: jest.Mocked<LoginDeviceService>;
  let userRepository: jest.Mocked<UserRepository>;
  let mailerService: jest.Mocked<MailerService>;
  let transactionMonitoringAdapter: jest.Mocked<TransactionMonitoringAdapter>;
  let kycVerificationService: jest.Mocked<KycVerificationService>;
  let loginEventService: jest.Mocked<LoginEventService>;
  let ipCountryBanService: jest.Mocked<IpCountryBanService>;

  const mockConfig = {
    maxAttempts: 5,
    windowSeconds: 3600,
    lockoutDurationSeconds: 900,
    smsOtpThreshold: 30,
    otp: {
      expirationMinutes: 10,
      maxAttempts: 3,
    },
    riskScores: {
      newDevice: 40,
      countryChange: 25,
      regionChange: 15,
      cityChange: 5,
      vpnUsage: 15,
    },
  };

  const mockSecurityContext: SecurityContext = {
    clientIp: '192.168.1.1',
    fingerprint: 'test-fingerprint',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      expire: jest.fn(),
      exists: jest.fn(),
      lpush: jest.fn(),
      lrange: jest.fn(),
      llen: jest.fn(),
      getClient: jest.fn(),
    };

    const mockLoginDeviceService = {
      log: jest.fn(),
      registerDevice: jest.fn(),
      findDeviceByUserAndFingerprint: jest.fn(),
    };

    const mockTransactionMonitoringAdapter = {
      ipCheck: jest.fn(),
      ipCheckForApplicant: jest.fn(),
    };

    const mockKycVerificationService = {
      getUserVerificationTier: jest.fn(),
      findByUserId: jest.fn(),
    };

    const mockLoginEventService = {
      createLoginEvent: jest.fn(),
      getLastKnownLocation: jest.fn(),
    };

    const mockIpCountryBanService = {
      checkAndBlockAccess: jest.fn(),
      isCountryBanned: jest.fn(),
    };

    const mockMailerService = {
      sendEmail: jest.fn(),
      send: jest.fn(),
    };

    const mockUserRepository = {
      findById: jest.fn(),
      findOne: jest.fn(),
      findActiveById: jest.fn(),
      findActiveByEmail: jest.fn(),
      findActiveByUsername: jest.fn(),
      findActiveByPhone: jest.fn(),
    };

    const mockConfigProvider = {
      getConfig: jest.fn().mockReturnValue(mockConfig),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginSecurityService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: LoginDeviceService, useValue: mockLoginDeviceService },
        { provide: TransactionMonitoringAdapter, useValue: mockTransactionMonitoringAdapter },
        { provide: KycVerificationService, useValue: mockKycVerificationService },
        { provide: LoginEventService, useValue: mockLoginEventService },
        { provide: IpCountryBanService, useValue: mockIpCountryBanService },
        { provide: MailerService, useValue: mockMailerService },
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: LoginSecurityConfigProvider, useValue: mockConfigProvider },
      ],
    }).compile();

    service = module.get<LoginSecurityService>(LoginSecurityService);
    redisService = module.get(RedisService);
    loginDeviceService = module.get(LoginDeviceService);
    userRepository = module.get(UserRepository);
    mailerService = module.get(MailerService);
    transactionMonitoringAdapter = module.get(TransactionMonitoringAdapter);
    kycVerificationService = module.get(KycVerificationService);
    loginEventService = module.get(LoginEventService);
    ipCountryBanService = module.get(IpCountryBanService);

    // Setup the getClient mock to return a mock Redis client
    const mockRedisClient = {
      llen: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    };
    redisService.getClient.mockReturnValue(mockRedisClient as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkIdentifierRateLimit', () => {
    const check: LoginSecurityCheck = { identifier: 'test@example.com' };

    it('should allow access when no previous attempts', async () => {
      // Arrange
      redisService.get.mockResolvedValue(null); // Not locked out
      redisService.lpush.mockResolvedValue(1);
      redisService.expire.mockResolvedValue(1);
      redisService.llen.mockResolvedValue(1);
      redisService.lrange.mockResolvedValue([]);

      // Act
      const result = await service.checkIdentifierRateLimit(check);

      // Assert
      expect(result.allowed).toBe(true);
      expect(redisService.lpush).toHaveBeenCalled();
    });

    it('should allow access when under max attempts', async () => {
      // Arrange
      redisService.get.mockResolvedValue(null); // Not locked out
      redisService.lpush.mockResolvedValue(1);
      redisService.expire.mockResolvedValue(1);
      redisService.llen.mockResolvedValue(3);
      redisService.lrange.mockResolvedValue([]);

      // Act
      const result = await service.checkIdentifierRateLimit(check);

      // Assert
      expect(result.allowed).toBe(true);
    });

    it('should block access when identifier is locked out', async () => {
      // Arrange
      const futureTime = Date.now() + 900000; // 15 minutes in the future
      (redisService.getClient() as any).get.mockResolvedValue(futureTime.toString());

      // Act
      const result = await service.checkIdentifierRateLimit(check);

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('temporarily locked');
    });

    it('should handle redis errors gracefully during lockout check', async () => {
      // Arrange
      (redisService.getClient() as any).get.mockRejectedValue(new Error('Redis error'));

      // Act
      const result = await service.checkIdentifierRateLimit(check);

      // Assert
      expect(result.allowed).toBe(true); // Should allow on error (lockout check fails gracefully)
    });

    it('should handle redis errors gracefully after lockout check passes', async () => {
      // Arrange
      (redisService.getClient() as any).get.mockResolvedValue(null); // No lockout
      redisService.lpush.mockRejectedValue(new Error('Redis write error')); // Error during recordAttempt

      // Act
      const result = await service.checkIdentifierRateLimit(check);

      // Assert
      expect(result.allowed).toBe(true); // Should allow on error
    });

    it('should normalize identifier to lowercase', async () => {
      // Arrange
      const checkWithUpperCase: LoginSecurityCheck = { identifier: 'TEST@EXAMPLE.COM' };
      redisService.get.mockResolvedValue(null);
      redisService.lpush.mockResolvedValue(1);
      redisService.expire.mockResolvedValue(1);
      redisService.llen.mockResolvedValue(1);
      redisService.lrange.mockResolvedValue([]);

      // Act
      const result = await service.checkIdentifierRateLimit(checkWithUpperCase);

      // Assert
      expect(result.allowed).toBe(true);
      expect(redisService.lpush).toHaveBeenCalledWith('login_security:attempts:test@example.com', expect.any(String));
    });

    it('should bypass rate limit when login restrictions are disabled for user', async () => {
      // Arrange
      const check: LoginSecurityCheck = { identifier: 'test@example.com' };
      const userId = 'user-123';
      userRepository.findById.mockResolvedValue({ disable_login_restrictions: true } as any);

      // Act
      const result = await service.checkIdentifierRateLimit(check, userId);

      // Assert
      expect(result.allowed).toBe(true);
      expect(userRepository.findById).toHaveBeenCalledWith(userId);
      expect(redisService.lpush).not.toHaveBeenCalled();
    });

    it('should not bypass rate limit when login restrictions are enabled for user', async () => {
      // Arrange
      const check: LoginSecurityCheck = { identifier: 'test@example.com' };
      const userId = 'user-123';
      userRepository.findById.mockResolvedValue({ disable_login_restrictions: false } as any);
      redisService.get.mockResolvedValue(null);
      redisService.lpush.mockResolvedValue(1);
      redisService.expire.mockResolvedValue(1);
      redisService.llen.mockResolvedValue(1);
      redisService.lrange.mockResolvedValue([]);

      // Act
      const result = await service.checkIdentifierRateLimit(check, userId);

      // Assert
      expect(result.allowed).toBe(true);
      expect(userRepository.findById).toHaveBeenCalledWith(userId);
      expect(redisService.lpush).toHaveBeenCalled();
    });

    it('should lockout identifier when max attempts exceeded', async () => {
      // Arrange
      (redisService.getClient() as any).get.mockResolvedValue(null); // Not locked out initially
      redisService.lpush.mockResolvedValue(1);
      redisService.expire.mockResolvedValue(1);
      redisService.lrange.mockResolvedValue([]);
      redisService.llen.mockResolvedValue(6); // Exceeds maxAttempts (5)
      redisService.set.mockResolvedValue('OK');

      // Act
      const result = await service.checkIdentifierRateLimit(check);

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Too many login attempts');
      expect(redisService.set).toHaveBeenCalled(); // Lockout key set
    });

    it('should clear lockout when lockout time has passed', async () => {
      // Arrange
      const pastTime = Date.now() - 1000; // 1 second in the past
      (redisService.getClient() as any).get.mockResolvedValue(pastTime.toString());
      redisService.del.mockResolvedValue(1);
      redisService.lpush.mockResolvedValue(1);
      redisService.expire.mockResolvedValue(1);
      redisService.llen.mockResolvedValue(1);
      redisService.lrange.mockResolvedValue([]);

      // Act
      const result = await service.checkIdentifierRateLimit(check);

      // Assert
      expect(result.allowed).toBe(true);
      expect(redisService.del).toHaveBeenCalledWith('login_security:lockout:test@example.com');
    });

    it('should cleanup old attempts during rate limit check', async () => {
      // Arrange
      const oldAttemptTime = (Date.now() - mockConfig.windowSeconds * 1000 - 1000).toString();
      const validAttemptTime = Date.now().toString();

      (redisService.getClient() as any).get.mockResolvedValue(null);
      redisService.lpush.mockResolvedValue(1);
      redisService.expire.mockResolvedValue(1);
      redisService.lrange.mockResolvedValue([validAttemptTime, oldAttemptTime]);
      redisService.llen.mockResolvedValue(1);
      redisService.del.mockResolvedValue(1);

      // Act
      const result = await service.checkIdentifierRateLimit(check);

      // Assert
      expect(result.allowed).toBe(true);
      expect(redisService.lrange).toHaveBeenCalled();
    });

    it('should handle cleanup when lrange returns empty array', async () => {
      // Arrange
      (redisService.getClient() as any).get.mockResolvedValue(null);
      redisService.lpush.mockResolvedValue(1);
      redisService.expire.mockResolvedValue(1);
      redisService.lrange.mockResolvedValue([]);
      redisService.llen.mockResolvedValue(1);

      // Act
      const result = await service.checkIdentifierRateLimit(check);

      // Assert
      expect(result.allowed).toBe(true);
    });

    it('should handle error in lockout check gracefully', async () => {
      // Arrange
      (redisService.getClient() as any).get.mockRejectedValue(new Error('Connection refused'));
      redisService.lpush.mockResolvedValue(1);
      redisService.expire.mockResolvedValue(1);
      redisService.llen.mockResolvedValue(1);
      redisService.lrange.mockResolvedValue([]);

      // Act
      const result = await service.checkIdentifierRateLimit(check);

      // Assert
      expect(result.allowed).toBe(true); // Allow on error
    });

    it('should handle error in cleanup gracefully', async () => {
      // Arrange
      (redisService.getClient() as any).get.mockResolvedValue(null);
      redisService.lpush.mockResolvedValue(1);
      redisService.expire.mockResolvedValue(1);
      redisService.lrange.mockRejectedValue(new Error('Redis cleanup error'));
      redisService.llen.mockResolvedValue(1);

      // Act
      const result = await service.checkIdentifierRateLimit(check);

      // Assert
      expect(result.allowed).toBe(true);
    });

    it('should handle error in lockout set gracefully and still return not allowed', async () => {
      // Arrange
      (redisService.getClient() as any).get.mockResolvedValue(null);
      redisService.lpush.mockResolvedValue(1);
      redisService.expire.mockResolvedValue(1);
      redisService.lrange.mockResolvedValue([]);
      redisService.llen.mockResolvedValue(6);
      redisService.set.mockRejectedValue(new Error('Redis set error'));

      // Act
      const result = await service.checkIdentifierRateLimit(check);

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Too many login attempts');
    });
  });

  describe('calculateRiskScore', () => {
    const userId = 'test-user-id';

    beforeEach(() => {
      // Setup UtilsService mock
      (UtilsService.getGeoInfoFromIp as jest.Mock).mockReturnValue({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
        timezone: 'America/Los_Angeles',
        isVpn: false,
      });
    });

    it('should calculate low risk score for known device and location', async () => {
      // Arrange
      loginDeviceService.findDeviceByUserAndFingerprint.mockResolvedValue({
        id: 'device-id',
        is_trusted: true,
      } as any);

      loginEventService.getLastKnownLocation.mockResolvedValue({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
      });

      kycVerificationService.findByUserId.mockResolvedValue(null);
      transactionMonitoringAdapter.ipCheck.mockResolvedValue({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
        isVpn: false,
      });
      ipCountryBanService.isCountryBanned.mockResolvedValue(null);

      // Act
      const result = await service.calculateRiskScore(userId, mockSecurityContext);

      // Assert
      expect(result.score).toBe(0);
      expect(result.reasons).toHaveLength(0);
    });

    it('should add risk score for new device', async () => {
      // Arrange
      loginDeviceService.findDeviceByUserAndFingerprint.mockResolvedValue(null); // New device
      loginEventService.getLastKnownLocation.mockResolvedValue(null);
      kycVerificationService.findByUserId.mockResolvedValue(null);
      transactionMonitoringAdapter.ipCheck.mockResolvedValue({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
        isVpn: false,
      });
      ipCountryBanService.isCountryBanned.mockResolvedValue(null);

      // Act
      const result = await service.calculateRiskScore(userId, mockSecurityContext);

      // Assert
      expect(result.score).toBeGreaterThan(0);
      expect(result.reasons).toContain('new device');
    });

    it('should add risk score for VPN usage', async () => {
      // Arrange
      loginDeviceService.findDeviceByUserAndFingerprint.mockResolvedValue({
        id: 'device-id',
        is_trusted: true,
      } as any);

      loginEventService.getLastKnownLocation.mockResolvedValue({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
      });

      // Mock transaction monitoring adapter to return VPN data
      transactionMonitoringAdapter.ipCheck.mockResolvedValue({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
        isVpn: true,
      });

      // Mock KYC verification service
      kycVerificationService.findByUserId.mockResolvedValue(null); // Not KYC approved
      ipCountryBanService.isCountryBanned.mockResolvedValue(null);

      // Act
      const result = await service.calculateRiskScore(userId, mockSecurityContext);

      // Assert
      expect(result.score).toBe(15);
      expect(result.reasons).toContain('VPN usage detected');
    });

    it('should return zero risk score when login restrictions are disabled', async () => {
      // Arrange
      const mockUser = { disable_login_restrictions: true } as any;
      userRepository.findById.mockResolvedValue(mockUser);

      // Act
      const result = await service.calculateRiskScore(userId, mockSecurityContext, mockUser);

      // Assert
      expect(result.score).toBe(0);
      expect(result.reasons).toEqual([]);
      expect(result.locationData).toBeNull();
      expect(loginDeviceService.findDeviceByUserAndFingerprint).not.toHaveBeenCalled();
    });

    it('should add risk score for country change', async () => {
      // Arrange
      loginDeviceService.findDeviceByUserAndFingerprint.mockResolvedValue({
        id: 'device-id',
        is_trusted: true,
      } as any);

      loginEventService.getLastKnownLocation.mockResolvedValue({
        country: 'GB',
        region: 'London',
        city: 'London',
      });

      kycVerificationService.findByUserId.mockResolvedValue(null);
      transactionMonitoringAdapter.ipCheck.mockResolvedValue({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
        isVpn: false,
      });
      ipCountryBanService.isCountryBanned.mockResolvedValue(null);

      // Act
      const result = await service.calculateRiskScore(userId, mockSecurityContext);

      // Assert
      expect(result.score).toBe(mockConfig.riskScores.countryChange);
      expect(result.reasons).toContain('new country (US)');
    });

    it('should add risk score for region change within same country', async () => {
      // Arrange
      loginDeviceService.findDeviceByUserAndFingerprint.mockResolvedValue({
        id: 'device-id',
        is_trusted: true,
      } as any);

      loginEventService.getLastKnownLocation.mockResolvedValue({
        country: 'US',
        region: 'NY',
        city: 'New York',
      });

      kycVerificationService.findByUserId.mockResolvedValue(null);
      transactionMonitoringAdapter.ipCheck.mockResolvedValue({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
        isVpn: false,
      });
      ipCountryBanService.isCountryBanned.mockResolvedValue(null);

      // Act
      const result = await service.calculateRiskScore(userId, mockSecurityContext);

      // Assert
      expect(result.score).toBe(mockConfig.riskScores.regionChange);
      expect(result.reasons).toContain('new region (CA)');
    });

    it('should add risk score for city change within same region', async () => {
      // Arrange
      loginDeviceService.findDeviceByUserAndFingerprint.mockResolvedValue({
        id: 'device-id',
        is_trusted: true,
      } as any);

      loginEventService.getLastKnownLocation.mockResolvedValue({
        country: 'US',
        region: 'CA',
        city: 'Los Angeles',
      });

      kycVerificationService.findByUserId.mockResolvedValue(null);
      transactionMonitoringAdapter.ipCheck.mockResolvedValue({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
        isVpn: false,
      });
      ipCountryBanService.isCountryBanned.mockResolvedValue(null);

      // Act
      const result = await service.calculateRiskScore(userId, mockSecurityContext);

      // Assert
      expect(result.score).toBe(mockConfig.riskScores.cityChange);
      expect(result.reasons).toContain('new city (San Francisco)');
    });

    it('should use KYC applicant-specific IP check for approved users', async () => {
      // Arrange
      loginDeviceService.findDeviceByUserAndFingerprint.mockResolvedValue({
        id: 'device-id',
        is_trusted: true,
      } as any);

      loginEventService.getLastKnownLocation.mockResolvedValue({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
      });

      kycVerificationService.findByUserId.mockResolvedValue({
        status: 'approved',
        provider_ref: 'applicant-123',
      } as any);

      transactionMonitoringAdapter.ipCheckForApplicant.mockResolvedValue({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
        isVpn: false,
      });
      ipCountryBanService.isCountryBanned.mockResolvedValue(null);

      // Act
      const result = await service.calculateRiskScore(userId, mockSecurityContext);

      // Assert
      expect(result.score).toBe(0);
      expect(transactionMonitoringAdapter.ipCheckForApplicant).toHaveBeenCalledWith({
        ipAddress: mockSecurityContext.clientIp,
        applicantId: 'applicant-123',
      });
    });

    it('should handle device check error gracefully', async () => {
      // Arrange
      loginDeviceService.findDeviceByUserAndFingerprint.mockRejectedValue(new Error('Device check failed'));

      loginEventService.getLastKnownLocation.mockResolvedValue(null);
      kycVerificationService.findByUserId.mockResolvedValue(null);
      transactionMonitoringAdapter.ipCheck.mockResolvedValue({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
        isVpn: false,
      });
      ipCountryBanService.isCountryBanned.mockResolvedValue(null);

      // Act
      const result = await service.calculateRiskScore(userId, mockSecurityContext);

      // Assert
      expect(result.score).toBe(0); // Device check returns 0 on error
    });

    it('should throw RestrictionException for banned country', async () => {
      // Arrange
      userRepository.findById.mockResolvedValue({ disable_login_restrictions: false } as any);
      loginDeviceService.findDeviceByUserAndFingerprint.mockResolvedValue({
        id: 'device-id',
        is_trusted: true,
      } as any);

      loginEventService.getLastKnownLocation.mockResolvedValue({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
      });

      kycVerificationService.findByUserId.mockResolvedValue(null);
      transactionMonitoringAdapter.ipCheck.mockResolvedValue({
        country: 'KP',
        region: 'Pyongyang',
        city: 'Pyongyang',
        isVpn: false,
      });
      ipCountryBanService.isCountryBanned.mockResolvedValue({
        type: 'country',
        value: 'KP',
        reason: 'Sanctioned country',
      } as any);

      // Act & Assert
      try {
        await service.calculateRiskScore(userId, mockSecurityContext);
        fail('Expected RestrictionException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RestrictionException);
        expect((error as RestrictionException).type).toBe(RestrictionErrorType.ERR_COMPLIANCE_COUNTRY_BANNED);
        expect((error as RestrictionException).restrictionCategory).toBe(RestrictionCategory.COMPLIANCE);
      }
    });

    it('should fetch user restrictions status when user param is not provided', async () => {
      // Arrange
      userRepository.findById.mockResolvedValue({ disable_login_restrictions: false } as any);
      loginDeviceService.findDeviceByUserAndFingerprint.mockResolvedValue({
        id: 'device-id',
        is_trusted: true,
      } as any);
      loginEventService.getLastKnownLocation.mockResolvedValue({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
      });
      kycVerificationService.findByUserId.mockResolvedValue(null);
      transactionMonitoringAdapter.ipCheck.mockResolvedValue({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
        isVpn: false,
      });
      ipCountryBanService.isCountryBanned.mockResolvedValue(null);

      // Act
      await service.calculateRiskScore(userId, mockSecurityContext);

      // Assert
      expect(userRepository.findById).toHaveBeenCalledWith(userId);
    });

    it('should return 0 score when location data is null', async () => {
      // Arrange
      loginDeviceService.findDeviceByUserAndFingerprint.mockResolvedValue({
        id: 'device-id',
        is_trusted: true,
      } as any);
      loginEventService.getLastKnownLocation.mockResolvedValue(null);
      kycVerificationService.findByUserId.mockResolvedValue(null);
      transactionMonitoringAdapter.ipCheck.mockResolvedValue(null);

      // Act
      const result = await service.calculateRiskScore(userId, mockSecurityContext);

      // Assert
      expect(result.score).toBe(0);
    });

    it('should return null location when KYC approved but no provider_ref', async () => {
      // Arrange
      loginDeviceService.findDeviceByUserAndFingerprint.mockResolvedValue({
        id: 'device-id',
        is_trusted: true,
      } as any);
      loginEventService.getLastKnownLocation.mockResolvedValue(null);
      kycVerificationService.findByUserId.mockResolvedValue({
        status: 'approved',
        provider_ref: null,
      } as any);

      // Act
      const result = await service.calculateRiskScore(userId, mockSecurityContext);

      // Assert
      expect(result.locationData).toBeNull();
    });

    it('should handle non-RestrictionException error in checkLocation gracefully', async () => {
      // Arrange
      userRepository.findById.mockResolvedValue({ disable_login_restrictions: false } as any);
      loginDeviceService.findDeviceByUserAndFingerprint.mockResolvedValue({
        id: 'device-id',
        is_trusted: true,
      } as any);
      kycVerificationService.findByUserId.mockResolvedValue(null);
      transactionMonitoringAdapter.ipCheck.mockResolvedValue({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
        isVpn: false,
      });
      ipCountryBanService.isCountryBanned.mockResolvedValue(null);
      // Throw a regular error in getLastKnownLocation to trigger the catch block
      loginEventService.getLastKnownLocation.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await service.calculateRiskScore(userId, mockSecurityContext);

      // Assert - should return 0 score for location due to error handling
      expect(result.score).toBe(0);
    });

    it('should handle error in checkVPN gracefully', async () => {
      // Arrange
      userRepository.findById.mockResolvedValue({ disable_login_restrictions: false } as any);
      loginDeviceService.findDeviceByUserAndFingerprint.mockResolvedValue({
        id: 'device-id',
        is_trusted: true,
      } as any);
      loginEventService.getLastKnownLocation.mockResolvedValue({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
      });
      kycVerificationService.findByUserId.mockResolvedValue(null);

      // Mock ipCheck to throw error after returning location
      const locationData = {
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
        isVpn: undefined, // This will cause isVpn check to potentially throw
      };
      transactionMonitoringAdapter.ipCheck.mockResolvedValue(locationData);
      ipCountryBanService.isCountryBanned.mockResolvedValue(null);

      // Act
      const result = await service.calculateRiskScore(userId, mockSecurityContext);

      // Assert - should succeed without VPN score
      expect(result.score).toBe(0);
    });

    it('should handle error in checkTimePattern gracefully', async () => {
      // Arrange
      userRepository.findById.mockResolvedValue({ disable_login_restrictions: false } as any);
      loginDeviceService.findDeviceByUserAndFingerprint.mockResolvedValue({
        id: 'device-id',
        is_trusted: true,
      } as any);
      loginEventService.getLastKnownLocation.mockResolvedValue({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
      });
      kycVerificationService.findByUserId.mockResolvedValue(null);
      transactionMonitoringAdapter.ipCheck.mockResolvedValue({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
        isVpn: false,
      });
      ipCountryBanService.isCountryBanned.mockResolvedValue(null);

      // Act
      const result = await service.calculateRiskScore(userId, mockSecurityContext);

      // Assert - should succeed with 0 score for time pattern
      expect(result.score).toBe(0);
    });
  });

  describe('getCurrentLocation', () => {
    const userId = 'test-user-id';

    it('should use standard IP check for non-KYC users', async () => {
      // Arrange
      kycVerificationService.findByUserId.mockResolvedValue(null);
      transactionMonitoringAdapter.ipCheck.mockResolvedValue({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
        isVpn: false,
      });
      ipCountryBanService.isCountryBanned.mockResolvedValue(null);

      // Act
      const result = await service.getCurrentLocation(userId, mockSecurityContext);

      // Assert
      expect(result).toEqual({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
        isVpn: false,
      });
      expect(transactionMonitoringAdapter.ipCheck).toHaveBeenCalledWith({
        ipAddress: mockSecurityContext.clientIp,
        userId: userId,
      });
    });

    it('should use applicant-specific IP check for KYC approved users', async () => {
      // Arrange
      kycVerificationService.findByUserId.mockResolvedValue({
        status: 'approved',
        provider_ref: 'applicant-123',
      } as any);
      transactionMonitoringAdapter.ipCheckForApplicant.mockResolvedValue({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
        isVpn: false,
      });
      ipCountryBanService.isCountryBanned.mockResolvedValue(null);

      // Act
      const result = await service.getCurrentLocation(userId, mockSecurityContext);

      // Assert
      expect(result).toEqual({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
        isVpn: false,
      });
      expect(transactionMonitoringAdapter.ipCheckForApplicant).toHaveBeenCalledWith({
        ipAddress: mockSecurityContext.clientIp,
        applicantId: 'applicant-123',
      });
    });

    it('should return null when KYC approved but no provider_ref', async () => {
      // Arrange
      kycVerificationService.findByUserId.mockResolvedValue({
        status: 'approved',
        provider_ref: null,
      } as any);

      // Act
      const result = await service.getCurrentLocation(userId, mockSecurityContext);

      // Assert
      expect(result).toBeNull();
    });

    it('should throw RestrictionException for banned country', async () => {
      // Arrange
      kycVerificationService.findByUserId.mockResolvedValue(null);
      transactionMonitoringAdapter.ipCheck.mockResolvedValue({
        country: 'KP',
        region: 'Pyongyang',
        city: 'Pyongyang',
        isVpn: false,
      });
      ipCountryBanService.isCountryBanned.mockResolvedValue({
        type: 'country',
        value: 'KP',
        reason: 'Sanctioned country',
      } as any);

      // Act & Assert
      try {
        await service.getCurrentLocation(userId, mockSecurityContext);
        fail('Expected RestrictionException');
      } catch (error) {
        expect(error).toBeInstanceOf(RestrictionException);
        expect((error as RestrictionException).type).toBe(RestrictionErrorType.ERR_COMPLIANCE_COUNTRY_BANNED);
        expect((error as RestrictionException).restrictionCategory).toBe(RestrictionCategory.COMPLIANCE);
      }
    });

    it('should return null on transactionMonitoringAdapter error', async () => {
      // Arrange
      kycVerificationService.findByUserId.mockResolvedValue(null);
      transactionMonitoringAdapter.ipCheck.mockRejectedValue(new Error('API error'));

      // Act
      const result = await service.getCurrentLocation(userId, mockSecurityContext);

      // Assert
      expect(result).toBeNull();
    });

    it('should rethrow RestrictionException when banned country detected', async () => {
      // Arrange
      kycVerificationService.findByUserId.mockResolvedValue(null);
      transactionMonitoringAdapter.ipCheck.mockResolvedValue({
        country: 'IR',
        region: 'Tehran',
        city: 'Tehran',
        isVpn: false,
      });
      ipCountryBanService.isCountryBanned.mockResolvedValue({
        type: 'country',
        value: 'IR',
        reason: 'Access denied',
      } as any);

      // Act & Assert
      await expect(service.getCurrentLocation(userId, mockSecurityContext)).rejects.toBeInstanceOf(
        RestrictionException,
      );
    });

    it('should use standard IP check for KYC non-approved users', async () => {
      // Arrange
      kycVerificationService.findByUserId.mockResolvedValue({
        status: 'pending',
        provider_ref: 'applicant-456',
      } as any);
      transactionMonitoringAdapter.ipCheck.mockResolvedValue({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
        isVpn: false,
      });
      ipCountryBanService.isCountryBanned.mockResolvedValue(null);

      // Act
      const result = await service.getCurrentLocation(userId, mockSecurityContext);

      // Assert
      expect(transactionMonitoringAdapter.ipCheck).toHaveBeenCalled();
      expect(transactionMonitoringAdapter.ipCheckForApplicant).not.toHaveBeenCalled();
      expect(result?.country).toBe('US');
    });

    it('should handle case when locationData country is null', async () => {
      // Arrange
      kycVerificationService.findByUserId.mockResolvedValue(null);
      transactionMonitoringAdapter.ipCheck.mockResolvedValue({
        country: null,
        region: 'Unknown',
        city: 'Unknown',
        isVpn: false,
      });

      // Act
      const result = await service.getCurrentLocation(userId, mockSecurityContext);

      // Assert
      expect(result).toEqual({
        country: null,
        region: 'Unknown',
        city: 'Unknown',
        isVpn: false,
      });
      expect(ipCountryBanService.isCountryBanned).not.toHaveBeenCalled();
    });

    it('should use default reason when banned country has no reason', async () => {
      // Arrange
      kycVerificationService.findByUserId.mockResolvedValue(null);
      transactionMonitoringAdapter.ipCheck.mockResolvedValue({
        country: 'SY',
        region: 'Damascus',
        city: 'Damascus',
        isVpn: false,
      });
      ipCountryBanService.isCountryBanned.mockResolvedValue({
        type: 'country',
        value: 'SY',
        reason: null,
      } as any);

      // Act & Assert
      try {
        await service.getCurrentLocation(userId, mockSecurityContext);
        fail('Expected RestrictionException');
      } catch (error) {
        expect(error).toBeInstanceOf(RestrictionException);
        expect((error as RestrictionException).data.country).toBe('SY');
      }
    });
  });

  describe('hasActiveOtp', () => {
    const mockUserId = 'user-123';
    const mockOtpData = JSON.stringify({
      code: 'hashed-code',
      user_id: mockUserId,
      expiration: Date.now() + 600000,
      attempts: 0,
      masked_contact: 'te***@example.com',
    });

    it('should return true when active OTP exists and no identifier provided', async () => {
      // Arrange
      redisService.get.mockResolvedValue(mockOtpData);

      // Act
      const result = await service.hasActiveOtp(mockSecurityContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when no active OTP', async () => {
      // Arrange
      redisService.get.mockResolvedValue(null);

      // Act
      const result = await service.hasActiveOtp(mockSecurityContext);

      // Assert
      expect(result).toBe(false);
    });

    it('should return true when OTP belongs to the same user (by email)', async () => {
      // Arrange
      redisService.get.mockResolvedValue(mockOtpData);
      userRepository.findActiveByEmail.mockResolvedValue({ id: mockUserId } as any);

      // Act
      const result = await service.hasActiveOtp(mockSecurityContext, 'test@example.com');

      // Assert
      expect(result).toBe(true);
      expect(userRepository.findActiveByEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('should return false when OTP belongs to a different user', async () => {
      // Arrange
      redisService.get.mockResolvedValue(mockOtpData);
      userRepository.findActiveByEmail.mockResolvedValue({ id: 'different-user-id' } as any);

      // Act
      const result = await service.hasActiveOtp(mockSecurityContext, 'other@example.com');

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when user not found by identifier', async () => {
      // Arrange
      redisService.get.mockResolvedValue(mockOtpData);
      userRepository.findActiveByEmail.mockResolvedValue(null);
      userRepository.findActiveByUsername.mockResolvedValue(null);
      userRepository.findActiveByPhone.mockResolvedValue(null);

      // Act
      const result = await service.hasActiveOtp(mockSecurityContext, 'nonexistent@example.com');

      // Assert
      expect(result).toBe(false);
    });

    it('should find user by username when email not found', async () => {
      // Arrange
      redisService.get.mockResolvedValue(mockOtpData);
      userRepository.findActiveByEmail.mockResolvedValue(null);
      userRepository.findActiveByUsername.mockResolvedValue({ id: mockUserId } as any);

      // Act
      const result = await service.hasActiveOtp(mockSecurityContext, 'testuser');

      // Assert
      expect(result).toBe(true);
      expect(userRepository.findActiveByUsername).toHaveBeenCalledWith('testuser');
    });

    it('should find user by phone when email and username not found', async () => {
      // Arrange
      redisService.get.mockResolvedValue(mockOtpData);
      userRepository.findActiveByEmail.mockResolvedValue(null);
      userRepository.findActiveByUsername.mockResolvedValue(null);
      userRepository.findActiveByPhone.mockResolvedValue({ id: mockUserId } as any);

      // Act
      const result = await service.hasActiveOtp(mockSecurityContext, '+1234567890');

      // Assert
      expect(result).toBe(true);
      expect(userRepository.findActiveByPhone).toHaveBeenCalledWith('+1234567890');
    });

    it('should return false when redis throws error', async () => {
      // Arrange
      redisService.get.mockRejectedValue(new Error('Redis error'));

      // Act
      const result = await service.hasActiveOtp(mockSecurityContext, 'test@example.com');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('handleHighRiskLogin', () => {
    const userId = 'test-user-id';
    const riskScore = 35;
    const reasons = ['New device detected'];

    beforeEach(() => {
      userRepository.findById.mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        phone_number: '+1234567890',
      } as any);
      (UtilsService.generateCode as jest.Mock).mockReturnValue('123456');
      (UtilsService.hashPassword as jest.Mock).mockResolvedValue('hashed-otp');
    });

    it('should send email OTP for high risk score', async () => {
      // Arrange
      redisService.set.mockResolvedValue('OK');
      mailerService.send.mockResolvedValue(undefined);
      userRepository.findActiveById.mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        phone_number: '+1234567890',
        first_name: 'Test',
        last_name: 'User',
      } as any);

      kycVerificationService.findByUserId.mockResolvedValue(null);
      transactionMonitoringAdapter.ipCheck.mockResolvedValue({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
      });
      ipCountryBanService.isCountryBanned.mockResolvedValue(null);

      // Act
      const result = await service.handleHighRiskLogin(riskScore, userId, mockSecurityContext, reasons);

      // Assert
      expect(result.maskedContact).toBe('te***@example.com');
      expect(result.reasons).toEqual(reasons);
      expect(mailerService.send).toHaveBeenCalled();
      expect(redisService.set).toHaveBeenCalledWith(expect.stringContaining('otp'), expect.any(String), 600);
    });

    it('should send email OTP regardless of phone availability', async () => {
      // Arrange
      userRepository.findActiveById.mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        phone_number: null,
        first_name: 'Test',
        last_name: 'User',
      } as any);

      redisService.set.mockResolvedValue('OK');
      mailerService.send.mockResolvedValue(undefined);
      kycVerificationService.findByUserId.mockResolvedValue(null);
      transactionMonitoringAdapter.ipCheck.mockResolvedValue({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
      });
      ipCountryBanService.isCountryBanned.mockResolvedValue(null);

      // Act
      const result = await service.handleHighRiskLogin(riskScore, userId, mockSecurityContext, reasons);

      // Assert
      expect(result.maskedContact).toBe('te***@example.com');
      expect(result.reasons).toEqual(reasons);
      expect(mailerService.send).toHaveBeenCalled();
    });

    it('should throw error when user not found', async () => {
      // Arrange
      userRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.handleHighRiskLogin(riskScore, userId, mockSecurityContext, reasons)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should skip OTP requirement when login restrictions are disabled', async () => {
      // Arrange
      userRepository.findById.mockResolvedValue({ disable_login_restrictions: true } as any);

      // Act
      const result = await service.handleHighRiskLogin(riskScore, userId, mockSecurityContext, reasons);

      // Assert
      expect(result.maskedContact).toBe('');
      expect(result.reasons).toEqual([]);
      expect(userRepository.findById).toHaveBeenCalledWith(userId);
      expect(mailerService.send).not.toHaveBeenCalled();
      expect(redisService.set).not.toHaveBeenCalled();
    });

    it('should continue login even when notification email fails', async () => {
      // Arrange
      redisService.set.mockResolvedValue('OK');
      userRepository.findActiveById.mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        phone_number: '+1234567890',
        first_name: 'Test',
        last_name: 'User',
      } as any);

      // First call succeeds (OTP email), second call fails (notification email)
      mailerService.send
        .mockResolvedValueOnce(undefined) // OTP email success
        .mockRejectedValueOnce(new Error('SMTP error')); // Notification email fails

      kycVerificationService.findByUserId.mockResolvedValue(null);
      transactionMonitoringAdapter.ipCheck.mockResolvedValue({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
      });
      ipCountryBanService.isCountryBanned.mockResolvedValue(null);

      // Act
      const result = await service.handleHighRiskLogin(riskScore, userId, mockSecurityContext, reasons);

      // Assert
      expect(result.maskedContact).toBe('te***@example.com');
      expect(result.reasons).toEqual(reasons);
    });

    it('should throw error when OTP email fails to send', async () => {
      // Arrange
      redisService.set.mockResolvedValue('OK');
      userRepository.findActiveById.mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        phone_number: '+1234567890',
        first_name: 'Test',
        last_name: 'User',
      } as any);
      mailerService.send.mockRejectedValue(new Error('SMTP connection failed'));

      // Act & Assert
      await expect(service.handleHighRiskLogin(riskScore, userId, mockSecurityContext, reasons)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should mask email correctly for short usernames', async () => {
      // Arrange
      redisService.set.mockResolvedValue('OK');
      mailerService.send.mockResolvedValue(undefined);
      userRepository.findActiveById.mockResolvedValue({
        id: userId,
        email: 'ab@example.com', // Short username (2 chars)
        phone_number: '+1234567890',
        first_name: 'Test',
        last_name: 'User',
      } as any);
      kycVerificationService.findByUserId.mockResolvedValue(null);
      transactionMonitoringAdapter.ipCheck.mockResolvedValue({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
      });
      ipCountryBanService.isCountryBanned.mockResolvedValue(null);

      // Act
      const result = await service.handleHighRiskLogin(riskScore, userId, mockSecurityContext, reasons);

      // Assert
      expect(result.maskedContact).toBe('***@example.com');
    });

    it('should throw UnauthorizedException when user not found for OTP generation', async () => {
      // Arrange
      userRepository.findById.mockResolvedValue({
        id: userId,
        disable_login_restrictions: false,
      } as any);
      userRepository.findActiveById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.handleHighRiskLogin(riskScore, userId, mockSecurityContext, reasons)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('verifyLoginOtp', () => {
    const userId = 'test-user-id';
    const otp = '123456';

    it('should verify correct OTP successfully', async () => {
      // Arrange
      const otpData = JSON.stringify({
        user_id: userId,
        code: 'hashed-otp-code',
        expiration: Date.now() + 600000,
        attempts: 0,
      });
      redisService.get.mockResolvedValue(otpData);
      redisService.del.mockResolvedValue(1);
      userRepository.findActiveById.mockResolvedValue({
        id: userId,
        email: 'test@example.com',
      } as any);

      (UtilsService.comparePassword as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await service.verifyLoginOtp(otp, mockSecurityContext);

      // Assert
      expect(result.success).toBe(true);
      expect(result.user.id).toBe(userId);
      expect(redisService.del).toHaveBeenCalled();
      expect(UtilsService.comparePassword).toHaveBeenCalledWith(otp, 'hashed-otp-code');
    });

    it('should reject incorrect OTP', async () => {
      // Arrange
      const otpData = JSON.stringify({
        user_id: userId,
        code: 'wrong-hashed-otp',
        expiration: Date.now() + 600000,
        attempts: 0,
      });
      redisService.get.mockResolvedValue(otpData);
      redisService.set.mockResolvedValue('OK');

      (UtilsService.comparePassword as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      try {
        await service.verifyLoginOtp(otp, mockSecurityContext);
        fail('Expected OtpRequiredException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(OtpRequiredException);
        expect(error.data.otpMessage).toBe('Invalid OTP code');
      }
    });

    it('should reject expired OTP', async () => {
      // Arrange
      redisService.get.mockResolvedValue(null);

      // Act & Assert
      try {
        await service.verifyLoginOtp(otp, mockSecurityContext);
        fail('Expected OtpRequiredException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(OtpRequiredException);
        expect(error.data.otpMessage).toBe('OTP expired or not found');
      }
    });

    it('should reject OTP that has expired (past expiration time)', async () => {
      // Arrange
      const otpData = JSON.stringify({
        user_id: userId,
        code: 'hashed-otp-code',
        expiration: Date.now() - 1000, // Expired 1 second ago
        attempts: 0,
      });
      redisService.get.mockResolvedValue(otpData);
      redisService.del.mockResolvedValue(1);

      // Act & Assert
      try {
        await service.verifyLoginOtp(otp, mockSecurityContext);
        fail('Expected OtpRequiredException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(OtpRequiredException);
        expect(error.data.otpMessage).toBe('OTP has expired');
        expect(redisService.del).toHaveBeenCalled();
      }
    });

    it('should reject OTP when max attempts exceeded', async () => {
      // Arrange
      const otpData = JSON.stringify({
        user_id: userId,
        code: 'hashed-otp-code',
        expiration: Date.now() + 600000,
        attempts: 3, // Max attempts reached
      });
      redisService.get.mockResolvedValue(otpData);
      redisService.del.mockResolvedValue(1);

      // Act & Assert
      try {
        await service.verifyLoginOtp(otp, mockSecurityContext);
        fail('Expected OtpRequiredException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(OtpRequiredException);
        expect(error.data.otpMessage).toBe('Too many OTP attempts');
        expect(redisService.del).toHaveBeenCalled();
      }
    });

    it('should throw UnauthorizedException when user not found after OTP verification', async () => {
      // Arrange
      const otpData = JSON.stringify({
        user_id: userId,
        code: 'hashed-otp-code',
        expiration: Date.now() + 600000,
        attempts: 0,
      });
      redisService.get.mockResolvedValue(otpData);
      redisService.del.mockResolvedValue(1);
      userRepository.findActiveById.mockResolvedValue(null);

      (UtilsService.comparePassword as jest.Mock).mockResolvedValue(true);

      // Act & Assert
      await expect(service.verifyLoginOtp(otp, mockSecurityContext)).rejects.toThrow(UnauthorizedException);
    });

    it('should use masked_contact from OTP data when available', async () => {
      // Arrange
      const otpData = JSON.stringify({
        user_id: userId,
        code: 'hashed-otp-code',
        expiration: Date.now() + 600000,
        attempts: 2,
        masked_contact: 'te***@example.com',
      });
      redisService.get.mockResolvedValue(otpData);
      redisService.set.mockResolvedValue('OK');

      (UtilsService.comparePassword as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      try {
        await service.verifyLoginOtp(otp, mockSecurityContext);
        fail('Expected OtpRequiredException');
      } catch (error) {
        expect(error).toBeInstanceOf(OtpRequiredException);
      }
    });
  });

  describe('resendLoginOtp', () => {
    it('should successfully resend OTP and return masked contact for email', async () => {
      // Arrange
      const mockOtpSession = {
        user_id: 'test-user-id',
      };

      redisService.get.mockResolvedValue(JSON.stringify(mockOtpSession));
      jest.spyOn(service as any, 'generateAndSendOtp').mockResolvedValue('te***@example.com');

      // Act
      const result = await service.resendLoginOtp(mockSecurityContext);

      // Assert
      expect(result).toEqual({
        maskedContact: 'te***@example.com',
      });

      expect(redisService.get).toHaveBeenCalledWith(
        `login_otp:${mockSecurityContext.clientIp}:${mockSecurityContext.fingerprint}`,
      );
      expect(service['generateAndSendOtp']).toHaveBeenCalledWith('test-user-id', mockSecurityContext);
    });

    it('should throw OtpRequiredException when no OTP session exists', async () => {
      // Arrange
      redisService.get.mockResolvedValue(null);

      // Act & Assert
      try {
        await service.resendLoginOtp(mockSecurityContext);
        fail('Expected OtpRequiredException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(OtpRequiredException);
        expect(error.data.otpMessage).toBe('No active OTP session found. Please try logging in again.');
        expect(error.data.maskedContact).toBe('***@***.com');
      }
    });

    it('should successfully resend OTP and return masked contact for phone', async () => {
      // Arrange
      const mockOtpSession = {
        user_id: 'test-user-id',
      };

      redisService.get.mockResolvedValue(JSON.stringify(mockOtpSession));
      jest.spyOn(service as any, 'generateAndSendOtp').mockResolvedValue('+1****567890');

      // Act
      const result = await service.resendLoginOtp(mockSecurityContext);

      // Assert
      expect(result).toEqual({
        maskedContact: '+1****567890',
      });

      expect(service['generateAndSendOtp']).toHaveBeenCalledWith('test-user-id', mockSecurityContext);
    });

    it('should throw OtpRequiredException when generateAndSendOtp fails', async () => {
      // Arrange
      const mockOtpSession = {
        user_id: 'test-user-id',
        masked_contact: 'te***@example.com',
      };

      redisService.get.mockResolvedValue(JSON.stringify(mockOtpSession));
      jest.spyOn(service as any, 'generateAndSendOtp').mockRejectedValue(new Error('Failed to send email'));

      // Act & Assert
      try {
        await service.resendLoginOtp(mockSecurityContext);
        fail('Expected OtpRequiredException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(OtpRequiredException);
        expect(error.data.otpMessage).toBe('Failed to resend verification code. Please try again.');
        // getMaskedContactFromRedis returns the masked_contact from the session when it exists
        expect(error.data.maskedContact).toBe('te***@example.com');
      }
    });

    it('should rethrow OtpRequiredException without wrapping', async () => {
      // Arrange
      const mockOtpSession = {
        user_id: 'test-user-id',
      };

      redisService.get.mockResolvedValue(JSON.stringify(mockOtpSession));
      const originalException = new OtpRequiredException('Custom OTP error', 'custom@masked.com');
      jest.spyOn(service as any, 'generateAndSendOtp').mockRejectedValue(originalException);

      // Act & Assert
      try {
        await service.resendLoginOtp(mockSecurityContext);
        fail('Expected OtpRequiredException');
      } catch (error) {
        expect(error).toBeInstanceOf(OtpRequiredException);
        expect(error.data.otpMessage).toBe('Custom OTP error');
      }
    });
  });

  describe('getMaskedContactFromRedis', () => {
    it('should return masked contact from Redis OTP session', async () => {
      // Arrange
      const otpData = JSON.stringify({
        user_id: 'test-user-id',
        code: 'hashed-otp-code',
        expiration: Date.now() + 600000,
        attempts: 0,
        masked_contact: 'ky***@onedosh.com',
      });
      redisService.get.mockResolvedValue(otpData);

      // Act
      const result = await service.getMaskedContactFromRedis(mockSecurityContext);

      // Assert
      expect(result).toBe('ky***@onedosh.com');
      expect(redisService.get).toHaveBeenCalledWith(
        `login_otp:${mockSecurityContext.clientIp}:${mockSecurityContext.fingerprint}`,
      );
    });

    it('should return default masked contact when Redis data not found', async () => {
      // Arrange
      redisService.get.mockResolvedValue(null);

      // Act
      const result = await service.getMaskedContactFromRedis(mockSecurityContext);

      // Assert
      expect(result).toBe('***@***.com');
    });

    it('should return default masked contact when masked_contact is missing', async () => {
      // Arrange
      const otpData = JSON.stringify({
        user_id: 'test-user-id',
        code: 'hashed-otp-code',
        expiration: Date.now() + 600000,
        attempts: 0,
      });
      redisService.get.mockResolvedValue(otpData);

      // Act
      const result = await service.getMaskedContactFromRedis(mockSecurityContext);

      // Assert
      expect(result).toBe('***@***.com');
    });

    it('should return default masked contact when Redis throws error', async () => {
      // Arrange
      redisService.get.mockRejectedValue(new Error('Redis connection error'));

      // Act
      const result = await service.getMaskedContactFromRedis(mockSecurityContext);

      // Assert
      expect(result).toBe('***@***.com');
    });

    it('should return default masked contact when JSON parse fails', async () => {
      // Arrange
      redisService.get.mockResolvedValue('invalid-json');

      // Act
      const result = await service.getMaskedContactFromRedis(mockSecurityContext);

      // Assert
      expect(result).toBe('***@***.com');
    });
  });

  describe('clearIdentifierAttempts', () => {
    it('should clear identifier attempts from Redis', async () => {
      // Arrange
      redisService.del.mockResolvedValue(1);

      // Act
      await service.clearIdentifierAttempts('test@example.com', mockSecurityContext);

      // Assert
      expect(redisService.del).toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      // Arrange
      redisService.del.mockRejectedValue(new Error('Redis error'));

      // Act & Assert
      await expect(service.clearIdentifierAttempts('test@example.com')).resolves.not.toThrow();
    });

    it('should normalize identifier to lowercase', async () => {
      // Arrange
      redisService.del.mockResolvedValue(1);

      // Act
      await service.clearIdentifierAttempts('TEST@EXAMPLE.COM', mockSecurityContext);

      // Assert
      expect(redisService.del).toHaveBeenCalledWith('login_security:attempts:test@example.com');
      expect(redisService.del).toHaveBeenCalledWith('login_security:lockout:test@example.com');
    });

    it('should clear OTP key when securityContext is provided', async () => {
      // Arrange
      redisService.del.mockResolvedValue(1);

      // Act
      await service.clearIdentifierAttempts('test@example.com', mockSecurityContext);

      // Assert
      expect(redisService.del).toHaveBeenCalledWith(
        `login_otp:${mockSecurityContext.clientIp}:${mockSecurityContext.fingerprint}`,
      );
    });

    it('should not clear OTP key when securityContext is not provided', async () => {
      // Arrange
      redisService.del.mockResolvedValue(1);

      // Act
      await service.clearIdentifierAttempts('test@example.com');

      // Assert
      expect(redisService.del).toHaveBeenCalledTimes(2); // Only attempts and lockout keys
      expect(redisService.del).toHaveBeenCalledWith('login_security:attempts:test@example.com');
      expect(redisService.del).toHaveBeenCalledWith('login_security:lockout:test@example.com');
    });

    it('should not clear OTP key when securityContext has missing clientIp', async () => {
      // Arrange
      redisService.del.mockResolvedValue(1);
      const partialContext = { fingerprint: 'test-fingerprint' } as SecurityContext;

      // Act
      await service.clearIdentifierAttempts('test@example.com', partialContext);

      // Assert
      expect(redisService.del).toHaveBeenCalledTimes(2);
    });

    it('should not clear OTP key when securityContext has missing fingerprint', async () => {
      // Arrange
      redisService.del.mockResolvedValue(1);
      const partialContext = { clientIp: '192.168.1.1' } as SecurityContext;

      // Act
      await service.clearIdentifierAttempts('test@example.com', partialContext);

      // Assert
      expect(redisService.del).toHaveBeenCalledTimes(2);
    });
  });
});
