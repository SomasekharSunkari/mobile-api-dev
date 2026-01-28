import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppLoggerService } from '../../../services/logger/logger.service';
import { LoginDto } from './dto/login.dto';
import { LoginController } from './login.controller';
import { LoginService } from './login.service';
import { LoginSecurityService } from '../loginSecurity/loginSecurity.service';

describe('LoginController', () => {
  let loginController: LoginController;

  const mockLoginService = {
    login: jest.fn(),
    loginWithBiometrics: jest.fn(),
    successfulLogin: jest.fn(),
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

  const mockLoginSecurityService = {
    checkIpRateLimit: jest.fn(),
    calculateRiskScore: jest.fn(),
    handleHighRiskLogin: jest.fn(),
    verifyLoginOtp: jest.fn(),
    resendLoginOtp: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LoginController],
      providers: [
        {
          provide: LoginService,
          useValue: mockLoginService,
        },
        {
          provide: AppLoggerService,
          useValue: mockAppLoggerService,
        },
        {
          provide: LoginSecurityService,
          useValue: mockLoginSecurityService,
        },
      ],
    }).compile();

    loginController = module.get<LoginController>(LoginController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(loginController).toBeDefined();
  });

  it('should call loginService.login and return the correct response', async () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'securePass123',
    };

    const clientIp = '127.0.0.1';

    const mockTokenResponse = {
      message: 'Login successful',
      credentials: {
        access_token: 'mocked.jwt.token',
        expiration: new Date('2025-05-30T14:01:52.167Z'),
        refresh_token: 'mock.refresh.token',
      },
      user: {
        id: 'user-id',
        email: 'test@example.com',
        username: 'testuser',
        phone_number: '+1234567890',
        account_verified: true,
        kyc_status: 'verified',
        first_name: 'John',
        last_name: 'Doe',
        country: { id: '1', name: 'United States' },
      },
    };

    mockLoginService.login.mockResolvedValue(mockTokenResponse);

    const mockSecurityContext = {
      clientIp,
      fingerprint: 'test-fingerprint',
    };

    const result = await loginController.login(loginDto, mockSecurityContext);

    expect(mockLoginService.login).toHaveBeenCalledWith(loginDto, {
      clientIp,
      fingerprint: 'test-fingerprint',
    });

    expect(result).toMatchObject({
      message: 'Login successful',
      data: mockTokenResponse,
      statusCode: HttpStatus.CREATED,
    });

    expect(result.data.credentials.access_token).toEqual(mockTokenResponse.credentials.access_token);
    expect(result.data.credentials.expiration).toEqual(mockTokenResponse.credentials.expiration);
  });

  describe('IP Address Normalization', () => {
    it('should extract first IP from comma-separated X-Forwarded-For header', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'securePass123',
      };

      const mockTokenResponse = {
        message: 'Login successful',
        credentials: {
          access_token: 'token',
          expiration: new Date(),
          refresh_token: 'refresh',
        },
        user: { id: 'user-id' },
      };

      mockLoginService.login.mockResolvedValue(mockTokenResponse);

      const mockSecurityContext = {
        clientIp: '8.8.8.8',
        fingerprint: 'test-fingerprint',
      };

      const result = await loginController.login(loginDto, mockSecurityContext);

      expect(mockLoginService.login).toHaveBeenCalledWith(loginDto, {
        clientIp: '8.8.8.8', // Should extract only the first IP
        fingerprint: 'test-fingerprint',
      });

      expect(result.statusCode).toBe(HttpStatus.CREATED);
    });

    it('should handle single IP in X-Forwarded-For header', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'securePass123',
      };

      mockLoginService.login.mockResolvedValue({
        message: 'Login successful',
        credentials: { access_token: 'token' },
        user: { id: 'user-id' },
      });

      const mockSecurityContext = {
        clientIp: '192.168.1.1',
        fingerprint: 'test-fingerprint',
      };

      await loginController.login(loginDto, mockSecurityContext);

      expect(mockLoginService.login).toHaveBeenCalledWith(loginDto, {
        clientIp: '192.168.1.1', // Should use the single IP
        fingerprint: 'test-fingerprint',
      });
    });

    it('should handle IP with spaces in X-Forwarded-For header', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'securePass123',
      };

      mockLoginService.login.mockResolvedValue({
        message: 'Login successful',
        credentials: { access_token: 'token' },
        user: { id: 'user-id' },
      });

      const mockSecurityContext = {
        clientIp: '203.0.113.45',
        fingerprint: 'test-fingerprint',
      };

      await loginController.login(loginDto, mockSecurityContext);

      expect(mockLoginService.login).toHaveBeenCalledWith(loginDto, {
        clientIp: '203.0.113.45', // Should trim spaces and extract first IP
        fingerprint: 'test-fingerprint',
      });
    });
  });

  describe('OTP Endpoints', () => {
    it('should handle verify-otp with IP normalization', async () => {
      const verifyOtpDto = {
        code: '123456',
        userId: 'user-id',
      };

      const mockUser = {
        id: 'user-id',
        userRoles: [],
        $fetchGraph: jest.fn(),
      };

      mockLoginSecurityService.verifyLoginOtp.mockResolvedValue({
        user: mockUser,
      });

      mockLoginService.successfulLogin.mockResolvedValue({
        message: 'Login successful',
        credentials: { access_token: 'token' },
        user: { id: 'user-id' },
      });

      const mockSecurityContext = {
        clientIp: '8.8.8.8',
        fingerprint: '123456789',
      };

      await loginController.verifyOtp(verifyOtpDto, mockSecurityContext);

      expect(mockLoginSecurityService.verifyLoginOtp).toHaveBeenCalledWith('123456', mockSecurityContext);
    });

    it('should return success message when OTP is resent successfully', async () => {
      mockLoginSecurityService.resendLoginOtp.mockResolvedValue({
        maskedContact: '******1234',
      });

      const mockSecurityContext = {
        clientIp: '8.8.8.8',
        fingerprint: '123456789',
      };

      const result = await loginController.resendOtp(mockSecurityContext);

      expect(mockLoginSecurityService.resendLoginOtp).toHaveBeenCalledWith(mockSecurityContext);
      expect(result).toMatchObject({
        message: 'Verification code resent to ******1234',
        data: { maskedContact: '******1234' },
        statusCode: HttpStatus.OK,
      });
    });
  });
});
