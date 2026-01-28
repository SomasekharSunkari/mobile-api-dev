import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { DateTime } from 'luxon';
import { UserModel } from '../../../database';
import { AccountDeactivationStatus } from '../../../database/models/accountDeactivationLog/accountDeactivationLog.interface';
import { AccountActivationMail } from '../../../notifications/mails/account_activation_mail';
import { AccountDeactivationSuccessfulMail } from '../../../notifications/mails/account_deactivation_successful_mail';
import { AppLoggerService } from '../../../services/logger/logger.service';
import { UtilsService } from '../../../utils/utils.service';
import { VerificationTokenGuard } from '../guard/verificationTokenGuard/verificationToken.guard';
import { VerificationTokenService } from '../verificationToken/verificationToken.service';
import { AccountDeactivationController } from './accountDeactivation.controller';
import { AccountDeactivationService } from './accountDeactivation.service';

describe('AccountDeactivationService', () => {
  let service: AccountDeactivationService;

  const mockPatchFn = jest.fn().mockResolvedValue(1);
  const mockDeleteFn = jest.fn().mockResolvedValue(undefined);
  const mockWhereFn = jest.fn().mockReturnValue({ delete: mockDeleteFn, patch: mockPatchFn });
  const mockWithGraphFetchedFn = jest.fn().mockReturnValue({ orderBy: jest.fn().mockResolvedValue([]) });
  const mockDeactivationQueryWhereFn = jest.fn().mockReturnValue({
    patch: mockPatchFn,
    withGraphFetched: mockWithGraphFetchedFn,
  });
  const mockDeactivationQueryFn = jest.fn().mockReturnValue({ where: mockDeactivationQueryWhereFn });

  const mockAccountDeactivationRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    transaction: jest.fn(),
    query: mockDeactivationQueryFn,
  };

  const mockUserService = {
    findByUserId: jest.fn(),
    deactivateUser: jest.fn(),
    activateUser: jest.fn(),
    verifyPassword: jest.fn(),
  };

  const mockAccountActionCodeService = {
    createAccountActionCode: jest.fn(),
    verifyAccountActionCode: jest.fn(),
    handleSuccessfulAccountAction: jest.fn(),
  };

  const mockMailerService = {
    send: jest.fn(),
  };

  const mockRedisCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockS3Service = {
    generateUniqueKey: jest.fn(),
    uploadBuffer: jest.fn(),
  };

  const mockInAppNotificationService = {
    createNotification: jest.fn().mockResolvedValue(undefined),
  };

  const mockUser: UserModel = {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
    first_name: 'Test',
    last_name: 'User',
    password: 'hashed-password',
    is_deactivated: false,
  } as UserModel;

  const mockDeactivatedUser: UserModel = {
    ...mockUser,
    is_deactivated: true,
  } as UserModel;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(UtilsService, 'comparePassword').mockResolvedValue(true);
    (DateTime.now as any) = () => DateTime.fromISO('2025-05-27T00:00:00Z');

    // Reset mock chains
    mockWhereFn.mockReturnValue({ delete: mockDeleteFn, patch: mockPatchFn });
    mockDeactivationQueryWhereFn.mockReturnValue({
      patch: mockPatchFn,
      withGraphFetched: mockWithGraphFetchedFn,
    });

    service = new AccountDeactivationService();
    (service as any).accountDeactivationRepository = mockAccountDeactivationRepository;
    (service as any).userService = mockUserService;
    (service as any).accountActionCodeService = mockAccountActionCodeService;
    (service as any).mailerService = mockMailerService;
    (service as any).redisCacheService = mockRedisCacheService;
    (service as any).s3Service = mockS3Service;
    (service as any).inAppNotificationService = mockInAppNotificationService;
    (service as any).logger = { log: jest.fn(), error: jest.fn() };
  });

  describe('createAccountDeactivation', () => {
    const mockDeactivationRecord = {
      id: 'deactivation-1',
      user_id: 'user-1',
      status: AccountDeactivationStatus.DEACTIVATED,
      reasons: ['No longer needed'],
      deactivated_by_user_id: 'user-1',
      deactivated_on: '2025-05-27 00:00:00',
      is_active_log: true,
    };

    beforeEach(() => {
      mockAccountDeactivationRepository.findOne.mockResolvedValue(null);
      mockAccountDeactivationRepository.create.mockResolvedValue(mockDeactivationRecord);
      mockAccountDeactivationRepository.transaction.mockImplementation(async (callback) => {
        const trx = {};
        return await callback(trx);
      });
      mockUserService.findByUserId.mockResolvedValue(mockUser);
      mockAccountActionCodeService.handleSuccessfulAccountAction.mockResolvedValue(undefined);
      mockUserService.deactivateUser.mockResolvedValue(undefined);
      mockMailerService.send.mockResolvedValue(undefined);
      mockRedisCacheService.del.mockResolvedValue(undefined);
    });

    it('should create account deactivation with email verification code', async () => {
      mockAccountActionCodeService.verifyAccountActionCode.mockResolvedValue(true);
      const dataWithCode = {
        email_verification_code: 'ABC123',
        reasons: ['No longer needed'],
      };

      const result = await service.createAccountDeactivation(mockUser, dataWithCode);

      expect(result).toHaveProperty('id', 'deactivation-1');
      expect(mockAccountActionCodeService.verifyAccountActionCode).toHaveBeenCalledWith('ABC123', mockUser);
    });

    it('should create account deactivation without email verification code', async () => {
      const dataWithoutCode = {
        reasons: ['No longer needed'],
      };

      const result = await service.createAccountDeactivation(mockUser, dataWithoutCode);

      expect(result).toHaveProperty('id', 'deactivation-1');
      expect(mockAccountActionCodeService.verifyAccountActionCode).not.toHaveBeenCalled();
    });

    it('should set all previous logs to inactive before creating new one', async () => {
      const trxMock = { isTransaction: true };
      mockAccountDeactivationRepository.transaction.mockImplementation(async (callback) => {
        return await callback(trxMock);
      });

      const dataWithoutCode = {
        reasons: ['No longer needed'],
      };

      await service.createAccountDeactivation(mockUser, dataWithoutCode);

      // Verify patch was called to set all previous logs to inactive
      expect(mockAccountDeactivationRepository.query).toHaveBeenCalledWith(trxMock);
      expect(mockDeactivationQueryWhereFn).toHaveBeenCalledWith('user_id', 'user-1');
      expect(mockPatchFn).toHaveBeenCalledWith({ is_active_log: false });
    });

    it('should execute all transaction operations correctly', async () => {
      const trxMock = { isTransaction: true };
      mockAccountDeactivationRepository.transaction.mockImplementation(async (callback) => {
        return await callback(trxMock);
      });

      const dataWithoutCode = {
        reasons: ['No longer needed'],
      };

      await service.createAccountDeactivation(mockUser, dataWithoutCode);

      // Verify create was called with all fields
      expect(mockAccountDeactivationRepository.create).toHaveBeenCalledWith(
        {
          user_id: 'user-1',
          reasons: ['No longer needed'],
          status: AccountDeactivationStatus.DEACTIVATED,
          is_active_log: true,
          deactivated_by_user_id: 'user-1',
          deactivated_on: expect.any(String),
        },
        trxMock,
      );
      expect(mockUserService.deactivateUser).toHaveBeenCalledWith('user-1', trxMock);
      expect(mockMailerService.send).toHaveBeenCalledWith(expect.any(AccountDeactivationSuccessfulMail));
      expect(mockInAppNotificationService.createNotification).toHaveBeenCalledWith({
        user_id: 'user-1',
        type: 'account_restricted',
        title: 'Account Restricted',
        message: 'Your account has been successfully restricted as requested.',
      });
      expect(mockAccountActionCodeService.handleSuccessfulAccountAction).toHaveBeenCalledWith(mockUser, trxMock);
      expect(mockRedisCacheService.del).toHaveBeenCalledWith('deactivation_status_user-1');
    });

    it('should throw UnauthorizedException when email verification code is invalid', async () => {
      mockAccountActionCodeService.verifyAccountActionCode.mockResolvedValue(false);
      const dataWithInvalidCode = {
        email_verification_code: 'INVALID',
        reasons: ['No longer needed'],
      };

      await expect(service.createAccountDeactivation(mockUser, dataWithInvalidCode)).rejects.toThrow(
        new InternalServerErrorException('Invalid code'),
      );
    });

    it('should throw BadRequestException if user already restricted', async () => {
      mockAccountDeactivationRepository.findOne.mockResolvedValue({
        id: 'existing-deactivation',
        status: AccountDeactivationStatus.DEACTIVATED,
        is_active_log: true,
      });

      const dataWithToken = {
        reasons: ['No longer needed'],
      };

      await expect(service.createAccountDeactivation(mockUser, dataWithToken)).rejects.toThrow(BadRequestException);
      await expect(service.createAccountDeactivation(mockUser, dataWithToken)).rejects.toThrow(
        new BadRequestException('User is already restricted'),
      );
    });

    it('should throw InternalServerErrorException if transaction fails', async () => {
      mockAccountDeactivationRepository.transaction.mockRejectedValue(new Error('DB error'));

      const dataWithToken = {
        reasons: ['No longer needed'],
      };

      await expect(service.createAccountDeactivation(mockUser, dataWithToken)).rejects.toThrow(
        new InternalServerErrorException('DB error'),
      );
    });

    it('should throw InternalServerErrorException with default message when error has no message', async () => {
      const errorWithoutMessage = new Error();
      errorWithoutMessage.message = '';
      mockAccountDeactivationRepository.transaction.mockRejectedValue(errorWithoutMessage);

      const dataWithToken = {
        reasons: ['No longer needed'],
      };

      await expect(service.createAccountDeactivation(mockUser, dataWithToken)).rejects.toThrow(
        'Error creating account deactivation',
      );
    });

    it('should log the error when an exception occurs', async () => {
      const testError = new Error('Test error');
      mockAccountDeactivationRepository.transaction.mockRejectedValue(testError);
      const loggerErrorSpy = jest.spyOn((service as any).logger, 'error');

      const dataWithToken = {
        reasons: ['No longer needed'],
      };

      await expect(service.createAccountDeactivation(mockUser, dataWithToken)).rejects.toThrow();
      expect(loggerErrorSpy).toHaveBeenCalledWith(testError);
    });

    it('should log the creation attempt', async () => {
      const loggerLogSpy = jest.spyOn((service as any).logger, 'log');

      const dataWithoutCode = {
        reasons: ['No longer needed'],
      };

      await service.createAccountDeactivation(mockUser, dataWithoutCode);

      expect(loggerLogSpy).toHaveBeenCalledWith(
        `Creating account deactivation for user ${mockUser.email}`,
        'AccountDeactivationService',
      );
    });

    describe('admin restricting another user', () => {
      const mockAdmin = {
        id: 'admin-1',
        email: 'admin@example.com',
        userRoles: [{ slug: 'admin' }],
        $fetchGraph: jest.fn().mockResolvedValue(undefined),
      } as unknown as UserModel;

      const mockTargetUser = {
        id: 'target-user-1',
        email: 'target@example.com',
      } as UserModel;

      beforeEach(() => {
        mockUserService.findByUserId.mockResolvedValue(mockTargetUser);
      });

      it('should allow admin to restrict another user', async () => {
        const dataWithUserId = {
          user_id: 'target-user-1',
          reasons: ['Policy violation'],
        };

        const result = await service.createAccountDeactivation(mockAdmin, dataWithUserId);

        expect(result).toHaveProperty('id', 'deactivation-1');
        expect(mockAdmin.$fetchGraph).toHaveBeenCalledWith('[userRoles]');
        expect(mockUserService.findByUserId).toHaveBeenCalledWith('target-user-1');
      });

      it('should throw UnauthorizedException when non-admin tries to restrict another user', async () => {
        const mockRegularUser = {
          id: 'user-1',
          email: 'user@example.com',
          userRoles: [{ slug: 'user' }],
          $fetchGraph: jest.fn().mockResolvedValue(undefined),
        } as unknown as UserModel;

        const dataWithUserId = {
          user_id: 'target-user-1',
          reasons: ['Policy violation'],
        };

        await expect(service.createAccountDeactivation(mockRegularUser, dataWithUserId)).rejects.toThrow(
          UnauthorizedException,
        );
        await expect(service.createAccountDeactivation(mockRegularUser, dataWithUserId)).rejects.toThrow(
          'You are not authorized to restrict other users',
        );
      });

      it('should not call handleSuccessfulAccountAction when admin restricts another user', async () => {
        const dataWithUserId = {
          user_id: 'target-user-1',
          reasons: ['Policy violation'],
        };

        await service.createAccountDeactivation(mockAdmin, dataWithUserId);

        expect(mockAccountActionCodeService.handleSuccessfulAccountAction).not.toHaveBeenCalled();
      });

      it('should log admin restriction action', async () => {
        const loggerLogSpy = jest.spyOn((service as any).logger, 'log');

        const dataWithUserId = {
          user_id: 'target-user-1',
          reasons: ['Policy violation'],
        };

        await service.createAccountDeactivation(mockAdmin, dataWithUserId);

        expect(loggerLogSpy).toHaveBeenCalledWith(
          `Admin ${mockAdmin.email} restricting account for user ${mockTargetUser.email}`,
          'AccountDeactivationService',
        );
      });
    });
  });

  describe('activateAccount', () => {
    const mockAdmin = {
      id: 'admin-1',
      email: 'admin@example.com',
      userRoles: [{ slug: 'admin' }],
      $fetchGraph: jest.fn().mockResolvedValue(undefined),
    } as unknown as UserModel;

    const mockSuperAdmin = {
      id: 'super-admin-1',
      email: 'superadmin@example.com',
      userRoles: [{ slug: 'super-admin' }],
      $fetchGraph: jest.fn().mockResolvedValue(undefined),
    } as unknown as UserModel;

    const mockRegularUser = {
      id: 'user-1',
      email: 'user@example.com',
      userRoles: [{ slug: 'user' }],
      $fetchGraph: jest.fn().mockResolvedValue(undefined),
    } as unknown as UserModel;

    const mockActivationData = {
      user_id: 'user-1',
    };

    const mockDeactivationLogByUser = {
      id: 'deactivation-1',
      user_id: 'user-1',
      deactivated_by_user_id: 'user-1',
      status: AccountDeactivationStatus.DEACTIVATED,
      is_active_log: true,
    };

    const mockDeactivationLogByAdmin = {
      id: 'deactivation-1',
      user_id: 'user-1',
      deactivated_by_user_id: 'admin-1',
      status: AccountDeactivationStatus.DEACTIVATED,
      is_active_log: true,
    };

    const mockActivatedLog = {
      id: 'activation-1',
      status: AccountDeactivationStatus.ACTIVATED,
      reactivated_by_user_id: 'admin-1',
      user_id: 'user-1',
      is_active_log: true,
      reasons: [],
    };

    beforeEach(() => {
      mockUserService.findByUserId.mockResolvedValue(mockDeactivatedUser);
      mockAccountDeactivationRepository.findOne.mockResolvedValue(mockDeactivationLogByUser);
      mockAccountDeactivationRepository.transaction.mockImplementation(async (callback) => {
        return await callback({});
      });
      mockAccountDeactivationRepository.create.mockResolvedValue(mockActivatedLog);
      mockUserService.activateUser.mockResolvedValue(undefined);
      mockMailerService.send.mockResolvedValue(undefined);
      mockRedisCacheService.del.mockResolvedValue(undefined);
    });

    it('should allow admin to activate any account successfully', async () => {
      mockAccountDeactivationRepository.findOne.mockResolvedValue(mockDeactivationLogByAdmin);

      const result = await service.activateAccount(mockActivationData, mockAdmin);

      expect(result).toHaveProperty('id', 'activation-1');
      expect(mockUserService.activateUser).toHaveBeenCalledWith('user-1', {});
      expect(mockMailerService.send).toHaveBeenCalledWith(expect.any(AccountActivationMail));
    });

    it('should allow super admin to activate any account successfully', async () => {
      mockAccountDeactivationRepository.findOne.mockResolvedValue(mockDeactivationLogByAdmin);

      const result = await service.activateAccount(mockActivationData, mockSuperAdmin);

      expect(result).toHaveProperty('id', 'activation-1');
      expect(mockUserService.activateUser).toHaveBeenCalledWith('user-1', {});
      expect(mockMailerService.send).toHaveBeenCalledWith(expect.any(AccountActivationMail));
    });

    it('should allow user to activate their own account when they deactivated it themselves', async () => {
      mockAccountDeactivationRepository.findOne.mockResolvedValue(mockDeactivationLogByUser);
      mockAccountDeactivationRepository.create.mockResolvedValue({
        ...mockActivatedLog,
        reactivated_by_user_id: 'user-1',
      });

      const result = await service.activateAccount(mockActivationData, mockRegularUser);

      expect(result).toHaveProperty('id', 'activation-1');
      expect(mockUserService.activateUser).toHaveBeenCalledWith('user-1', {});
      expect(mockMailerService.send).toHaveBeenCalledWith(expect.any(AccountActivationMail));
    });

    it('should throw BadRequestException when user tries to activate their account that was deactivated by admin', async () => {
      mockAccountDeactivationRepository.findOne.mockResolvedValue(mockDeactivationLogByAdmin);

      await expect(service.activateAccount(mockActivationData, mockRegularUser)).rejects.toThrow(
        new BadRequestException(
          'Your account was restricted by an administrator. Please contact support to request account unrestriction.',
        ),
      );
    });

    it('should throw UnauthorizedException when non-admin tries to activate another users account', async () => {
      const otherUserActivationData = { user_id: 'other-user-id' };
      mockUserService.findByUserId.mockResolvedValue({
        ...mockDeactivatedUser,
        id: 'other-user-id',
      });
      mockAccountDeactivationRepository.findOne.mockResolvedValue({
        ...mockDeactivationLogByUser,
        user_id: 'other-user-id',
        deactivated_by_user_id: 'other-user-id',
      });

      await expect(service.activateAccount(otherUserActivationData, mockRegularUser)).rejects.toThrow(
        new UnauthorizedException('You are not authorized to perform this action'),
      );
    });

    it('should set all previous logs to inactive using patch', async () => {
      const trxMock = { isTransaction: true };
      mockAccountDeactivationRepository.transaction.mockImplementation(async (callback) => {
        return await callback(trxMock);
      });

      await service.activateAccount(mockActivationData, mockAdmin);

      // Verify patch was called to set all previous logs to inactive
      expect(mockAccountDeactivationRepository.query).toHaveBeenCalledWith(trxMock);
      expect(mockDeactivationQueryWhereFn).toHaveBeenCalledWith('user_id', 'user-1');
      expect(mockPatchFn).toHaveBeenCalledWith({ is_active_log: false });
    });

    it('should execute all transaction operations correctly', async () => {
      const trxMock = { isTransaction: true };
      mockAccountDeactivationRepository.transaction.mockImplementation(async (callback) => {
        return await callback(trxMock);
      });

      await service.activateAccount(mockActivationData, mockAdmin);

      expect(mockUserService.activateUser).toHaveBeenCalledWith('user-1', trxMock);
      expect(mockAccountDeactivationRepository.create).toHaveBeenCalledWith(
        {
          status: AccountDeactivationStatus.ACTIVATED,
          reactivated_by_user_id: 'admin-1',
          reactivated_on: expect.any(String),
          user_id: 'user-1',
          is_active_log: true,
          reasons: [],
        },
        trxMock,
      );
      expect(mockRedisCacheService.del).toHaveBeenCalledWith('deactivation_status_user-1');
    });

    it('should throw BadRequestException if user already activated (no log, not deactivated)', async () => {
      mockAccountDeactivationRepository.findOne.mockResolvedValue(null);
      mockUserService.findByUserId.mockResolvedValue({
        ...mockUser,
        is_deactivated: false,
      });

      await expect(service.activateAccount(mockActivationData, mockAdmin)).rejects.toThrow(
        new BadRequestException('User is already activated'),
      );
    });

    it('should throw InternalServerErrorException if activation fails', async () => {
      mockAccountDeactivationRepository.transaction.mockRejectedValue(new Error('DB error'));

      await expect(service.activateAccount(mockActivationData, mockAdmin)).rejects.toThrow(
        new InternalServerErrorException('DB error'),
      );
    });

    it('should throw InternalServerErrorException with default message when error has no message', async () => {
      const errorWithoutMessage = new Error();
      errorWithoutMessage.message = '';
      mockAccountDeactivationRepository.transaction.mockRejectedValue(errorWithoutMessage);

      await expect(service.activateAccount(mockActivationData, mockAdmin)).rejects.toThrow('Error activating account');
    });

    it('should log the activation attempt', async () => {
      const loggerLogSpy = jest.spyOn((service as any).logger, 'log');

      await service.activateAccount(mockActivationData, mockAdmin);

      expect(loggerLogSpy).toHaveBeenCalledWith(
        `Activating account for user ${mockActivationData.user_id}`,
        'AccountDeactivationService',
      );
    });

    it('should log the error when an exception occurs', async () => {
      const testError = new Error('Test error');
      mockAccountDeactivationRepository.transaction.mockRejectedValue(testError);
      const loggerErrorSpy = jest.spyOn((service as any).logger, 'error');

      await expect(service.activateAccount(mockActivationData, mockAdmin)).rejects.toThrow();
      expect(loggerErrorSpy).toHaveBeenCalledWith(testError);
    });

    it('should call $fetchGraph to load user roles', async () => {
      await service.activateAccount(mockActivationData, mockAdmin);

      expect(mockAdmin.$fetchGraph).toHaveBeenCalledWith('[userRoles]');
    });
  });

  describe('getActiveDeactivationRecord', () => {
    it('should return active deactivation record when found', async () => {
      const mockDeactivationLog = {
        id: 'deactivation-1',
        user_id: 'user-1',
        status: AccountDeactivationStatus.DEACTIVATED,
        is_active_log: true,
        reasons: ['No longer needed'],
      };
      mockAccountDeactivationRepository.findOne.mockResolvedValue(mockDeactivationLog);

      const result = await service.getActiveDeactivationRecord('user-1');

      expect(result).toEqual(mockDeactivationLog);
      expect(mockAccountDeactivationRepository.findOne).toHaveBeenCalledWith({
        user_id: 'user-1',
        status: AccountDeactivationStatus.DEACTIVATED,
        is_active_log: true,
      });
    });

    it('should throw NotFoundException when no active deactivation record found', async () => {
      mockAccountDeactivationRepository.findOne.mockResolvedValue(null);

      await expect(service.getActiveDeactivationRecord('user-1')).rejects.toThrow(
        new NotFoundException('No active deactivation record found for this user'),
      );
    });

    it('should log the retrieval attempt', async () => {
      const mockDeactivationLog = {
        id: 'deactivation-1',
        user_id: 'user-1',
        status: AccountDeactivationStatus.DEACTIVATED,
        is_active_log: true,
        reasons: ['No longer needed'],
      };
      mockAccountDeactivationRepository.findOne.mockResolvedValue(mockDeactivationLog);
      const loggerLogSpy = jest.spyOn((service as any).logger, 'log');

      await service.getActiveDeactivationRecord('user-1');

      expect(loggerLogSpy).toHaveBeenCalledWith(
        'Getting active deactivation record for user: user-1',
        'AccountDeactivationService',
      );
    });
  });

  describe('getDeactivationLogsForUser', () => {
    const mockLogs = [
      {
        id: 'log-1',
        user_id: 'user-1',
        status: AccountDeactivationStatus.DEACTIVATED,
        is_active_log: false,
        reasons: ['First restriction'],
        deactivatedBy: { id: 'admin-1', email: 'admin@example.com' },
        reactivatedBy: { id: 'admin-1', email: 'admin@example.com' },
      },
      {
        id: 'log-2',
        user_id: 'user-1',
        status: AccountDeactivationStatus.ACTIVATED,
        is_active_log: true,
        reasons: [],
        deactivatedBy: null,
        reactivatedBy: { id: 'admin-1', email: 'admin@example.com' },
      },
    ];

    beforeEach(() => {
      const mockOrderBy = jest.fn().mockResolvedValue(mockLogs);
      mockWithGraphFetchedFn.mockReturnValue({ orderBy: mockOrderBy });
    });

    it('should return all deactivation logs for a user', async () => {
      const result = await service.getDeactivationLogsForUser('user-1');

      expect(result).toEqual(mockLogs);
      expect(mockAccountDeactivationRepository.query).toHaveBeenCalled();
      expect(mockDeactivationQueryWhereFn).toHaveBeenCalledWith('user_id', 'user-1');
      expect(mockWithGraphFetchedFn).toHaveBeenCalledWith('[deactivatedBy, reactivatedBy]');
    });

    it('should log the retrieval attempt', async () => {
      const loggerLogSpy = jest.spyOn((service as any).logger, 'log');

      await service.getDeactivationLogsForUser('user-1');

      expect(loggerLogSpy).toHaveBeenCalledWith(
        'Getting all deactivation logs for user: user-1',
        'AccountDeactivationService',
      );
    });

    it('should return empty array when no logs found', async () => {
      const mockOrderBy = jest.fn().mockResolvedValue([]);
      mockWithGraphFetchedFn.mockReturnValue({ orderBy: mockOrderBy });

      const result = await service.getDeactivationLogsForUser('user-with-no-logs');

      expect(result).toEqual([]);
    });
  });

  describe('reactivateAccountWithDocument', () => {
    const mockAdmin = {
      id: 'admin-1',
      email: 'admin@example.com',
    } as UserModel;

    const mockReactivateData = {
      user_id: 'user-1',
      reactivation_description: 'User requested to reactivate their account',
    };

    const mockSupportDocument = {
      buffer: Buffer.from('test file content'),
      originalname: 'support-doc.pdf',
      mimetype: 'application/pdf',
    } as Express.Multer.File;

    const mockDeactivationLog = {
      id: 'deactivation-1',
      user_id: 'user-1',
      status: AccountDeactivationStatus.DEACTIVATED,
      is_active_log: true,
    };

    const mockActivatedLog = {
      id: 'activation-1',
      status: AccountDeactivationStatus.ACTIVATED,
      reactivated_by_user_id: 'admin-1',
      reactivation_description: 'User requested to reactivate their account',
      reactivation_support_document_url: 'https://s3.amazonaws.com/bucket/test-key.pdf',
    };

    beforeEach(() => {
      mockUserService.findByUserId.mockResolvedValue(mockDeactivatedUser);
      mockAccountDeactivationRepository.findOne.mockResolvedValue(mockDeactivationLog);
      mockAccountDeactivationRepository.transaction.mockImplementation(async (callback) => {
        return await callback({});
      });
      mockAccountDeactivationRepository.create.mockResolvedValue(mockActivatedLog);
      mockUserService.activateUser.mockResolvedValue(undefined);
      mockMailerService.send.mockResolvedValue(undefined);
      mockRedisCacheService.del.mockResolvedValue(undefined);
      mockS3Service.generateUniqueKey.mockReturnValue('reactivation-support-documents/user-1/test-key.pdf');
      mockS3Service.uploadBuffer.mockResolvedValue({
        location: 'https://s3.amazonaws.com/bucket/test-key.pdf',
        key: 'reactivation-support-documents/user-1/test-key.pdf',
      });
    });

    it('should reactivate account with support document successfully', async () => {
      const result = await service.reactivateAccountWithDocument(mockReactivateData, mockAdmin, mockSupportDocument);

      expect(result).toHaveProperty('id', 'activation-1');
      expect(result).toHaveProperty('status', AccountDeactivationStatus.ACTIVATED);
      expect(mockS3Service.generateUniqueKey).toHaveBeenCalledWith(
        `reactivation-support-documents/${mockUser.id}`,
        'pdf',
      );
      expect(mockS3Service.uploadBuffer).toHaveBeenCalledWith(mockSupportDocument.buffer, {
        key: 'reactivation-support-documents/user-1/test-key.pdf',
        contentType: 'application/pdf',
        metadata: {
          userId: mockUser.id,
          adminId: mockAdmin.id,
          originalName: 'support-doc.pdf',
          uploadedAt: expect.any(String),
        },
      });
      expect(mockUserService.activateUser).toHaveBeenCalledWith('user-1', {});
      expect(mockMailerService.send).toHaveBeenCalledWith(expect.any(AccountActivationMail));
    });

    it('should reactivate account without support document', async () => {
      mockAccountDeactivationRepository.create.mockResolvedValue({
        ...mockActivatedLog,
        reactivation_support_document_url: undefined,
      });

      const result = await service.reactivateAccountWithDocument(mockReactivateData, mockAdmin);

      expect(result).toHaveProperty('id', 'activation-1');
      expect(mockS3Service.generateUniqueKey).not.toHaveBeenCalled();
      expect(mockS3Service.uploadBuffer).not.toHaveBeenCalled();
      expect(mockUserService.activateUser).toHaveBeenCalledWith('user-1', {});
    });

    it('should set all previous logs to inactive using patch', async () => {
      const trxMock = { isTransaction: true };
      mockAccountDeactivationRepository.transaction.mockImplementation(async (callback) => {
        return await callback(trxMock);
      });

      await service.reactivateAccountWithDocument(mockReactivateData, mockAdmin, mockSupportDocument);

      // Verify patch was called to set all previous logs to inactive
      expect(mockAccountDeactivationRepository.query).toHaveBeenCalledWith(trxMock);
      expect(mockDeactivationQueryWhereFn).toHaveBeenCalledWith('user_id', 'user-1');
      expect(mockPatchFn).toHaveBeenCalledWith({ is_active_log: false });
    });

    it('should execute all transaction operations correctly with document', async () => {
      const trxMock = { isTransaction: true };
      mockAccountDeactivationRepository.transaction.mockImplementation(async (callback) => {
        return await callback(trxMock);
      });

      await service.reactivateAccountWithDocument(mockReactivateData, mockAdmin, mockSupportDocument);

      expect(mockUserService.activateUser).toHaveBeenCalledWith('user-1', trxMock);
      expect(mockAccountDeactivationRepository.create).toHaveBeenCalledWith(
        {
          status: AccountDeactivationStatus.ACTIVATED,
          reactivated_by_user_id: 'admin-1',
          reactivated_on: expect.any(String),
          user_id: 'user-1',
          is_active_log: true,
          reasons: [],
          reactivation_description: 'User requested to reactivate their account',
          reactivation_support_document_url: 'https://s3.amazonaws.com/bucket/test-key.pdf',
        },
        trxMock,
      );
      expect(mockRedisCacheService.del).toHaveBeenCalledWith('deactivation_status_user-1');
    });

    it('should execute all transaction operations correctly without document', async () => {
      const trxMock = { isTransaction: true };
      mockAccountDeactivationRepository.transaction.mockImplementation(async (callback) => {
        return await callback(trxMock);
      });
      mockAccountDeactivationRepository.create.mockResolvedValue({
        ...mockActivatedLog,
        reactivation_support_document_url: undefined,
      });

      await service.reactivateAccountWithDocument(mockReactivateData, mockAdmin);

      expect(mockAccountDeactivationRepository.create).toHaveBeenCalledWith(
        {
          status: AccountDeactivationStatus.ACTIVATED,
          reactivated_by_user_id: 'admin-1',
          reactivated_on: expect.any(String),
          user_id: 'user-1',
          is_active_log: true,
          reasons: [],
          reactivation_description: 'User requested to reactivate their account',
          reactivation_support_document_url: undefined,
        },
        trxMock,
      );
    });

    it('should throw BadRequestException if user already activated (no log, not deactivated)', async () => {
      mockAccountDeactivationRepository.findOne.mockResolvedValue(null);
      mockUserService.findByUserId.mockResolvedValue({
        ...mockUser,
        is_deactivated: false,
      });

      await expect(service.reactivateAccountWithDocument(mockReactivateData, mockAdmin)).rejects.toThrow(
        new BadRequestException('User is already activated'),
      );
    });

    it('should throw InternalServerErrorException if reactivation fails', async () => {
      mockAccountDeactivationRepository.transaction.mockRejectedValue(new Error('DB error'));

      await expect(
        service.reactivateAccountWithDocument(mockReactivateData, mockAdmin, mockSupportDocument),
      ).rejects.toThrow(new InternalServerErrorException('DB error'));
    });

    it('should throw InternalServerErrorException if S3 upload fails', async () => {
      mockS3Service.uploadBuffer.mockRejectedValue(new Error('S3 upload failed'));

      await expect(
        service.reactivateAccountWithDocument(mockReactivateData, mockAdmin, mockSupportDocument),
      ).rejects.toThrow(new InternalServerErrorException('S3 upload failed'));
    });

    it('should throw InternalServerErrorException with default message when error has no message', async () => {
      const errorWithoutMessage = new Error();
      errorWithoutMessage.message = '';
      mockAccountDeactivationRepository.transaction.mockRejectedValue(errorWithoutMessage);

      await expect(service.reactivateAccountWithDocument(mockReactivateData, mockAdmin)).rejects.toThrow(
        'Error reactivating account with document',
      );
    });

    it('should log the reactivation attempt', async () => {
      const loggerLogSpy = jest.spyOn((service as any).logger, 'log');

      await service.reactivateAccountWithDocument(mockReactivateData, mockAdmin, mockSupportDocument);

      expect(loggerLogSpy).toHaveBeenCalledWith(
        `Reactivating account for user ${mockReactivateData.user_id} with document`,
        'AccountDeactivationService',
      );
    });

    it('should log the error when an exception occurs', async () => {
      const testError = new Error('Test error');
      mockAccountDeactivationRepository.transaction.mockRejectedValue(testError);
      const loggerErrorSpy = jest.spyOn((service as any).logger, 'error');

      await expect(
        service.reactivateAccountWithDocument(mockReactivateData, mockAdmin, mockSupportDocument),
      ).rejects.toThrow();
      expect(loggerErrorSpy).toHaveBeenCalledWith(testError);
    });

    it('should handle support document with different file extensions', async () => {
      const pngDocument = {
        buffer: Buffer.from('png content'),
        originalname: 'document.png',
        mimetype: 'image/png',
      } as Express.Multer.File;

      mockS3Service.generateUniqueKey.mockReturnValue('reactivation-support-documents/user-1/test-key.png');
      mockS3Service.uploadBuffer.mockResolvedValue({
        location: 'https://s3.amazonaws.com/bucket/test-key.png',
        key: 'reactivation-support-documents/user-1/test-key.png',
      });

      await service.reactivateAccountWithDocument(mockReactivateData, mockAdmin, pngDocument);

      expect(mockS3Service.generateUniqueKey).toHaveBeenCalledWith(
        `reactivation-support-documents/${mockUser.id}`,
        'png',
      );
      expect(mockS3Service.uploadBuffer).toHaveBeenCalledWith(pngDocument.buffer, {
        key: 'reactivation-support-documents/user-1/test-key.png',
        contentType: 'image/png',
        metadata: {
          userId: mockUser.id,
          adminId: mockAdmin.id,
          originalName: 'document.png',
          uploadedAt: expect.any(String),
        },
      });
    });
  });
});

