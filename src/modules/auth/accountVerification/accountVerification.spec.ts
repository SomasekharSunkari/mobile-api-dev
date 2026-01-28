import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import { DateTime } from 'luxon';
import { EnvironmentService } from '../../../config';
import { AppLoggerService } from '../../../services/logger/logger.service';
import { UtilsService } from '../../../utils/utils.service';
import { UserRepository } from '../user/user.repository';
import { AccountVerificationController } from './accountVerification.controller';
import { AccountVerificationRepository } from './accountVerification.repository';
import { AccountVerificationService } from './accountVerification.service';

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'jwt-token'),
  verify: jest.fn(() => ({ verification_token: 'hashed-123456' })),
}));

describe('AccountVerificationService', () => {
  let service: AccountVerificationService;

  const mockUserRepository = {
    findActiveByEmail: jest.fn(),
  };
  const mockAccountVerificationRepository = {
    create: jest.fn(),
    findOne: jest.fn(),
    findSync: jest.fn(),
    update: jest.fn(),
    query: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(UtilsService, 'generateCode').mockReturnValue('123456');
    jest.spyOn(UtilsService, 'hashPassword').mockResolvedValue('hashed-123456');
    jest.spyOn(UtilsService, 'comparePassword').mockResolvedValue(true);
    jest.spyOn(UtilsService, 'isDatePassed').mockReturnValue(false);
    jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('jwt-secret');
    // Mock DateTime.now to always return a fixed date
    jest.spyOn(DateTime, 'now').mockReturnValue(DateTime.fromISO('2025-05-27T00:00:00Z') as DateTime);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountVerificationService,
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: AccountVerificationRepository, useValue: mockAccountVerificationRepository },
      ],
    }).compile();

    service = module.get<AccountVerificationService>(AccountVerificationService);
  });

  describe('create', () => {
    it('should create an account verification record', async () => {
      mockAccountVerificationRepository.create.mockResolvedValue({});
      const data = {
        code: 'hashed-123456',
        email: 'test@example.com',
        expiration_time: '2025-05-27T07:00:00Z',
      };

      await service.create(data);

      expect(mockAccountVerificationRepository.create).toHaveBeenCalledWith({
        code: 'hashed-123456',
        email: 'test@example.com',
        expiration_time: '2025-05-27T07:00:00Z',
      });
    });
  });

  describe('verifyAccount', () => {
    it('should verify account and return registration token', async () => {
      const mockVerificationCode = { code: 'hashed-123456' };
      mockAccountVerificationRepository.query.mockReturnValue({
        whereILike: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockVerificationCode),
      });
      jest.spyOn(UtilsService, 'comparePassword').mockResolvedValue(true);
      const data = { email: 'test@example.com', code: '123456' };
      const result = await service.verifyAccount(data as any);
      expect(mockAccountVerificationRepository.query).toHaveBeenCalled();
      expect(result).toEqual({ success: true, registrationToken: 'jwt-token' });
    });

    it('should throw InternalServerErrorException if JWT signing fails', async () => {
      const mockVerificationCode = { code: 'hashed-123456' };
      mockAccountVerificationRepository.query.mockReturnValue({
        whereILike: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockVerificationCode),
      });
      jest.spyOn(UtilsService, 'comparePassword').mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockImplementationOnce(() => {
        throw new Error('JWT signing error');
      });
      const data = { email: 'test@example.com', code: '123456' };
      await expect(service.verifyAccount(data as any)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('verifyRegistrationToken', () => {
    it('should return account verification if valid and unused', async () => {
      mockAccountVerificationRepository.findOne.mockResolvedValue({ is_used: false });
      const result = await service.verifyRegistrationToken('jwt-token');
      expect(mockAccountVerificationRepository.findOne).toHaveBeenCalledWith({ code: 'hashed-123456' });
      expect(result).toEqual({ is_used: false });
    });

    it('should throw NotFoundException if account verification not found', async () => {
      mockAccountVerificationRepository.findOne.mockResolvedValue(undefined);
      await expect(service.verifyRegistrationToken('jwt-token')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if account verification already used', async () => {
      mockAccountVerificationRepository.findOne.mockResolvedValue({ is_used: true });
      await expect(service.verifyRegistrationToken('jwt-token')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when JWT verification fails', async () => {
      (jwt.verify as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });
      await expect(service.verifyRegistrationToken('invalid-jwt-token')).rejects.toThrow(BadRequestException);
    });
  });

  describe('markAccountVerificationAsUsed', () => {
    it('should call update on the repository', async () => {
      mockAccountVerificationRepository.update.mockResolvedValue({});
      const result = await service.markAccountVerificationAsUsed('user-1', 'verif-1');
      expect(mockAccountVerificationRepository.update).toHaveBeenCalledWith(
        { id: 'verif-1' },
        { is_used: true, user_id: 'user-1' },
        { trx: undefined },
      );
      expect(result).toEqual({});
    });

    it('should call update on the repository with transaction', async () => {
      const mockTrx = { commit: jest.fn(), rollback: jest.fn() };
      mockAccountVerificationRepository.update.mockResolvedValue({});
      const result = await service.markAccountVerificationAsUsed('user-1', 'verif-1', mockTrx);
      expect(mockAccountVerificationRepository.update).toHaveBeenCalledWith(
        { id: 'verif-1' },
        { is_used: true, user_id: 'user-1' },
        { trx: mockTrx },
      );
      expect(result).toEqual({});
    });
  });

  describe('findOrThrowIfCodeIsInvalid (via verifyAccount)', () => {
    it('should throw NotFoundException when account verification code not found', async () => {
      mockAccountVerificationRepository.query.mockReturnValue({
        whereILike: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null),
      });
      const data = { email: 'test@example.com', code: '123456' };
      await expect(service.verifyAccount(data as any)).rejects.toThrow(
        new NotFoundException('Invalid verification code. Please check the code and try again.'),
      );
    });

    it('should throw NotFoundException when code does not match', async () => {
      mockAccountVerificationRepository.query.mockReturnValue({
        whereILike: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          code: 'hashed-123456',
          email: 'test@example.com',
          expiration_time: '2025-05-28T07:00:00Z',
          is_used: false,
        }),
      });
      jest.spyOn(UtilsService, 'comparePassword').mockResolvedValue(false);
      const data = { email: 'test@example.com', code: 'wrong-code' };
      await expect(service.verifyAccount(data as any)).rejects.toThrow(
        new NotFoundException('Invalid code, please try again'),
      );
    });

    it('should throw NotFoundException when no valid non-expired code exists', async () => {
      // When expiration_time filter excludes all codes, query returns null
      mockAccountVerificationRepository.query.mockReturnValue({
        whereILike: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null),
      });
      const data = { email: 'test@example.com', code: '123456' };
      await expect(service.verifyAccount(data as any)).rejects.toThrow(
        new NotFoundException('Invalid verification code. Please check the code and try again.'),
      );
    });

    it('should return account verification code when validation passes', async () => {
      const mockVerificationCode = {
        code: 'hashed-123456',
        email: 'test@example.com',
        expiration_time: '2025-05-28T07:00:00Z',
        is_used: false,
      };
      mockAccountVerificationRepository.query.mockReturnValue({
        whereILike: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockVerificationCode),
      });
      jest.spyOn(UtilsService, 'comparePassword').mockResolvedValue(true);
      const data = { email: 'test@example.com', code: '123456' };
      const result = await service.verifyAccount(data as any);
      expect(result).toEqual({ success: true, registrationToken: 'jwt-token' });
    });

    it('should get the most recent verification code ordered by created_at desc', async () => {
      const mockVerificationCode = {
        code: 'hashed-123456',
        email: 'test@example.com',
        expiration_time: '2025-05-28T07:00:00Z',
        is_used: false,
      };
      const orderByMock = jest.fn().mockReturnThis();
      mockAccountVerificationRepository.query.mockReturnValue({
        whereILike: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: orderByMock,
        first: jest.fn().mockResolvedValue(mockVerificationCode),
      });
      jest.spyOn(UtilsService, 'comparePassword').mockResolvedValue(true);
      const data = { email: 'test@example.com', code: '123456' };
      await service.verifyAccount(data as any);
      expect(orderByMock).toHaveBeenCalledWith('created_at', 'desc');
    });
  });

  describe('expireUnusedCode', () => {
    it('should expire all unused codes for given email', async () => {
      const patchMock = jest.fn().mockResolvedValue(2);
      const mockBuilder = {
        whereILike: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
      };

      mockAccountVerificationRepository.query.mockReturnValue({
        where: jest.fn().mockImplementation((callback) => {
          callback(mockBuilder);
          return {
            andWhere: jest.fn().mockReturnThis(),
            patch: patchMock,
          };
        }),
      });

      await service.expireUnusedCode('test@example.com');

      expect(mockAccountVerificationRepository.query).toHaveBeenCalled();
      expect(mockBuilder.whereILike).toHaveBeenCalledWith('email', 'test@example.com');
      expect(mockBuilder.orWhere).toHaveBeenCalledWith({ user_id: 'test@example.com' });
      expect(patchMock).toHaveBeenCalledWith(expect.objectContaining({ expiration_time: expect.any(String) }));
    });

    it('should expire all unused codes for given user_id', async () => {
      const patchMock = jest.fn().mockResolvedValue(1);
      const mockBuilder = {
        whereILike: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
      };

      mockAccountVerificationRepository.query.mockReturnValue({
        where: jest.fn().mockImplementation((callback) => {
          callback(mockBuilder);
          return {
            andWhere: jest.fn().mockReturnThis(),
            patch: patchMock,
          };
        }),
      });

      await service.expireUnusedCode('user-id-123');

      expect(mockBuilder.whereILike).toHaveBeenCalledWith('email', 'user-id-123');
      expect(mockBuilder.orWhere).toHaveBeenCalledWith({ user_id: 'user-id-123' });
      expect(patchMock).toHaveBeenCalled();
    });

    it('should handle case when no codes exist to expire', async () => {
      const patchMock = jest.fn().mockResolvedValue(0);
      const mockBuilder = {
        whereILike: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
      };

      mockAccountVerificationRepository.query.mockReturnValue({
        where: jest.fn().mockImplementation((callback) => {
          callback(mockBuilder);
          return {
            andWhere: jest.fn().mockReturnThis(),
            patch: patchMock,
          };
        }),
      });

      await service.expireUnusedCode('nonexistent@example.com');

      expect(mockAccountVerificationRepository.query).toHaveBeenCalled();
      expect(patchMock).toHaveBeenCalled();
    });
  });
});

// Mock AccountVerificationService
const mockAccountVerificationService = {
  verifyAccount: jest.fn(),
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

describe('AccountVerificationController', () => {
  let controller: AccountVerificationController;
  let service: AccountVerificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountVerificationController],
      providers: [
        {
          provide: AccountVerificationService,
          useValue: mockAccountVerificationService,
        },
        {
          provide: AppLoggerService,
          useValue: mockAppLoggerService,
        },
      ],
    }).compile();

    controller = module.get<AccountVerificationController>(AccountVerificationController);
    service = module.get<AccountVerificationService>(AccountVerificationService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('verifyAccount', () => {
    it('should call AccountVerificationService.verifyAccount and return success response', async () => {
      const dto = { email: 'test@example.com', code: '343243' };
      mockAccountVerificationService.verifyAccount.mockResolvedValue({
        success: true,
        registrationToken: 'jwt-token',
      });

      const result = await controller.verifyAccount(dto);

      expect(service.verifyAccount).toHaveBeenCalledWith(dto);
      expect(result).toMatchObject({
        statusCode: 200,
        message: 'Account Verified Successfully',
        data: {
          success: true,
          registrationToken: 'jwt-token',
        },
      });
    });
  });
});
