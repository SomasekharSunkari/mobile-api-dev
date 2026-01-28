import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { DateTime } from 'luxon';
import { EnvironmentService } from '../../../config';
import { UserStatus } from '../../../database';
import { ResetTransactionPinMail } from '../../../notifications/mails/reset_transaction_pin_mail';
import { EventEmitterEventsEnum } from '../../../services/eventEmitter/eventEmitter.interface';
import { EventEmitterService } from '../../../services/eventEmitter/eventEmitter.service';
import { AppLoggerService } from '../../../services/logger/logger.service';
import { MailerService } from '../../../services/queue/processors/mailer/mailer.service';
import { UtilsService } from '../../../utils/utils.service';
import { VerificationTokenGuard } from '../guard/verificationTokenGuard/verificationToken.guard';
import { TransactionPinRepository } from '../transactionPin/transactionPin.repository';
import { TransactionPinService } from '../transactionPin/transactionPin.service';
import { UserRepository } from '../user/user.repository';
import { VerificationTokenService } from '../verificationToken/verificationToken.service';
import { ResetPinWithTokenDto } from './dtos/resetPinWithToken.dto';
import { VerifyResetPinCodeDto } from './dtos/verifyResetPinCode.dto';
import { ResetTransactionPinController } from './resetTransactionPin.controller';
import { ResetTransactionPinEvent } from './resetTransactionPin.event';
import { ResetTransactionPinModule } from './resetTransactionPin.module';
import { ResetTransactionPinRepository } from './resetTransactionPin.repository';
import { ResetTransactionPinService } from './resetTransactionPin.service';

