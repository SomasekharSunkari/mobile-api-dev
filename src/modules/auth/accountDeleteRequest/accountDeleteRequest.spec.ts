import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DateTime } from 'luxon';
import { UserModel, UserStatus } from '../../../database';
import { AccountDeleteRequestCancelledMail } from '../../../notifications/mails/account_delete_request_cancelled_mail';
import { DeleteAccountRequestMail } from '../../../notifications/mails/delete_acccont_request.mail';
import { AppLoggerService } from '../../../services/logger/logger.service';
import { MailerService } from '../../../services/queue/processors/mailer/mailer.service';
import { AccessTokenService } from '../accessToken/accessToken.service';
import { AccountActionCodeService } from '../accountActionCode/accountActionCode.service';
import { LoginDeviceRepository } from '../loginDevice/loginDevice.repository';
import { LoginEventRepository } from '../loginEvent';
import { RefreshTokenService } from '../refreshToken/refreshToken.service';
import { UserRepository } from '../user/user.repository';
import { AccountDeleteRequestController } from './accountDeleteRequest.controller';
import { AccountDeleteRequestModule } from './accountDeleteRequest.module';
import { AccountDeleteRequestRepository } from './accountDeleteRequest.repository';
import { AccountDeleteRequestService } from './accountDeleteRequest.service';
import { AccountDeleteRequestDto } from './dtos/accountDeleteRequest.dto';
import { VerifyAccountDeleteRequestDto } from './dtos/verifyAccountDeleteRequest.dto';

const mockUser: Partial<UserModel> = {
  id: 'user-123',
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
  status: UserStatus.ACTIVE,
};

const mockDeleteRequest = {
  id: 'delete-request-123',
  user_id: 'user-123',
  reasons: ['Not using the app', 'Privacy concerns'],
  deleted_on: DateTime.now().plus({ days: 30 }).toSQL(),
  created_at: new Date(),
  updated_at: new Date(),
};

