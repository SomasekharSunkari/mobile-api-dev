import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppLoggerService } from '../../../services/logger/logger.service';
import { RegisterDto } from './dto/register.dto';
import { RegisterCheckDto } from './dto/registerCheck.dto';
import { AccountVerificationDto } from './dto/sendVerificationCode.dto';
import { RegisterController } from './register.controller';
import { RegisterService } from './register.service';

// Create a mock version of RegisterService
const mockRegisterService = {
  register: jest.fn(),
  checkUsernameExists: jest.fn(),
  checkEmailExists: jest.fn(),
  checkPhoneNoExists: jest.fn(),
  checkRegister: jest.fn(),
  sendVerificationCode: jest.fn(),
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

describe('RegisterController', () => {
  let registerController: RegisterController;
  let registerService: RegisterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RegisterController],
      providers: [
        {
          provide: RegisterService,
          useValue: mockRegisterService,
        },
        {
          provide: AppLoggerService,
          useValue: mockAppLoggerService,
        },
      ],
    }).compile();

    registerController = module.get<RegisterController>(RegisterController);
    registerService = module.get<RegisterService>(RegisterService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(registerController).toBeDefined();
  });

  describe('register', () => {
    it('should call registerService.register and return transformed response', async () => {
      const registerDto: RegisterDto = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123',
        confirm_password: 'password123',
        first_name: 'John',
        last_name: 'Doe',
        middle_name: 'T',
        phone_number: '+1234567890',
        country_id: '1',
        verification_token: 'sdsds',
      };

      const mockUser = {
        id: 'mock-user-id',
        email: registerDto.email,
        username: registerDto.username,
      };

      const mockReq = {
        clientIp: '192.168.0.1',
        deviceInfo: {
          device_name: 'MacBook',
          device_type: 'laptop',
          os: 'macOS',
          browser: 'Chrome',
        },
        geoInfo: {
          city: 'San Diego',
          region: 'CA',
          country: 'USA',
        },
      };

      mockRegisterService.register.mockResolvedValue(mockUser);

      const mockHeaders = {
        'x-forwarded-for': '192.168.1.1',
        'x-fingerprint': 'device-fingerprint-123',
      };
      const response = await registerController.register(registerDto, mockReq as any, mockHeaders);

      expect(registerService.register).toHaveBeenCalledWith(registerDto, {
        clientIp: '192.168.1.1',
        fingerprint: 'device-fingerprint-123',
      });

      expect(response).toMatchObject({
        statusCode: HttpStatus.CREATED,
        message: 'User registered successfully',
        data: mockUser,
      });
    });

    it('should throw an error if registerService.register fails', async () => {
      const registerDto: RegisterDto = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123',
        confirm_password: 'password123',
        first_name: 'John',
        last_name: 'Doe',
        middle_name: 'T',
        phone_number: '+1234567890',
        country_id: '1',
        verification_token: 'sdsds',
      };

      const mockReq = {
        clientIp: '192.168.0.1',
        deviceInfo: {
          device_name: 'MacBook',
          device_type: 'laptop',
          os: 'macOS',
          browser: 'Chrome',
        },
        geoInfo: {
          city: 'San Diego',
          region: 'CA',
          country: 'USA',
        },
      };

      mockRegisterService.register.mockRejectedValue(new Error('Mock error'));

      const mockHeaders = {
        'x-forwarded-for': '192.168.1.1',
        'x-fingerprint': 'device-fingerprint-123',
      };
      await expect(registerController.register(registerDto, mockReq as any, mockHeaders)).rejects.toThrow('Mock error');
    });
  });

  describe('checkUsernameExists', () => {
    it('should call registerService.checkUsernameExists and return transformed response', async () => {
      const checkUsernameDto = {
        username: 'testuser',
      };

      const mockResponse = {
        exists: true,
      };

      mockRegisterService.checkUsernameExists.mockResolvedValue(mockResponse);

      const response = await registerController.checkUsernameExists(checkUsernameDto);

      expect(registerService.checkUsernameExists).toHaveBeenCalledWith(checkUsernameDto.username);

      expect(response).toMatchObject({
        statusCode: HttpStatus.CREATED,
        message: 'Username successfully checked',
        data: mockResponse,
      });
    });
  });

  describe('checkRegistration', () => {
    it('should call registerService.checkRegister and return transformed response', async () => {
      const checkEmailDto: RegisterCheckDto = {
        email: 'test@example.com',
        phone_number: '+1234567890',
        phone_number_country_code: 'US',
      };

      const mockResponse = true;

      mockRegisterService.checkRegister.mockResolvedValue(mockResponse);

      const response = await registerController.checkRegistration(checkEmailDto);

      expect(registerService.checkRegister).toHaveBeenCalledWith(checkEmailDto);

      expect(response).toMatchObject({
        statusCode: HttpStatus.CREATED,
        message: 'Registration data successfully checked',
        data: mockResponse,
      });
    });
  });

  describe('resendVerificationCode', () => {
    it('should call registerService.sendVerificationCode and return transformed response', async () => {
      const verificationDto: AccountVerificationDto = {
        email: 'test@example.com',
      };

      const mockResponse = {
        success: true,
      };

      mockRegisterService.sendVerificationCode.mockResolvedValue(mockResponse);

      const response = await registerController.resendVerificationCode(verificationDto);

      expect(registerService.sendVerificationCode).toHaveBeenCalledWith(verificationDto);

      expect(response).toMatchObject({
        statusCode: HttpStatus.OK,
        message: 'Verification Code Sent Successfully',
        data: mockResponse,
      });
    });

    it('should throw an error if registerService.sendVerificationCode fails', async () => {
      const verificationDto: AccountVerificationDto = {
        email: 'test@example.com',
      };

      mockRegisterService.sendVerificationCode.mockRejectedValue(new Error('Email service error'));

      await expect(registerController.resendVerificationCode(verificationDto)).rejects.toThrow('Email service error');
    });
  });
});