describe('ResetTransactionPinService', () => {
  let service: ResetTransactionPinService;

  // Mock repositories and services
  const mockResetTransactionPinRepository = {
    transaction: jest.fn((callback) => callback('mockTrx')),
    create: jest.fn(),
    findOne: jest.fn(),
    findSync: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    first: jest.fn(),
  };

  const mockUserRepository = {
    findActiveByEmail: jest.fn(),
    update: jest.fn(),
  };

  const mockTransactionPinRepository = {
    updatePin: jest.fn(),
  };

  const mockMailerService = {
    send: jest.fn(),
  };

  const mockTransactionPinService = {
    resetFailedAttempts: jest.fn(),
    clearLockout: jest.fn(),
  };

  // Mock environment service
  jest.spyOn(EnvironmentService, 'getValue').mockImplementation((key) => {
    if (key === 'JWT_SECRET_TOKEN') return 'test-secret-key';
    return '';
  });

  // Mock utility functions
  jest.spyOn(UtilsService, 'generateCode').mockReturnValue('123456');
  jest.spyOn(UtilsService, 'hashPassword').mockResolvedValue('hashed-code');
  jest.spyOn(UtilsService, 'comparePassword').mockResolvedValue(true);
  jest.spyOn(UtilsService, 'isDatePassed').mockReturnValue(false);

  // Mock bcrypt
  jest.mock('bcrypt', () => ({
    genSalt: jest.fn().mockResolvedValue('mock-salt'),
    hash: jest.fn().mockResolvedValue('hashed-pin'),
  }));

  // Mock jwt
  jest.spyOn(jwt, 'sign').mockImplementation(() => 'mock-token');
  jest.spyOn(jwt, 'verify').mockImplementation(() => ({ verification_token: 'hashed-code' }));

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResetTransactionPinService,
        {
          provide: ResetTransactionPinRepository,
          useValue: mockResetTransactionPinRepository,
        },
        {
          provide: UserRepository,
          useValue: mockUserRepository,
        },
        {
          provide: TransactionPinRepository,
          useValue: mockTransactionPinRepository,
        },
        {
          provide: MailerService,
          useValue: mockMailerService,
        },
        {
          provide: TransactionPinService,
          useValue: mockTransactionPinService,
        },
      ],
    }).compile();

    service = module.get<ResetTransactionPinService>(ResetTransactionPinService);
  });

  describe('initiateResetPin', () => {
    it('should initiate PIN reset successfully', async () => {
      const email = 'test@example.com';
      const mockUser = {
        id: 'user-id',
        email,
        status: UserStatus.ACTIVE,
      };

      mockUserRepository.findActiveByEmail.mockResolvedValue(mockUser);
      mockResetTransactionPinRepository.create.mockResolvedValue({
        id: 'reset-pin-id',
        user_id: mockUser.id,
        code: 'hashed-code',
      });

      const result = await service.initiateResetPin(email);

      expect(mockUserRepository.findActiveByEmail).toHaveBeenCalledWith(email);
      expect(UtilsService.generateCode).toHaveBeenCalled();
      expect(UtilsService.hashPassword).toHaveBeenCalledWith('123456');
      expect(mockResetTransactionPinRepository.create).toHaveBeenCalledWith(
        {
          code: 'hashed-code',
          user_id: mockUser.id,
          expiration_time: expect.any(String),
        },
        'mockTrx',
      );
      expect(mockMailerService.send).toHaveBeenCalledWith(expect.any(ResetTransactionPinMail));
      expect(result).toEqual({ success: true });
    });

    it('should throw NotFoundException when user not found', async () => {
      const email = 'nonexistent@example.com';
      mockUserRepository.findActiveByEmail.mockResolvedValue(null);

      await expect(service.initiateResetPin(email)).rejects.toThrow(new NotFoundException('User Not found'));
      expect(mockResetTransactionPinRepository.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when user is deactivated', async () => {
      const email = 'deactivated@example.com';
      const mockUser = {
        id: 'user-id',
        email,
        status: UserStatus.PENDING_DEACTIVATION,
      };

      mockUserRepository.findActiveByEmail.mockResolvedValue(mockUser);

      await expect(service.initiateResetPin(email)).rejects.toThrow(
        new NotFoundException('Your account is deactivated, please contact support'),
      );
      expect(mockResetTransactionPinRepository.create).not.toHaveBeenCalled();
    });

    it('should expire existing unused codes before creating new one', async () => {
      const email = 'test@example.com';
      const mockUser = {
        id: 'user-id',
        email,
        status: UserStatus.ACTIVE,
      };
      const mockActiveCode = {
        id: 'existing-code-id',
        user_id: mockUser.id,
        code: 'old-hashed-code',
        is_used: false,
        $query: jest.fn().mockReturnValue({
          patch: jest.fn().mockResolvedValue({}),
        }),
      };

      mockUserRepository.findActiveByEmail.mockResolvedValue(mockUser);
      mockResetTransactionPinRepository.first.mockResolvedValue(mockActiveCode);
      mockResetTransactionPinRepository.create.mockResolvedValue({
        id: 'reset-pin-id',
        user_id: mockUser.id,
        code: 'hashed-code',
      });

      await service.initiateResetPin(email);

      expect(mockResetTransactionPinRepository.findSync).toHaveBeenCalledWith({ user_id: mockUser.id });
      expect(mockResetTransactionPinRepository.andWhere).toHaveBeenCalledWith(
        'expiration_time',
        '>',
        expect.any(String),
      );
      expect(mockResetTransactionPinRepository.andWhere).toHaveBeenCalledWith({ is_used: false });
      expect(mockActiveCode.$query().patch).toHaveBeenCalledWith({ expiration_time: expect.any(String) });
    });

    it('should throw InternalServerErrorException on repository error', async () => {
      const email = 'test@example.com';
      const mockUser = {
        id: 'user-id',
        email,
        status: UserStatus.ACTIVE,
      };

      mockUserRepository.findActiveByEmail.mockResolvedValue(mockUser);
      mockResetTransactionPinRepository.transaction.mockRejectedValue(new Error('Database error'));

      await expect(service.initiateResetPin(email)).rejects.toThrow(
        new InternalServerErrorException('Error while creating the code'),
      );
    });
  });

  describe('verifyCode', () => {
    it('should verify code and return reset pin token', async () => {
      const userId = 'user-id';
      const dto: VerifyResetPinCodeDto = { code: '123456' };
      const mockVerificationCode = {
        id: 'reset-pin-id',
        user_id: userId,
        code: 'hashed-code',
        is_used: false,
        expiration_time: DateTime.now().plus({ hours: 1 }).toSQL(),
      };

      mockResetTransactionPinRepository.findOne.mockResolvedValue(mockVerificationCode);

      const result = await service.verifyCode(dto, userId);

      expect(mockResetTransactionPinRepository.findOne).toHaveBeenCalledWith({ user_id: userId, is_used: false });
      expect(UtilsService.comparePassword).toHaveBeenCalledWith(dto.code, mockVerificationCode.code);
      expect(UtilsService.isDatePassed).toHaveBeenCalledWith(mockVerificationCode.expiration_time);
      expect(jwt.sign).toHaveBeenCalledWith({ verification_token: mockVerificationCode.code }, 'test-secret-key');
      expect(result).toEqual({ success: true, resetPinToken: 'mock-token' });
    });

    it('should throw NotFoundException when code not found', async () => {
      const userId = 'user-id';
      const dto: VerifyResetPinCodeDto = { code: '123456' };

      mockResetTransactionPinRepository.findOne.mockResolvedValue(null);

      await expect(service.verifyCode(dto, userId)).rejects.toThrow(new NotFoundException('Code not found'));
    });

    it('should throw NotFoundException when code is invalid', async () => {
      const userId = 'user-id';
      const dto: VerifyResetPinCodeDto = { code: '123456' };
      const mockVerificationCode = {
        id: 'reset-pin-id',
        user_id: userId,
        code: 'hashed-code',
        is_used: false,
        expiration_time: DateTime.now().plus({ hours: 1 }).toSQL(),
      };

      mockResetTransactionPinRepository.findOne.mockResolvedValue(mockVerificationCode);
      jest.spyOn(UtilsService, 'comparePassword').mockResolvedValueOnce(false);

      await expect(service.verifyCode(dto, userId)).rejects.toThrow(
        new NotFoundException('Invalid code, please try again'),
      );
    });

    it('should throw NotFoundException when code has expired', async () => {
      const userId = 'user-id';
      const dto: VerifyResetPinCodeDto = { code: '123456' };
      const mockVerificationCode = {
        id: 'reset-pin-id',
        user_id: userId,
        code: 'hashed-code',
        is_used: false,
        expiration_time: DateTime.now().minus({ hours: 1 }).toSQL(),
      };

      mockResetTransactionPinRepository.findOne.mockResolvedValue(mockVerificationCode);
      jest.spyOn(UtilsService, 'isDatePassed').mockReturnValueOnce(true);

      await expect(service.verifyCode(dto, userId)).rejects.toThrow(new NotFoundException('Code has expired'));
    });

    it('should throw NotFoundException when code has been used', async () => {
      const userId = 'user-id';
      const dto: VerifyResetPinCodeDto = { code: '123456' };
      const mockVerificationCode = {
        id: 'reset-pin-id',
        user_id: userId,
        code: 'hashed-code',
        is_used: true,
        expiration_time: DateTime.now().plus({ hours: 1 }).toSQL(),
      };

      mockResetTransactionPinRepository.findOne.mockResolvedValue(mockVerificationCode);

      await expect(service.verifyCode(dto, userId)).rejects.toThrow(
        new NotFoundException('Code has already been used'),
      );
    });
  });

  describe('resetPinWithToken', () => {
    it('should reset PIN with valid token', async () => {
      const userId = 'user-id';
      const dto: ResetPinWithTokenDto = {
        token: 'valid-token',
        pin: '123456',
        confirm_pin: '123456',
      };
      const mockVerificationCode = {
        id: 'reset-pin-id',
        user_id: userId,
        code: 'hashed-code',
        is_used: false,
        expiration_time: DateTime.now().toSQL(),
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Force bcrypt to return a specific value for this test
      const genSaltSpy = jest.spyOn(bcrypt, 'genSalt');
      genSaltSpy.mockImplementationOnce(() => Promise.resolve('mock-salt'));

      const hashSpy = jest.spyOn(bcrypt, 'hash');
      hashSpy.mockImplementationOnce(() => Promise.resolve('hashed-pin'));

      jest.spyOn(service, 'verifyResetPinToken').mockResolvedValue(mockVerificationCode as any);
      mockTransactionPinService.resetFailedAttempts.mockResolvedValue(undefined);
      mockTransactionPinService.clearLockout.mockResolvedValue(undefined);

      const result = await service.resetPinWithToken(dto, userId);

      expect(service.verifyResetPinToken).toHaveBeenCalledWith(dto.token);
      expect(mockTransactionPinRepository.updatePin).toHaveBeenCalledWith(userId, 'hashed-pin');
      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, { require_transaction_pin_reset: false });
      expect(mockTransactionPinService.resetFailedAttempts).toHaveBeenCalledWith(userId);
      expect(mockTransactionPinService.clearLockout).toHaveBeenCalledWith(userId);
      expect(result).toBe(true);
    });

    it('should throw BadRequestException when token userId does not match', async () => {
      const userId = 'user-id';
      const differentUserId = 'different-user-id';
      const dto: ResetPinWithTokenDto = {
        token: 'invalid-token',
        pin: '123456',
        confirm_pin: '123456',
      };
      const mockVerificationCode = {
        id: 'reset-pin-id',
        user_id: differentUserId,
        code: 'hashed-code',
        is_used: false,
        expiration_time: DateTime.now().toSQL(),
        created_at: new Date(),
        updated_at: new Date(),
      };

      jest.spyOn(service, 'verifyResetPinToken').mockResolvedValue(mockVerificationCode as any);

      await expect(service.resetPinWithToken(dto, userId)).rejects.toThrow(
        new BadRequestException('Invalid verification code'),
      );
      expect(mockTransactionPinRepository.updatePin).not.toHaveBeenCalled();
      expect(mockTransactionPinService.resetFailedAttempts).not.toHaveBeenCalled();
      expect(mockTransactionPinService.clearLockout).not.toHaveBeenCalled();
    });

    it('should clear security penalties when PIN is successfully reset', async () => {
      const userId = 'user-id';
      const dto: ResetPinWithTokenDto = {
        token: 'valid-token',
        pin: '654321',
        confirm_pin: '654321',
      };
      const mockVerificationCode = {
        id: 'reset-pin-id',
        user_id: userId,
        code: 'hashed-code',
        is_used: false,
        expiration_time: DateTime.now().toSQL(),
        created_at: new Date(),
        updated_at: new Date(),
      };

      const genSaltSpy = jest.spyOn(bcrypt, 'genSalt');
      genSaltSpy.mockImplementationOnce(() => Promise.resolve('mock-salt'));

      const hashSpy = jest.spyOn(bcrypt, 'hash');
      hashSpy.mockImplementationOnce(() => Promise.resolve('hashed-new-pin'));

      jest.spyOn(service, 'verifyResetPinToken').mockResolvedValue(mockVerificationCode as any);
      mockTransactionPinService.resetFailedAttempts.mockResolvedValue(undefined);
      mockTransactionPinService.clearLockout.mockResolvedValue(undefined);

      await service.resetPinWithToken(dto, userId);

      expect(mockTransactionPinService.resetFailedAttempts).toHaveBeenCalledWith(userId);
      expect(mockTransactionPinService.clearLockout).toHaveBeenCalledWith(userId);
    });

    it('should call resetFailedAttempts and clearLockout in correct order', async () => {
      const userId = 'user-id';
      const dto: ResetPinWithTokenDto = {
        token: 'valid-token',
        pin: '123456',
        confirm_pin: '123456',
      };
      const mockVerificationCode = {
        id: 'reset-pin-id',
        user_id: userId,
        code: 'hashed-code',
        is_used: false,
        expiration_time: DateTime.now().toSQL(),
        created_at: new Date(),
        updated_at: new Date(),
      };

      const genSaltSpy = jest.spyOn(bcrypt, 'genSalt');
      genSaltSpy.mockImplementationOnce(() => Promise.resolve('mock-salt'));

      const hashSpy = jest.spyOn(bcrypt, 'hash');
      hashSpy.mockImplementationOnce(() => Promise.resolve('hashed-pin'));

      jest.spyOn(service, 'verifyResetPinToken').mockResolvedValue(mockVerificationCode as any);
      mockTransactionPinService.resetFailedAttempts.mockResolvedValue(undefined);
      mockTransactionPinService.clearLockout.mockResolvedValue(undefined);

      await service.resetPinWithToken(dto, userId);

      const resetFailedAttemptsOrder = mockTransactionPinService.resetFailedAttempts.mock.invocationCallOrder[0];
      const clearLockoutOrder = mockTransactionPinService.clearLockout.mock.invocationCallOrder[0];

      expect(resetFailedAttemptsOrder).toBeLessThan(clearLockoutOrder);
    });
  });

  describe('verifyResetPinToken', () => {
    it('should verify token and return reset pin verification', async () => {
      const token = 'valid-token';
      const mockVerificationCode = {
        id: 'reset-pin-id',
        user_id: 'user-id',
        code: 'hashed-code',
        is_used: false,
      };

      mockResetTransactionPinRepository.findOne.mockResolvedValue(mockVerificationCode);

      const result = await service.verifyResetPinToken(token);

      expect(jwt.verify).toHaveBeenCalledWith(token, 'test-secret-key');
      expect(mockResetTransactionPinRepository.findOne).toHaveBeenCalledWith({ code: 'hashed-code' });
      expect(result).toEqual(mockVerificationCode);
    });

    it('should throw NotFoundException when verification not found', async () => {
      const token = 'invalid-token';

      mockResetTransactionPinRepository.findOne.mockResolvedValue(null);

      await expect(service.verifyResetPinToken(token)).rejects.toThrow(
        new NotFoundException('Account verification not found'),
      );
    });

    it('should throw NotFoundException when verification already used', async () => {
      const token = 'used-token';
      const mockVerificationCode = {
        id: 'reset-pin-id',
        user_id: 'user-id',
        code: 'hashed-code',
        is_used: true,
      };

      mockResetTransactionPinRepository.findOne.mockResolvedValue(mockVerificationCode);

      await expect(service.verifyResetPinToken(token)).rejects.toThrow(
        new NotFoundException('Account verification already used'),
      );
    });
  });

  describe('requireTransactionPinReset', () => {
    it('should set require_transaction_pin_reset to true for user', async () => {
      const userId = 'user-id';

      mockUserRepository.update.mockResolvedValue({});

      await service.requireTransactionPinReset(userId);

      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, { require_transaction_pin_reset: true });
    });

    it('should throw InternalServerErrorException on repository error', async () => {
      const userId = 'user-id';
      const errorMessage = 'Database error';

      mockUserRepository.update.mockRejectedValue(new Error(errorMessage));

      await expect(service.requireTransactionPinReset(userId)).rejects.toThrow(
        new InternalServerErrorException(errorMessage),
      );
    });
  });
});