describe('AccountDeleteRequestService', () => {
  let service: AccountDeleteRequestService;

  const mockUserRepository = {
    update: jest.fn(),
    findOne: jest.fn(),
  };

  const mockAccountDeleteRequestRepository = {
    create: jest.fn(),
    findOne: jest.fn(),
    hardDelete: jest.fn(),
    delete: jest.fn(),
    transaction: jest.fn((callback) => callback()),
  };

  const mockAccessTokenService = {
    delete: jest.fn(),
  };

  const mockRefreshTokenService = {
    delete: jest.fn(),
  };

  const mockLoginDeviceRepository = {
    query: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      delete: jest.fn().mockResolvedValue(true),
    })),
  };

  const mockLoginEventRepository = {
    query: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      delete: jest.fn().mockResolvedValue(true),
    })),
  };

  const mockMailerService = {
    send: jest.fn(),
  };

  const mockAccountActionCodeService = {
    createAccountActionCode: jest.fn(),
    verifyAccountActionCode: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountDeleteRequestService,
        {
          provide: UserRepository,
          useValue: mockUserRepository,
        },
        {
          provide: AccountDeleteRequestRepository,
          useValue: mockAccountDeleteRequestRepository,
        },
        {
          provide: AccessTokenService,
          useValue: mockAccessTokenService,
        },
        {
          provide: RefreshTokenService,
          useValue: mockRefreshTokenService,
        },
        {
          provide: LoginDeviceRepository,
          useValue: mockLoginDeviceRepository,
        },
        {
          provide: LoginEventRepository,
          useValue: mockLoginEventRepository,
        },
        {
          provide: MailerService,
          useValue: mockMailerService,
        },
        {
          provide: AccountActionCodeService,
          useValue: mockAccountActionCodeService,
        },
      ],
    }).compile();

    service = module.get<AccountDeleteRequestService>(AccountDeleteRequestService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendAccountDeleteRequestMail', () => {
    it('should send account delete request mail successfully', async () => {
      mockAccountActionCodeService.createAccountActionCode.mockResolvedValue(true);

      const result = await service.sendAccountDeleteRequestMail(mockUser as UserModel);

      expect(mockAccountActionCodeService.createAccountActionCode).toHaveBeenCalledWith(mockUser, 'delete');
      expect(result).toBe(true);
    });

    it('should throw InternalServerErrorException on error', async () => {
      mockAccountActionCodeService.createAccountActionCode.mockRejectedValue(new Error('Failed to create code'));

      await expect(service.sendAccountDeleteRequestMail(mockUser as UserModel)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should handle error without message', async () => {
      mockAccountActionCodeService.createAccountActionCode.mockRejectedValue(new Error());

      await expect(service.sendAccountDeleteRequestMail(mockUser as UserModel)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('verifyAccountDeleteRequestCode', () => {
    it('should verify account delete request code successfully', async () => {
      const dto: VerifyAccountDeleteRequestDto = {
        code: '123456',
      };

      mockAccountActionCodeService.verifyAccountActionCode.mockResolvedValue(true);

      const result = await service.verifyAccountDeleteRequestCode(mockUser as UserModel, dto);

      expect(mockAccountActionCodeService.verifyAccountActionCode).toHaveBeenCalledWith(dto.code, mockUser);
      expect(result).toBe(true);
    });

    it('should throw InternalServerErrorException for invalid code', async () => {
      const dto: VerifyAccountDeleteRequestDto = {
        code: 'invalid-code',
      };

      mockAccountActionCodeService.verifyAccountActionCode.mockResolvedValue(false);

      await expect(service.verifyAccountDeleteRequestCode(mockUser as UserModel, dto)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(mockAccountActionCodeService.verifyAccountActionCode).toHaveBeenCalledWith(dto.code, mockUser);
    });

    it('should throw InternalServerErrorException on error', async () => {
      const dto: VerifyAccountDeleteRequestDto = {
        code: '123456',
      };

      mockAccountActionCodeService.verifyAccountActionCode.mockRejectedValue(new Error('Verification failed'));

      await expect(service.verifyAccountDeleteRequestCode(mockUser as UserModel, dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should handle error without message', async () => {
      const dto: VerifyAccountDeleteRequestDto = {
        code: '123456',
      };

      mockAccountActionCodeService.verifyAccountActionCode.mockRejectedValue(new Error());

      await expect(service.verifyAccountDeleteRequestCode(mockUser as UserModel, dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('createDeleteRequest', () => {
    it('should create a delete request successfully', async () => {
      const dto: AccountDeleteRequestDto = {
        reasons: ['Not using the app', 'Privacy concerns'],
      };

      mockAccountDeleteRequestRepository.findOne.mockResolvedValue(null);
      mockAccountDeleteRequestRepository.create.mockResolvedValue(mockDeleteRequest);
      mockUserRepository.update.mockResolvedValue({ id: mockUser.id });
      mockRefreshTokenService.delete.mockResolvedValue(1);
      mockAccessTokenService.delete.mockResolvedValue(true);

      const result = await service.createDeleteRequest(mockUser as UserModel, dto);

      expect(mockAccountDeleteRequestRepository.findOne).toHaveBeenCalledWith({ user_id: mockUser.id });
      expect(mockAccountDeleteRequestRepository.create).toHaveBeenCalledWith(
        {
          reasons: dto.reasons,
          user_id: mockUser.id,
          deleted_on: expect.any(String),
        },
        undefined,
      );
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        { id: mockUser.id },
        { status: UserStatus.PENDING_ACCOUNT_DELETION },
        { trx: undefined },
      );
      expect(mockRefreshTokenService.delete).toHaveBeenCalledWith(mockUser.id);
      expect(mockAccessTokenService.delete).toHaveBeenCalledWith(mockUser.id);
      expect(mockMailerService.send).toHaveBeenCalledWith(expect.any(DeleteAccountRequestMail));
      expect(result).toEqual(mockDeleteRequest);
    });

    it('should throw NotFoundException if delete request already exists', async () => {
      const dto: AccountDeleteRequestDto = {
        reasons: ['Not using the app'],
      };

      mockAccountDeleteRequestRepository.findOne.mockResolvedValue({
        ...mockDeleteRequest,
        deleted_on: DateTime.now().plus({ days: 15 }).toSQL(),
      });

      await expect(service.createDeleteRequest(mockUser as UserModel, dto)).rejects.toThrow(NotFoundException);
      expect(mockAccountDeleteRequestRepository.create).not.toHaveBeenCalled();
      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });

    it('should delete expired delete request and throw NotFoundException', async () => {
      const dto: AccountDeleteRequestDto = {
        reasons: ['Not using the app'],
      };

      const expiredRequest = {
        ...mockDeleteRequest,
        deleted_on: DateTime.now().minus({ days: 1 }).toSQL(),
      };

      mockAccountDeleteRequestRepository.findOne.mockResolvedValue(expiredRequest);
      mockAccountDeleteRequestRepository.hardDelete.mockResolvedValue(true);

      await expect(service.createDeleteRequest(mockUser as UserModel, dto)).rejects.toThrow(NotFoundException);
      expect(mockAccountDeleteRequestRepository.hardDelete).toHaveBeenCalledWith(expiredRequest.id);
      expect(mockAccountDeleteRequestRepository.create).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException on error', async () => {
      const dto: AccountDeleteRequestDto = {
        reasons: ['Not using the app'],
      };

      mockAccountDeleteRequestRepository.findOne.mockResolvedValue(null);
      mockAccountDeleteRequestRepository.create.mockRejectedValue(new Error('Database error'));

      await expect(service.createDeleteRequest(mockUser as UserModel, dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should handle transaction with proper trx object', async () => {
      const dto: AccountDeleteRequestDto = {
        reasons: ['Not using the app', 'Privacy concerns'],
      };

      const mockTrx = {};
      mockAccountDeleteRequestRepository.findOne.mockResolvedValue(null);
      mockAccountDeleteRequestRepository.transaction.mockImplementation(async (callback) => {
        return await callback(mockTrx);
      });
      mockAccountDeleteRequestRepository.create.mockResolvedValue(mockDeleteRequest);
      mockUserRepository.update.mockResolvedValue({ id: mockUser.id });
      mockRefreshTokenService.delete.mockResolvedValue(1);
      mockAccessTokenService.delete.mockResolvedValue(true);

      const result = await service.createDeleteRequest(mockUser as UserModel, dto);

      expect(mockAccountDeleteRequestRepository.create).toHaveBeenCalledWith(
        {
          reasons: dto.reasons,
          user_id: mockUser.id,
          deleted_on: expect.any(String),
        },
        mockTrx,
      );
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        { id: mockUser.id },
        { status: UserStatus.PENDING_ACCOUNT_DELETION },
        { trx: mockTrx },
      );
      expect(mockRefreshTokenService.delete).toHaveBeenCalledWith(mockUser.id);
      expect(mockAccessTokenService.delete).toHaveBeenCalledWith(mockUser.id);
      expect(mockLoginDeviceRepository.query).toHaveBeenCalledWith(mockTrx);
      expect(mockLoginEventRepository.query).toHaveBeenCalledWith(mockTrx);
      expect(result).toEqual(mockDeleteRequest);
    });

    it('should handle error in user update within transaction', async () => {
      const dto: AccountDeleteRequestDto = {
        reasons: ['Not using the app'],
      };

      mockAccountDeleteRequestRepository.findOne.mockResolvedValue(null);
      mockAccountDeleteRequestRepository.transaction.mockImplementation(async (callback) => {
        return await callback();
      });
      mockAccountDeleteRequestRepository.create.mockResolvedValue(mockDeleteRequest);
      mockUserRepository.update.mockRejectedValue(new Error('Update failed'));

      await expect(service.createDeleteRequest(mockUser as UserModel, dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should handle error in refresh token deletion', async () => {
      const dto: AccountDeleteRequestDto = {
        reasons: ['Not using the app'],
      };

      mockAccountDeleteRequestRepository.findOne.mockResolvedValue(null);
      mockAccountDeleteRequestRepository.transaction.mockImplementation(async (callback) => {
        return await callback();
      });
      mockAccountDeleteRequestRepository.create.mockResolvedValue(mockDeleteRequest);
      mockUserRepository.update.mockResolvedValue({ id: mockUser.id });
      mockRefreshTokenService.delete.mockRejectedValue(new Error('Delete failed'));

      await expect(service.createDeleteRequest(mockUser as UserModel, dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should handle error in access token deletion', async () => {
      const dto: AccountDeleteRequestDto = {
        reasons: ['Not using the app'],
      };

      mockAccountDeleteRequestRepository.findOne.mockResolvedValue(null);
      mockAccountDeleteRequestRepository.transaction.mockImplementation(async (callback) => {
        return await callback();
      });
      mockAccountDeleteRequestRepository.create.mockResolvedValue(mockDeleteRequest);
      mockUserRepository.update.mockResolvedValue({ id: mockUser.id });
      mockRefreshTokenService.delete.mockResolvedValue(1);
      mockAccessTokenService.delete.mockRejectedValue(new Error('Delete failed'));

      await expect(service.createDeleteRequest(mockUser as UserModel, dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should handle error in login device deletion', async () => {
      const dto: AccountDeleteRequestDto = {
        reasons: ['Not using the app'],
      };

      mockAccountDeleteRequestRepository.findOne.mockResolvedValue(null);
      mockAccountDeleteRequestRepository.transaction.mockImplementation(async (callback) => {
        return await callback();
      });
      mockAccountDeleteRequestRepository.create.mockResolvedValue(mockDeleteRequest);
      mockUserRepository.update.mockResolvedValue({ id: mockUser.id });
      mockRefreshTokenService.delete.mockResolvedValue(1);
      mockAccessTokenService.delete.mockResolvedValue(true);
      mockLoginDeviceRepository.query.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        delete: jest.fn().mockRejectedValue(new Error('Delete failed')),
      });

      await expect(service.createDeleteRequest(mockUser as UserModel, dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should handle error in login event deletion', async () => {
      const dto: AccountDeleteRequestDto = {
        reasons: ['Not using the app'],
      };

      mockAccountDeleteRequestRepository.findOne.mockResolvedValue(null);
      mockAccountDeleteRequestRepository.transaction.mockImplementation(async (callback) => {
        return await callback();
      });
      mockAccountDeleteRequestRepository.create.mockResolvedValue(mockDeleteRequest);
      mockUserRepository.update.mockResolvedValue({ id: mockUser.id });
      mockRefreshTokenService.delete.mockResolvedValue(1);
      mockAccessTokenService.delete.mockResolvedValue(true);
      mockLoginDeviceRepository.query.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        delete: jest.fn().mockResolvedValue(true),
      });
      mockLoginEventRepository.query.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        delete: jest.fn().mockRejectedValue(new Error('Delete failed')),
      });

      await expect(service.createDeleteRequest(mockUser as UserModel, dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should handle error during findOne check', async () => {
      const dto: AccountDeleteRequestDto = {
        reasons: ['Not using the app'],
      };

      mockAccountDeleteRequestRepository.findOne.mockRejectedValue(new Error('Database error'));

      await expect(service.createDeleteRequest(mockUser as UserModel, dto)).rejects.toThrow(Error);
    });

    it('should handle case where deleted_on is exactly equal to now', async () => {
      const dto: AccountDeleteRequestDto = {
        reasons: ['Not using the app'],
      };

      const now = DateTime.now();
      const exactTimeRequest = {
        ...mockDeleteRequest,
        deleted_on: now.toSQL(),
      };

      mockAccountDeleteRequestRepository.findOne.mockResolvedValue(exactTimeRequest);
      mockAccountDeleteRequestRepository.hardDelete.mockResolvedValue(true);

      await expect(service.createDeleteRequest(mockUser as UserModel, dto)).rejects.toThrow(NotFoundException);
      expect(mockAccountDeleteRequestRepository.hardDelete).toHaveBeenCalledWith(exactTimeRequest.id);
    });
  });

  describe('getActiveDeleteRequest', () => {
    it('should return active delete request when user has delete request record', async () => {
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, status: UserStatus.PENDING_ACCOUNT_DELETION });
      mockAccountDeleteRequestRepository.findOne.mockResolvedValue(mockDeleteRequest);

      const result = await service.getActiveDeleteRequest(mockUser.id);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ id: mockUser.id });
      expect(mockAccountDeleteRequestRepository.findOne).toHaveBeenCalledWith({ user_id: mockUser.id });
      expect(result).toEqual({
        hasActiveRequest: true,
        deleteRequest: {
          id: mockDeleteRequest.id,
          reasons: mockDeleteRequest.reasons,
          deleted_on: mockDeleteRequest.deleted_on,
          created_at: mockDeleteRequest.created_at,
        },
        userStatus: UserStatus.PENDING_ACCOUNT_DELETION,
        hasPendingDeletionStatus: true,
      });
    });

    it('should return active request when user has PENDING_ACCOUNT_DELETION status but no delete request record', async () => {
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, status: UserStatus.PENDING_ACCOUNT_DELETION });
      mockAccountDeleteRequestRepository.findOne.mockResolvedValue(null);

      const result = await service.getActiveDeleteRequest(mockUser.id);

      expect(result).toEqual({
        hasActiveRequest: true,
        deleteRequest: null,
        userStatus: UserStatus.PENDING_ACCOUNT_DELETION,
        hasPendingDeletionStatus: true,
      });
    });

    it('should return active request when user has delete request record but not PENDING_ACCOUNT_DELETION status', async () => {
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, status: UserStatus.ACTIVE });
      mockAccountDeleteRequestRepository.findOne.mockResolvedValue(mockDeleteRequest);

      const result = await service.getActiveDeleteRequest(mockUser.id);

      expect(result).toEqual({
        hasActiveRequest: true,
        deleteRequest: {
          id: mockDeleteRequest.id,
          reasons: mockDeleteRequest.reasons,
          deleted_on: mockDeleteRequest.deleted_on,
          created_at: mockDeleteRequest.created_at,
        },
        userStatus: UserStatus.ACTIVE,
        hasPendingDeletionStatus: false,
      });
    });

    it('should return no active request when user has no delete request and ACTIVE status', async () => {
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, status: UserStatus.ACTIVE });
      mockAccountDeleteRequestRepository.findOne.mockResolvedValue(null);

      const result = await service.getActiveDeleteRequest(mockUser.id);

      expect(result).toEqual({
        hasActiveRequest: false,
        deleteRequest: null,
        userStatus: UserStatus.ACTIVE,
        hasPendingDeletionStatus: false,
      });
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockAccountDeleteRequestRepository.findOne.mockResolvedValue(null);

      await expect(service.getActiveDeleteRequest('non-existent-user-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancelDeleteRequest', () => {
    it('should cancel delete request successfully when both record and status exist', async () => {
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, status: UserStatus.PENDING_ACCOUNT_DELETION });
      mockAccountDeleteRequestRepository.findOne.mockResolvedValue(mockDeleteRequest);
      mockAccountDeleteRequestRepository.delete.mockResolvedValue(1);
      mockUserRepository.update.mockResolvedValue({ ...mockUser, status: UserStatus.ACTIVE });
      mockMailerService.send.mockResolvedValue(true);

      const result = await service.cancelDeleteRequest(mockUser.id);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ id: mockUser.id });
      expect(mockAccountDeleteRequestRepository.findOne).toHaveBeenCalledWith({ user_id: mockUser.id });
      expect(mockAccountDeleteRequestRepository.delete).toHaveBeenCalledWith(mockDeleteRequest.id, undefined);
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        { id: mockUser.id },
        { status: UserStatus.ACTIVE },
        { trx: undefined },
      );
      expect(mockMailerService.send).toHaveBeenCalledWith(expect.any(AccountDeleteRequestCancelledMail));
      expect(result).toEqual({
        success: true,
        message: 'Account deletion request has been cancelled successfully',
      });
    });

    it('should cancel delete request when only status exists (no delete request record)', async () => {
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, status: UserStatus.PENDING_ACCOUNT_DELETION });
      mockAccountDeleteRequestRepository.findOne.mockResolvedValue(null);
      mockUserRepository.update.mockResolvedValue({ ...mockUser, status: UserStatus.ACTIVE });
      mockMailerService.send.mockResolvedValue(true);

      const result = await service.cancelDeleteRequest(mockUser.id);

      expect(mockAccountDeleteRequestRepository.delete).not.toHaveBeenCalled();
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        { id: mockUser.id },
        { status: UserStatus.ACTIVE },
        { trx: undefined },
      );
      expect(mockMailerService.send).toHaveBeenCalledWith(expect.any(AccountDeleteRequestCancelledMail));
      expect(result).toEqual({
        success: true,
        message: 'Account deletion request has been cancelled successfully',
      });
    });

    it('should cancel delete request when only record exists (status not PENDING_ACCOUNT_DELETION)', async () => {
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, status: UserStatus.ACTIVE });
      mockAccountDeleteRequestRepository.findOne.mockResolvedValue(mockDeleteRequest);
      mockAccountDeleteRequestRepository.delete.mockResolvedValue(1);
      mockUserRepository.update.mockResolvedValue({ ...mockUser, status: UserStatus.ACTIVE });
      mockMailerService.send.mockResolvedValue(true);

      const result = await service.cancelDeleteRequest(mockUser.id);

      expect(mockAccountDeleteRequestRepository.delete).toHaveBeenCalledWith(mockDeleteRequest.id, undefined);
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        { id: mockUser.id },
        { status: UserStatus.ACTIVE },
        { trx: undefined },
      );
      expect(mockMailerService.send).toHaveBeenCalledWith(expect.any(AccountDeleteRequestCancelledMail));
      expect(result).toEqual({
        success: true,
        message: 'Account deletion request has been cancelled successfully',
      });
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.cancelDeleteRequest('non-existent-user-id')).rejects.toThrow(NotFoundException);
      expect(mockAccountDeleteRequestRepository.delete).not.toHaveBeenCalled();
      expect(mockUserRepository.update).not.toHaveBeenCalled();
      expect(mockMailerService.send).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when transaction fails', async () => {
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, status: UserStatus.PENDING_ACCOUNT_DELETION });
      mockAccountDeleteRequestRepository.transaction.mockImplementation(async () => {
        throw new Error('Transaction failed');
      });

      await expect(service.cancelDeleteRequest(mockUser.id)).rejects.toThrow(InternalServerErrorException);
      expect(mockMailerService.send).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when user update fails', async () => {
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, status: UserStatus.PENDING_ACCOUNT_DELETION });
      mockAccountDeleteRequestRepository.findOne.mockResolvedValue(null);
      mockAccountDeleteRequestRepository.transaction.mockImplementation(async (callback) => {
        return await callback();
      });
      mockUserRepository.update.mockRejectedValue(new Error('Update failed'));

      await expect(service.cancelDeleteRequest(mockUser.id)).rejects.toThrow(InternalServerErrorException);
      expect(mockMailerService.send).not.toHaveBeenCalled();
    });

    it('should handle transaction with proper trx object', async () => {
      const mockTrx = {};
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, status: UserStatus.PENDING_ACCOUNT_DELETION });
      mockAccountDeleteRequestRepository.transaction.mockImplementation(async (callback) => {
        return await callback(mockTrx);
      });
      mockAccountDeleteRequestRepository.findOne.mockResolvedValue(mockDeleteRequest);
      mockAccountDeleteRequestRepository.delete.mockResolvedValue(1);
      mockUserRepository.update.mockResolvedValue({ ...mockUser, status: UserStatus.ACTIVE });
      mockMailerService.send.mockResolvedValue(true);

      const result = await service.cancelDeleteRequest(mockUser.id);

      expect(mockAccountDeleteRequestRepository.delete).toHaveBeenCalledWith(mockDeleteRequest.id, mockTrx);
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        { id: mockUser.id },
        { status: UserStatus.ACTIVE },
        { trx: mockTrx },
      );
      expect(result).toEqual({
        success: true,
        message: 'Account deletion request has been cancelled successfully',
      });
    });
  });
});

