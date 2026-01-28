import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DateTime } from 'luxon';
import { AppLoggerService } from '../../../services/logger/logger.service';
import { MailerService } from '../../../services/queue/processors/mailer/mailer.service';
import { UtilsService } from '../../../utils/utils.service';
import { AccessTokenService } from '../accessToken';
import { TransactionPinService } from '../transactionPin/transactionPin.service';
import { UserRepository } from '../user/user.repository';
import { ResetPasswordController } from './reset-password.controller';
import { ResetPasswordRepository } from './reset-password.repository';
import { ResetPasswordService } from './reset-password.service';

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  phone: '1234567890',
  phone_number: '1234567890',
  username: 'testuser',
  status: 'active',
  password: 'hashed-old-password',
};

describe('ResetPasswordService', () => {
  let service: ResetPasswordService;
  const mockUserRepository = {
    findActiveByEmail: jest.fn(),
    findActiveByPhone: jest.fn(),
    update: jest.fn(),
  };
  const mockResetPasswordRepository = {
    create: jest.fn(),
    findOne: jest.fn(),
    findSync: jest.fn(),
    update: jest.fn(),
    transaction: jest.fn((cb) => cb()),
  };
  const mockMailerService = {
    send: jest.fn(),
  };
  const mockAccessTokenService = {
    delete: jest.fn(),
  };
  const mockTransactionPinService = {
    resetFailedAttempts: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(UtilsService, 'generateCode').mockReturnValue('123456');
    jest.spyOn(UtilsService, 'hashPassword').mockResolvedValue('hashed-123456');
    jest.spyOn(UtilsService, 'comparePassword').mockResolvedValue(true);
    jest.spyOn(UtilsService, 'isDatePassed').mockReturnValue(false);
    (DateTime.now as any) = () => DateTime.fromISO('2025-05-27T00:00:00Z');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResetPasswordService,
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: MailerService, useValue: mockMailerService },
        { provide: AccessTokenService, useValue: mockAccessTokenService },
        { provide: ResetPasswordRepository, useValue: mockResetPasswordRepository },
        { provide: TransactionPinService, useValue: mockTransactionPinService },
      ],
    }).compile();
    service = module.get<ResetPasswordService>(ResetPasswordService);
  });

  describe('forgotPassword', () => {
    it('should send a reset code if user exists and is active', async () => {
      mockUserRepository.findActiveByEmail.mockResolvedValue(mockUser);
      mockResetPasswordRepository.findSync.mockReturnValue({
        andWhere: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnValue(undefined),
      });
      mockResetPasswordRepository.create.mockResolvedValue({});
      mockMailerService.send.mockResolvedValue({});
      const data = { email: 'test@example.com' };
      const result = await service.forgotPassword(data as any);
      expect(mockUserRepository.findActiveByEmail).toHaveBeenCalledWith('test@example.com');
      expect(result).toEqual({ success: true });
    });
    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.findActiveByEmail.mockResolvedValue(undefined);
      const data = { email: 'notfound@example.com' };
      await expect(service.forgotPassword(data as any)).rejects.toThrow(NotFoundException);
    });
    it('should throw NotFoundException if user is deactivated', async () => {
      mockUserRepository.findActiveByEmail.mockResolvedValue({ ...mockUser, status: 'deleted' });
      const data = { email: 'test@example.com' };
      await expect(service.forgotPassword(data as any)).rejects.toThrow(NotFoundException);
    });
    it('should throw InternalServerErrorException if an error occurs', async () => {
      mockUserRepository.findActiveByEmail.mockResolvedValue(mockUser);
      mockResetPasswordRepository.create.mockRejectedValue(new Error('DB error'));
      const data = { email: 'test@example.com' };
      await expect(service.forgotPassword(data as any)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('resetPassword', () => {
    it('should reset password if token and user are valid', async () => {
      jest.spyOn(service as any, 'verifyResetPasswordToken').mockResolvedValue({ user: mockUser });
      jest.spyOn(UtilsService, 'hashPassword').mockResolvedValue('hashed-123456');
      jest.spyOn(UtilsService, 'comparePassword').mockResolvedValue(false);
      mockUserRepository.update.mockResolvedValue({});
      mockResetPasswordRepository.update.mockResolvedValue({});
      mockAccessTokenService.delete.mockResolvedValue({});
      const data = { reset_password_token: 'token', password: 'newpassword' };
      const result = await service.resetPassword(data as any);
      expect(result).toEqual({ success: true });
    });
    it('should throw NotFoundException if user is deactivated', async () => {
      jest
        .spyOn(service as any, 'verifyResetPasswordToken')
        .mockResolvedValue({ user: { ...mockUser, status: 'deleted' } });
      jest.spyOn(UtilsService, 'comparePassword').mockResolvedValue(false);
      const data = { reset_password_token: 'token', password: 'newpassword' };
      await expect(service.resetPassword(data as any)).rejects.toThrow(NotFoundException);
    });
    it('should throw NotFoundException if password contains user details', async () => {
      jest.spyOn(service as any, 'verifyResetPasswordToken').mockResolvedValue({ user: mockUser });
      jest.spyOn(UtilsService, 'comparePassword').mockResolvedValue(false);
      const data = { reset_password_token: 'token', password: 'test@example.com' };
      await expect(service.resetPassword(data as any)).rejects.toThrow(NotFoundException);
    });
    it('should throw NotFoundException if new password matches current password', async () => {
      jest.spyOn(service as any, 'verifyResetPasswordToken').mockResolvedValue({ user: mockUser });
      jest.spyOn(UtilsService, 'comparePassword').mockResolvedValue(true);
      const data = { reset_password_token: 'token', password: 'oldpassword' };
      await expect(service.resetPassword(data as any)).rejects.toThrow(NotFoundException);
      await expect(service.resetPassword(data as any)).rejects.toThrow(
        'You cannot reuse an old password. Please choose a different password.',
      );
    });
    it('should throw InternalServerErrorException if an error occurs', async () => {
      jest.spyOn(service as any, 'verifyResetPasswordToken').mockResolvedValue({ user: mockUser });
      jest.spyOn(UtilsService, 'comparePassword').mockResolvedValue(false);
      mockUserRepository.update.mockRejectedValue(new Error('DB error'));
      const data = { reset_password_token: 'token', password: 'newpassword' };
      await expect(service.resetPassword(data as any)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('verifyCode', () => {
    it('should verify code and return resetPasswordToken', async () => {
      jest.spyOn(service as any, 'findOrThrowIfNotUserNotFound').mockResolvedValue(mockUser);
      jest.spyOn(service as any, 'findOrThrowIfCodeIsInvalid').mockResolvedValue(true);
      jest.spyOn(service as any, 'createResetPasswordToken').mockReturnValue('reset-token');
      const data = { code: '123456', email: 'test@example.com' };
      const result = await service.verifyCode(data as any);
      expect(result).toEqual({ success: true, resetPasswordToken: 'reset-token' });
    });
    it('should throw InternalServerErrorException if error occurs', async () => {
      jest.spyOn(service as any, 'findOrThrowIfNotUserNotFound').mockResolvedValue(mockUser);
      jest.spyOn(service as any, 'findOrThrowIfCodeIsInvalid').mockResolvedValue(true);
      jest.spyOn(service as any, 'createResetPasswordToken').mockImplementation(() => {
        throw new Error('fail');
      });
      const data = { code: '123456', email: 'test@example.com' };
      await expect(service.verifyCode(data as any)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('requirePasswordReset', () => {
    it('should update user and delete access tokens successfully', async () => {
      mockUserRepository.update.mockResolvedValue({});
      mockAccessTokenService.delete.mockResolvedValue({});
      await service.requirePasswordReset('user-1');
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        'user-1',
        { require_password_reset: true },
        { trx: undefined },
      );
      expect(mockAccessTokenService.delete).toHaveBeenCalledWith('user-1', undefined);
    });
    it('should throw InternalServerErrorException if an error occurs', async () => {
      mockUserRepository.update.mockRejectedValue(new Error('DB error'));
      await expect(service.requirePasswordReset('user-1')).rejects.toThrow(InternalServerErrorException);
    });
  });
});

describe('ResetPasswordController', () => {
  let controller: ResetPasswordController;
  let service: ResetPasswordService;
  const mockResetPasswordService = {
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    verifyCode: jest.fn(),
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
      controllers: [ResetPasswordController],
      providers: [
        { provide: ResetPasswordService, useValue: mockResetPasswordService },
        { provide: AppLoggerService, useValue: mockAppLoggerService },
      ],
    }).compile();
    controller = module.get<ResetPasswordController>(ResetPasswordController);
    service = module.get<ResetPasswordService>(ResetPasswordService);
  });
  describe('forgotPassword', () => {
    it('should call forgotPassword and return transformed response', async () => {
      mockResetPasswordService.forgotPassword.mockResolvedValue({ success: true });
      const dto = { email: 'test@example.com' };
      const result = await controller.forgotPassword(dto as any);
      expect(service.forgotPassword).toHaveBeenCalledWith(dto);
      expect(result).toMatchObject({ message: 'Password reset code sent', data: { success: true } });
    });
  });
  describe('resetPassword', () => {
    it('should call resetPassword and return transformed response', async () => {
      mockResetPasswordService.resetPassword.mockResolvedValue({ success: true });
      const dto = { reset_password_token: 'token', password: 'newpassword' };
      const result = await controller.resetPassword(dto as any);
      expect(service.resetPassword).toHaveBeenCalledWith(dto);
      expect(result).toMatchObject({ message: 'Successfully Reset password', data: { success: true } });
    });
  });

  describe('verifyResetPassword', () => {
    it('should call verifyCode and return transformed response', async () => {
      mockResetPasswordService.verifyCode.mockResolvedValue({ success: true, resetPasswordToken: 'reset-token' });
      const dto = { code: '123456', email: 'test@example.com' };
      const result = await controller.verifyResetPassword(dto as any);
      expect(service.verifyCode).toHaveBeenCalledWith(dto);
      expect(result).toMatchObject({
        message: 'Successfully Verified Reset Password Code',
        data: { success: true, resetPasswordToken: 'reset-token' },
      });
    });
  });
});