describe('ResetTransactionPinController', () => {
  let controller: ResetTransactionPinController;
  let service: ResetTransactionPinService;

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

  const mockVerificationTokenService = {
    verifyToken: jest.fn(),
  };

  const mockReflector = {
    get: jest.fn().mockReturnValue([]),
  };

  beforeEach(async () => {
    const mockService = {
      initiateResetPin: jest.fn(),
      verifyCode: jest.fn(),
      resetPinWithToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ResetTransactionPinController],
      providers: [
        {
          provide: ResetTransactionPinService,
          useValue: mockService,
        },
        {
          provide: AppLoggerService,
          useValue: mockAppLoggerService,
        },
        {
          provide: VerificationTokenService,
          useValue: mockVerificationTokenService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    })
      .overrideGuard(VerificationTokenGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<ResetTransactionPinController>(ResetTransactionPinController);
    service = module.get<ResetTransactionPinService>(ResetTransactionPinService);
  });

  describe('initiateResetPin', () => {
    it('should call service.initiateResetPin and return success response', async () => {
      const user = { id: 'test-user-id', email: 'test@example.com' };

      jest.spyOn(service, 'initiateResetPin').mockResolvedValue({ success: true });

      const result = await controller.initiateResetPin(user as any);

      expect(service.initiateResetPin).toHaveBeenCalledWith(user.email);
      expect(result).toMatchObject({
        statusCode: 200,
        message: 'Verification code sent to email',
      });
      expect(result).toHaveProperty('timestamp');
    });
  });

  describe('verifyCode', () => {
    it('should call service.verifyCode and return success response with token', async () => {
      const user = { id: 'test-user-id', email: 'test@example.com' };
      const dto: VerifyResetPinCodeDto = { code: '123456' };
      const serviceResponse = { success: true, resetPinToken: 'valid-token' };

      jest.spyOn(service, 'verifyCode').mockResolvedValue(serviceResponse);

      const result = await controller.verifyCode(user as any, dto);

      expect(service.verifyCode).toHaveBeenCalledWith(dto, user.id);
      expect(result).toMatchObject({
        statusCode: 200,
        message: 'Code verified successfully',
        data: serviceResponse,
      });
      expect(result).toHaveProperty('timestamp');
    });
  });

  describe('resetPinWithToken', () => {
    it('should call service.resetPinWithToken and return success response', async () => {
      const user = { id: 'test-user-id', email: 'test@example.com' };
      const dto: ResetPinWithTokenDto = {
        token: 'valid-token',
        pin: '123456',
        confirm_pin: '123456',
      };

      jest.spyOn(service, 'resetPinWithToken').mockResolvedValue(true);

      const result = await controller.resetPinWithToken(user as any, dto);

      expect(service.resetPinWithToken).toHaveBeenCalledWith(dto, user.id);
      expect(result).toMatchObject({
        statusCode: 200,
        message: 'Transaction PIN changed successfully',
        data: true,
      });
      expect(result).toHaveProperty('timestamp');
    });
  });
});

describe('ResetTransactionPinEvent', () => {
  let event: ResetTransactionPinEvent;
  let service: ResetTransactionPinService;

  const mockResetTransactionPinService = {
    requireTransactionPinReset: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResetTransactionPinEvent,
        {
          provide: ResetTransactionPinService,
          useValue: mockResetTransactionPinService,
        },
      ],
    }).compile();

    event = module.get<ResetTransactionPinEvent>(ResetTransactionPinEvent);
    service = module.get<ResetTransactionPinService>(ResetTransactionPinService);
  });

  describe('handleRequireTransactionPinReset', () => {
    it('should call requireTransactionPinReset with userId', async () => {
      const userId = 'user-id';

      mockResetTransactionPinService.requireTransactionPinReset.mockResolvedValue(undefined);

      await event.handleRequireTransactionPinReset(userId);

      expect(service.requireTransactionPinReset).toHaveBeenCalledWith(userId);
    });

    it('should handle errors from service', async () => {
      const userId = 'user-id';
      const error = new InternalServerErrorException('Service error');

      mockResetTransactionPinService.requireTransactionPinReset.mockRejectedValue(error);

      await expect(event.handleRequireTransactionPinReset(userId)).rejects.toThrow(error);
    });
  });
});