describe('AccountDeleteRequestController', () => {
  let controller: AccountDeleteRequestController;

  const mockAccountDeleteRequestService = {
    sendAccountDeleteRequestMail: jest.fn(),
    verifyAccountDeleteRequestCode: jest.fn(),
    createDeleteRequest: jest.fn(),
    getActiveDeleteRequest: jest.fn(),
    cancelDeleteRequest: jest.fn(),
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

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountDeleteRequestController],
      providers: [
        {
          provide: AccountDeleteRequestService,
          useValue: mockAccountDeleteRequestService,
        },
        {
          provide: AppLoggerService,
          useValue: mockAppLoggerService,
        },
      ],
    }).compile();

    controller = module.get<AccountDeleteRequestController>(AccountDeleteRequestController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('sendAccountDeleteRequestMail', () => {
    it('should send account delete request mail and return transformed response', async () => {
      mockAccountDeleteRequestService.sendAccountDeleteRequestMail.mockResolvedValue(true);

      const result = await controller.sendAccountDeleteRequestMail(mockUser as UserModel);

      expect(mockAccountDeleteRequestService.sendAccountDeleteRequestMail).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual({
        statusCode: 201,
        message: 'Account Delete Request Email Code Sent',
        data: true,
        timestamp: expect.any(String),
      });
    });

    it('should propagate errors from service', async () => {
      mockAccountDeleteRequestService.sendAccountDeleteRequestMail.mockRejectedValue(
        new InternalServerErrorException('Error sending email code for account delete request'),
      );

      await expect(controller.sendAccountDeleteRequestMail(mockUser as UserModel)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('verifyCode', () => {
    it('should verify account delete request code and return transformed response', async () => {
      const dto: VerifyAccountDeleteRequestDto = {
        code: '123456',
      };

      mockAccountDeleteRequestService.verifyAccountDeleteRequestCode.mockResolvedValue(true);

      const result = await controller.verifyCode(mockUser as UserModel, dto);

      expect(mockAccountDeleteRequestService.verifyAccountDeleteRequestCode).toHaveBeenCalledWith(mockUser, dto);
      expect(result).toEqual({
        statusCode: 200,
        message: 'Account delete request code verified successfully',
        data: true,
        timestamp: expect.any(String),
      });
    });

    it('should propagate InternalServerErrorException from service for invalid code', async () => {
      const dto: VerifyAccountDeleteRequestDto = {
        code: 'invalid-code',
      };

      mockAccountDeleteRequestService.verifyAccountDeleteRequestCode.mockRejectedValue(
        new InternalServerErrorException('Invalid code, please try again'),
      );

      await expect(controller.verifyCode(mockUser as UserModel, dto)).rejects.toThrow(InternalServerErrorException);
    });

    it('should propagate InternalServerErrorException from service', async () => {
      const dto: VerifyAccountDeleteRequestDto = {
        code: '123456',
      };

      mockAccountDeleteRequestService.verifyAccountDeleteRequestCode.mockRejectedValue(
        new InternalServerErrorException('Error verifying account delete request code'),
      );

      await expect(controller.verifyCode(mockUser as UserModel, dto)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('createDeleteRequest', () => {
    it('should create delete request and return transformed response', async () => {
      const dto: AccountDeleteRequestDto = {
        reasons: ['Not using the app', 'Privacy concerns'],
      };

      mockAccountDeleteRequestService.createDeleteRequest.mockResolvedValue(mockDeleteRequest);

      const result = await controller.createDeleteRequest(mockUser as UserModel, dto);

      expect(mockAccountDeleteRequestService.createDeleteRequest).toHaveBeenCalledWith(mockUser, dto);
      expect(result).toEqual({
        statusCode: 200,
        message: 'AccountDeleteRequest Successfully Created',
        data: mockDeleteRequest,
        timestamp: expect.any(String),
      });
    });

    it('should propagate errors from service', async () => {
      const dto: AccountDeleteRequestDto = {
        reasons: ['Not using the app'],
      };

      mockAccountDeleteRequestService.createDeleteRequest.mockRejectedValue(
        new NotFoundException('Account delete already requested for this user'),
      );

      await expect(controller.createDeleteRequest(mockUser as UserModel, dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getActiveDeleteRequest (Admin)', () => {
    it('should get active delete request and return transformed response', async () => {
      const mockActiveDeleteRequestInfo = {
        hasActiveRequest: true,
        deleteRequest: {
          id: mockDeleteRequest.id,
          reasons: mockDeleteRequest.reasons,
          deleted_on: mockDeleteRequest.deleted_on,
          created_at: mockDeleteRequest.created_at,
        },
        userStatus: UserStatus.PENDING_ACCOUNT_DELETION,
        hasPendingDeletionStatus: true,
      };

      mockAccountDeleteRequestService.getActiveDeleteRequest.mockResolvedValue(mockActiveDeleteRequestInfo);

      const result = await controller.getActiveDeleteRequest(mockUser.id);

      expect(mockAccountDeleteRequestService.getActiveDeleteRequest).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual({
        statusCode: 200,
        message: 'Active delete request fetched successfully',
        data: mockActiveDeleteRequestInfo,
        timestamp: expect.any(String),
      });
    });

    it('should return no active request when user has no delete request', async () => {
      const mockNoActiveRequestInfo = {
        hasActiveRequest: false,
        deleteRequest: null,
        userStatus: UserStatus.ACTIVE,
        hasPendingDeletionStatus: false,
      };

      mockAccountDeleteRequestService.getActiveDeleteRequest.mockResolvedValue(mockNoActiveRequestInfo);

      const result = await controller.getActiveDeleteRequest(mockUser.id);

      expect(result).toEqual({
        statusCode: 200,
        message: 'Active delete request fetched successfully',
        data: mockNoActiveRequestInfo,
        timestamp: expect.any(String),
      });
    });

    it('should propagate NotFoundException from service', async () => {
      mockAccountDeleteRequestService.getActiveDeleteRequest.mockRejectedValue(new NotFoundException('User not found'));

      await expect(controller.getActiveDeleteRequest('non-existent-user-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancelDeleteRequest (Admin)', () => {
    it('should cancel delete request and return transformed response', async () => {
      const mockCancelResponse = {
        success: true,
        message: 'Account deletion request has been cancelled successfully',
      };

      mockAccountDeleteRequestService.cancelDeleteRequest.mockResolvedValue(mockCancelResponse);

      const result = await controller.cancelDeleteRequest(mockUser.id);

      expect(mockAccountDeleteRequestService.cancelDeleteRequest).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual({
        statusCode: 200,
        message: 'Account delete request cancelled successfully',
        data: mockCancelResponse,
        timestamp: expect.any(String),
      });
    });

    it('should propagate NotFoundException when user does not exist', async () => {
      mockAccountDeleteRequestService.cancelDeleteRequest.mockRejectedValue(new NotFoundException('User not found'));

      await expect(controller.cancelDeleteRequest('non-existent-user-id')).rejects.toThrow(NotFoundException);
    });

    it('should propagate InternalServerErrorException on cancellation failure', async () => {
      mockAccountDeleteRequestService.cancelDeleteRequest.mockRejectedValue(
        new InternalServerErrorException('Error cancelling account deletion request'),
      );

      await expect(controller.cancelDeleteRequest(mockUser.id)).rejects.toThrow(InternalServerErrorException);
    });
  });
});

describe('AccountDeleteRequestModule', () => {
  it('should be defined', () => {
    expect(AccountDeleteRequestModule).toBeDefined();
  });

  it('should have correct metadata', () => {
    const moduleMetadata = Reflect.getMetadata('imports', AccountDeleteRequestModule);
    const controllersMetadata = Reflect.getMetadata('controllers', AccountDeleteRequestModule);
    const providersMetadata = Reflect.getMetadata('providers', AccountDeleteRequestModule);
    const exportsMetadata = Reflect.getMetadata('exports', AccountDeleteRequestModule);

    expect(moduleMetadata).toBeDefined();
    expect(controllersMetadata).toContain(AccountDeleteRequestController);
    expect(providersMetadata).toContain(AccountDeleteRequestRepository);
    expect(providersMetadata).toContain(AccountDeleteRequestService);
    expect(exportsMetadata).toContain(AccountDeleteRequestRepository);
    expect(exportsMetadata).toContain(AccountDeleteRequestService);
  });
});