describe('AccountDeactivationController', () => {
  let controller: AccountDeactivationController;
  let service: AccountDeactivationService;

  const mockAccountDeactivationService = {
    createAccountDeactivation: jest.fn(),
    activateAccount: jest.fn(),
    getActiveDeactivationRecord: jest.fn(),
    reactivateAccountWithDocument: jest.fn(),
    getDeactivationLogsForUser: jest.fn(),
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

  const mockVerificationTokenService = {
    verifyToken: jest.fn(),
  };

  const mockReflector = {
    get: jest.fn().mockReturnValue([]),
  };

  const mockUser: UserModel = {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
  } as UserModel;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountDeactivationController],
      providers: [
        { provide: AccountDeactivationService, useValue: mockAccountDeactivationService },
        { provide: AppLoggerService, useValue: mockAppLoggerService },
        { provide: VerificationTokenService, useValue: mockVerificationTokenService },
        { provide: Reflector, useValue: mockReflector },
      ],
    })
      .overrideGuard(VerificationTokenGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<AccountDeactivationController>(AccountDeactivationController);
    service = module.get<AccountDeactivationService>(AccountDeactivationService);
  });

  describe('createDeactivation', () => {
    it('should create deactivation and return transformed response', async () => {
      const deactivationData = {
        password: 'test-password',
        reasons: ['No longer needed'],
      };
      const mockResponse = {
        id: 'deactivation-1',
        status: AccountDeactivationStatus.DEACTIVATED,
      };
      mockAccountDeactivationService.createAccountDeactivation.mockResolvedValue(mockResponse);

      const result = await controller.createDeactivation(mockUser, deactivationData);

      expect(service.createAccountDeactivation).toHaveBeenCalledWith(mockUser, deactivationData);
      expect(result).toMatchObject({
        message: 'You have successfully deactivated your account',
        data: mockResponse,
        statusCode: 201,
      });
    });
  });

  describe('activateAccount', () => {
    it('should activate account and return transformed response', async () => {
      const activationData = { user_id: 'user-1' };
      const mockLoggedInUser = { id: 'admin-1' } as UserModel;
      const mockResponse = {
        id: 'activation-1',
        status: AccountDeactivationStatus.ACTIVATED,
      };
      mockAccountDeactivationService.activateAccount.mockResolvedValue(mockResponse);

      const result = await controller.activateAccount(mockLoggedInUser, activationData);

      expect(service.activateAccount).toHaveBeenCalledWith(activationData, mockLoggedInUser);
      expect(result).toMatchObject({
        message: 'Account Activated Successfully',
        data: mockResponse,
        statusCode: 200,
      });
    });
  });

  describe('getActiveDeactivationRecord', () => {
    it('should get active deactivation record and return transformed response', async () => {
      const mockResponse = {
        id: 'deactivation-1',
        user_id: 'user-1',
        status: AccountDeactivationStatus.DEACTIVATED,
        is_active_log: true,
        reasons: ['No longer needed'],
      };
      mockAccountDeactivationService.getActiveDeactivationRecord.mockResolvedValue(mockResponse);

      const result = await controller.getActiveDeactivationRecord(mockUser);

      expect(service.getActiveDeactivationRecord).toHaveBeenCalledWith(mockUser.id);
      expect(result).toMatchObject({
        message: 'Active deactivation record retrieved successfully',
        data: mockResponse,
        statusCode: 200,
      });
    });

    it('should throw NotFoundException when no active deactivation record found', async () => {
      mockAccountDeactivationService.getActiveDeactivationRecord.mockRejectedValue(
        new NotFoundException('No active deactivation record found for this user'),
      );

      await expect(controller.getActiveDeactivationRecord(mockUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDeactivationLogsForUser', () => {
    it('should get deactivation logs for a user and return transformed response', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          user_id: 'user-1',
          status: AccountDeactivationStatus.DEACTIVATED,
          is_active_log: false,
          reasons: ['First restriction'],
        },
        {
          id: 'log-2',
          user_id: 'user-1',
          status: AccountDeactivationStatus.ACTIVATED,
          is_active_log: true,
          reasons: [],
        },
      ];
      mockAccountDeactivationService.getDeactivationLogsForUser.mockResolvedValue(mockLogs);

      const result = await controller.getDeactivationLogsForUser('user-1');

      expect(service.getDeactivationLogsForUser).toHaveBeenCalledWith('user-1');
      expect(result).toMatchObject({
        message: 'Deactivation logs retrieved successfully',
        data: mockLogs,
        statusCode: 200,
      });
    });
  });

  describe('reactivateAccountWithDocument', () => {
    const mockAdmin = { id: 'admin-1', email: 'admin@example.com' } as UserModel;

    const mockReactivateData = {
      user_id: 'user-1',
      reactivation_description: 'User requested to reactivate their account',
    };

    const mockSupportDocument = {
      buffer: Buffer.from('test file content'),
      originalname: 'support-doc.pdf',
      mimetype: 'application/pdf',
    } as Express.Multer.File;

    it('should reactivate account with support document and return transformed response', async () => {
      const mockResponse = {
        id: 'activation-1',
        status: AccountDeactivationStatus.ACTIVATED,
        reactivation_description: 'User requested to reactivate their account',
        reactivation_support_document_url: 'https://s3.amazonaws.com/bucket/test-key.pdf',
      };
      mockAccountDeactivationService.reactivateAccountWithDocument.mockResolvedValue(mockResponse);

      const result = await controller.reactivateAccountWithDocument(mockAdmin, mockReactivateData, mockSupportDocument);

      expect(service.reactivateAccountWithDocument).toHaveBeenCalledWith(
        mockReactivateData,
        mockAdmin,
        mockSupportDocument,
      );
      expect(result).toMatchObject({
        message: 'Account reactivated successfully',
        data: mockResponse,
        statusCode: 200,
      });
    });

    it('should reactivate account without support document and return transformed response', async () => {
      const mockResponse = {
        id: 'activation-1',
        status: AccountDeactivationStatus.ACTIVATED,
        reactivation_description: 'User requested to reactivate their account',
        reactivation_support_document_url: undefined,
      };
      mockAccountDeactivationService.reactivateAccountWithDocument.mockResolvedValue(mockResponse);

      const result = await controller.reactivateAccountWithDocument(mockAdmin, mockReactivateData);

      expect(service.reactivateAccountWithDocument).toHaveBeenCalledWith(mockReactivateData, mockAdmin, undefined);
      expect(result).toMatchObject({
        message: 'Account reactivated successfully',
        data: mockResponse,
        statusCode: 200,
      });
    });
  });
});