describe('ResetTransactionPinModule', () => {
  let module: TestingModule;
  let resetTransactionPinModule: ResetTransactionPinModule;
  let eventEmitterService: EventEmitterService;
  let resetTransactionPinService: ResetTransactionPinService;

  const mockEventEmitterService = {
    on: jest.fn(),
    emit: jest.fn(),
    emitAsync: jest.fn(),
  };

  const mockResetTransactionPinService = {
    requireTransactionPinReset: jest.fn(),
    initiateResetPin: jest.fn(),
    verifyCode: jest.fn(),
    resetPinWithToken: jest.fn(),
    verifyResetPinToken: jest.fn(),
  };

  const mockResetTransactionPinRepository = {
    transaction: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
  };

  const mockUserRepository = {
    findActiveByEmail: jest.fn(),
    update: jest.fn(),
    findById: jest.fn(),
  };

  const mockTransactionPinRepository = {
    updatePin: jest.fn(),
  };

  const mockMailerService = {
    send: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    module = await Test.createTestingModule({
      controllers: [ResetTransactionPinController],
      providers: [
        ResetTransactionPinModule,
        ResetTransactionPinEvent,
        {
          provide: EventEmitterService,
          useValue: mockEventEmitterService,
        },
        {
          provide: ResetTransactionPinService,
          useValue: mockResetTransactionPinService,
        },
        {
          provide: ResetTransactionPinRepository,
          useValue: mockResetTransactionPinRepository,
        },
        {
          provide: UserRepository,
          useValue: mockUserRepository,
        },
        {
          provide: TransactionPinRepository,
          useValue: mockTransactionPinRepository,
        },
        {
          provide: MailerService,
          useValue: mockMailerService,
        },
        {
          provide: VerificationTokenService,
          useValue: {
            verifyToken: jest.fn(),
          },
        },
        {
          provide: AppLoggerService,
          useValue: {
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
          },
        },
      ],
    }).compile();

    resetTransactionPinModule = module.get<ResetTransactionPinModule>(ResetTransactionPinModule);
    eventEmitterService = module.get<EventEmitterService>(EventEmitterService);
    resetTransactionPinService = module.get<ResetTransactionPinService>(ResetTransactionPinService);
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('Module Initialization', () => {
    it('should be defined', () => {
      expect(resetTransactionPinModule).toBeDefined();
    });

    it('should have EventEmitterService injected', () => {
      expect(eventEmitterService).toBeDefined();
    });

    it('should have ResetTransactionPinService injected', () => {
      expect(resetTransactionPinService).toBeDefined();
    });

    it('should provide ResetTransactionPinController', () => {
      const controller = module.get<ResetTransactionPinController>(ResetTransactionPinController);
      expect(controller).toBeDefined();
    });

    it('should export ResetTransactionPinService', () => {
      const exportedService = module.get<ResetTransactionPinService>(ResetTransactionPinService);
      expect(exportedService).toBeDefined();
      expect(exportedService).toBe(resetTransactionPinService);
    });
  });

  describe('onModuleInit', () => {
    it('should register event listener for REQUIRE_TRANSACTION_PIN_RESET', () => {
      resetTransactionPinModule.onModuleInit();

      expect(mockEventEmitterService.on).toHaveBeenCalledWith(
        EventEmitterEventsEnum.REQUIRE_TRANSACTION_PIN_RESET,
        expect.any(Function),
      );
    });

    it('should call requireTransactionPinReset when event is emitted', async () => {
      const userId = 'test-user-id';
      mockResetTransactionPinService.requireTransactionPinReset.mockResolvedValue(undefined);

      resetTransactionPinModule.onModuleInit();

      const eventHandler = mockEventEmitterService.on.mock.calls[0][1];
      await eventHandler(userId);

      expect(mockResetTransactionPinService.requireTransactionPinReset).toHaveBeenCalledWith(userId);
    });

    it('should handle successful transaction pin reset requirement', async () => {
      const userId = 'user-123';
      mockResetTransactionPinService.requireTransactionPinReset.mockResolvedValue(undefined);

      resetTransactionPinModule.onModuleInit();

      const eventHandler = mockEventEmitterService.on.mock.calls[0][1];
      await expect(eventHandler(userId)).resolves.toBeUndefined();

      expect(mockResetTransactionPinService.requireTransactionPinReset).toHaveBeenCalledTimes(1);
      expect(mockResetTransactionPinService.requireTransactionPinReset).toHaveBeenCalledWith(userId);
    });

    it('should propagate errors from requireTransactionPinReset', async () => {
      const userId = 'user-456';
      const error = new InternalServerErrorException('Database connection failed');
      mockResetTransactionPinService.requireTransactionPinReset.mockRejectedValue(error);

      resetTransactionPinModule.onModuleInit();

      const eventHandler = mockEventEmitterService.on.mock.calls[0][1];
      await expect(eventHandler(userId)).rejects.toThrow(error);
    });

    it('should handle multiple event emissions', async () => {
      const userIds = ['user-1', 'user-2', 'user-3'];
      mockResetTransactionPinService.requireTransactionPinReset.mockResolvedValue(undefined);

      resetTransactionPinModule.onModuleInit();

      const eventHandler = mockEventEmitterService.on.mock.calls[0][1];

      for (const userId of userIds) {
        await eventHandler(userId);
      }

      expect(mockResetTransactionPinService.requireTransactionPinReset).toHaveBeenCalledTimes(3);
      for (let index = 0; index < userIds.length; index++) {
        expect(mockResetTransactionPinService.requireTransactionPinReset).toHaveBeenNthCalledWith(
          index + 1,
          userIds[index],
        );
      }
    });

    it('should handle null userId gracefully', async () => {
      const userId = null;
      mockResetTransactionPinService.requireTransactionPinReset.mockResolvedValue(undefined);

      resetTransactionPinModule.onModuleInit();

      const eventHandler = mockEventEmitterService.on.mock.calls[0][1];
      await eventHandler(userId);

      expect(mockResetTransactionPinService.requireTransactionPinReset).toHaveBeenCalledWith(null);
    });

    it('should handle undefined userId gracefully', async () => {
      const userId = undefined;
      mockResetTransactionPinService.requireTransactionPinReset.mockResolvedValue(undefined);

      resetTransactionPinModule.onModuleInit();

      const eventHandler = mockEventEmitterService.on.mock.calls[0][1];
      await eventHandler(userId);

      expect(mockResetTransactionPinService.requireTransactionPinReset).toHaveBeenCalledWith(undefined);
    });

    it('should handle BadRequestException from service', async () => {
      const userId = 'invalid-user';
      const error = new BadRequestException('User not found');
      mockResetTransactionPinService.requireTransactionPinReset.mockRejectedValue(error);

      resetTransactionPinModule.onModuleInit();

      const eventHandler = mockEventEmitterService.on.mock.calls[0][1];
      await expect(eventHandler(userId)).rejects.toThrow(BadRequestException);
      await expect(eventHandler(userId)).rejects.toThrow('User not found');
    });

    it('should handle NotFoundException from service', async () => {
      const userId = 'nonexistent-user';
      const error = new NotFoundException('User does not exist');
      mockResetTransactionPinService.requireTransactionPinReset.mockRejectedValue(error);

      resetTransactionPinModule.onModuleInit();

      const eventHandler = mockEventEmitterService.on.mock.calls[0][1];
      await expect(eventHandler(userId)).rejects.toThrow(NotFoundException);
      await expect(eventHandler(userId)).rejects.toThrow('User does not exist');
    });

    it('should handle generic errors from service', async () => {
      const userId = 'error-user';
      const error = new Error('Unexpected error');
      mockResetTransactionPinService.requireTransactionPinReset.mockRejectedValue(error);

      resetTransactionPinModule.onModuleInit();

      const eventHandler = mockEventEmitterService.on.mock.calls[0][1];
      await expect(eventHandler(userId)).rejects.toThrow('Unexpected error');
    });

    it('should only register event listener once', () => {
      resetTransactionPinModule.onModuleInit();
      resetTransactionPinModule.onModuleInit();

      expect(mockEventEmitterService.on).toHaveBeenCalledTimes(2);
      expect(mockEventEmitterService.on).toHaveBeenCalledWith(
        EventEmitterEventsEnum.REQUIRE_TRANSACTION_PIN_RESET,
        expect.any(Function),
      );
    });
  });

  describe('Module Providers', () => {
    it('should provide ResetTransactionPinRepository', () => {
      const repository = module.get<ResetTransactionPinRepository>(ResetTransactionPinRepository);
      expect(repository).toBeDefined();
    });

    it('should provide TransactionPinRepository', () => {
      const repository = module.get<TransactionPinRepository>(TransactionPinRepository);
      expect(repository).toBeDefined();
    });

    it('should provide UserRepository', () => {
      const repository = module.get<UserRepository>(UserRepository);
      expect(repository).toBeDefined();
    });

    it('should provide ResetTransactionPinEvent', () => {
      const event = module.get<ResetTransactionPinEvent>(ResetTransactionPinEvent);
      expect(event).toBeDefined();
    });
  });

  describe('Event Handling Edge Cases', () => {
    it('should handle concurrent event emissions', async () => {
      const userIds = ['concurrent-1', 'concurrent-2', 'concurrent-3'];
      mockResetTransactionPinService.requireTransactionPinReset.mockResolvedValue(undefined);

      resetTransactionPinModule.onModuleInit();

      const eventHandler = mockEventEmitterService.on.mock.calls[0][1];

      const promises = userIds.map((userId) => eventHandler(userId));
      await Promise.all(promises);

      expect(mockResetTransactionPinService.requireTransactionPinReset).toHaveBeenCalledTimes(3);
    });

    it('should not affect other event emissions if one fails', async () => {
      mockResetTransactionPinService.requireTransactionPinReset
        .mockRejectedValueOnce(new Error('First call failed'))
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      resetTransactionPinModule.onModuleInit();

      const eventHandler = mockEventEmitterService.on.mock.calls[0][1];

      await expect(eventHandler('user-1')).rejects.toThrow('First call failed');
      await expect(eventHandler('user-2')).resolves.toBeUndefined();
      await expect(eventHandler('user-3')).resolves.toBeUndefined();

      expect(mockResetTransactionPinService.requireTransactionPinReset).toHaveBeenCalledTimes(3);
    });

    it('should handle empty string userId', async () => {
      const userId = '';
      mockResetTransactionPinService.requireTransactionPinReset.mockResolvedValue(undefined);

      resetTransactionPinModule.onModuleInit();

      const eventHandler = mockEventEmitterService.on.mock.calls[0][1];
      await eventHandler(userId);

      expect(mockResetTransactionPinService.requireTransactionPinReset).toHaveBeenCalledWith('');
    });

    it('should handle very long userId string', async () => {
      const userId = 'a'.repeat(1000);
      mockResetTransactionPinService.requireTransactionPinReset.mockResolvedValue(undefined);

      resetTransactionPinModule.onModuleInit();

      const eventHandler = mockEventEmitterService.on.mock.calls[0][1];
      await eventHandler(userId);

      expect(mockResetTransactionPinService.requireTransactionPinReset).toHaveBeenCalledWith(userId);
    });

    it('should handle special characters in userId', async () => {
      const userId = 'user@#$%^&*()_+-={}[]|:;"<>?,./';
      mockResetTransactionPinService.requireTransactionPinReset.mockResolvedValue(undefined);

      resetTransactionPinModule.onModuleInit();

      const eventHandler = mockEventEmitterService.on.mock.calls[0][1];
      await eventHandler(userId);

      expect(mockResetTransactionPinService.requireTransactionPinReset).toHaveBeenCalledWith(userId);
    });
  });
});
