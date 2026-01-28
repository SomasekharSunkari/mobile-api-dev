import { InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DateTime } from 'luxon';
import { UserModel } from '../../../database';
import { AccountRestrictionMail } from '../../../notifications/mails/account_deactivation_mail';
import { AccountDeleteCodeMail } from '../../../notifications/mails/account_delete_code_mail';
import { ChangePasswordCodeMail } from '../../../notifications/mails/change_password_code_mail';
import { ChangeTransactionPinCodeMail } from '../../../notifications/mails/change_transaction_pin_code_mail';
import { EmailVerificationCodeMail } from '../../../notifications/mails/email_verification_code_mail';
import { PhoneVerificationCodeMail } from '../../../notifications/mails/phone_verification_code_mail';
import { ResetPasswordMail } from '../../../notifications/mails/reset_password_mail';
import { ResetTransactionPinMail } from '../../../notifications/mails/reset_transaction_pin_mail';
import { TwoFactorAuthCodeMail } from '../../../notifications/mails/two_factor_auth_code_mail';
import { WithdrawFundsCodeMail } from '../../../notifications/mails/withdraw_funds_code_mail';
import { MailerService } from '../../../services/queue/processors/mailer/mailer.service';
import { UtilsService } from '../../../utils/utils.service';
import { AccountActionCodeRepository } from './accountActionCode.repository';
import { AccountActionCodeService } from './accountActionCode.service';
import { AccountActionType } from './dtos/sendAccountActionCodeMail.dto';

jest.mock('../../../notifications/mails/account_deactivation_mail');
jest.mock('../../../notifications/mails/account_delete_code_mail');
jest.mock('../../../notifications/mails/change_password_code_mail');
jest.mock('../../../notifications/mails/change_transaction_pin_code_mail');
jest.mock('../../../notifications/mails/email_verification_code_mail');
jest.mock('../../../notifications/mails/phone_verification_code_mail');
jest.mock('../../../notifications/mails/reset_password_mail');
jest.mock('../../../notifications/mails/reset_transaction_pin_mail');
jest.mock('../../../notifications/mails/two_factor_auth_code_mail');
jest.mock('../../../notifications/mails/withdraw_funds_code_mail');

describe('AccountActionCodeService', () => {
  let service: AccountActionCodeService;

  const mockAccountActionCodeRepository = {
    findSync: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
  };

  const mockMailerService = {
    send: jest.fn(),
  };

  const mockUser: UserModel = {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
    first_name: 'Test',
    last_name: 'User',
  } as UserModel;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(UtilsService, 'generateCode').mockReturnValue('ABC123');
    jest.spyOn(UtilsService, 'hashPassword').mockResolvedValue('hashed-code');
    jest.spyOn(UtilsService, 'comparePassword').mockResolvedValue(true);
    (DateTime.now as any) = () => DateTime.fromISO('2025-05-27T00:00:00Z');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountActionCodeService,
        { provide: AccountActionCodeRepository, useValue: mockAccountActionCodeRepository },
        { provide: MailerService, useValue: mockMailerService },
      ],
    }).compile();

    service = module.get<AccountActionCodeService>(AccountActionCodeService);
  });

  describe('createAccountActionCode', () => {
    it('should create a new account action code when none exists', async () => {
      mockAccountActionCodeRepository.findSync.mockResolvedValue(null);
      mockAccountActionCodeRepository.create.mockResolvedValue({
        id: 'code-1',
        user_id: 'user-1',
        code: 'hashed-code',
        expires_at: '2025-05-27T00:05:00Z',
        type: 'deactivate',
      });

      const result = await service.createAccountActionCode(mockUser);

      expect(mockAccountActionCodeRepository.findSync).toHaveBeenCalledWith({
        user_id: 'user-1',
        is_used: false,
      });
      expect(UtilsService.generateCode).toHaveBeenCalledWith(6);
      expect(UtilsService.hashPassword).toHaveBeenCalledWith('ABC123');
      expect(mockAccountActionCodeRepository.create).toHaveBeenCalledWith({
        user_id: 'user-1',
        email: 'test@example.com',
        code: 'hashed-code',
        expires_at: expect.any(String),
        type: 'deactivate',
      });
      expect(mockMailerService.send).toHaveBeenCalledWith(expect.any(AccountRestrictionMail));
      expect(result).toHaveProperty('id', 'code-1');
    });

    it('should update existing code expiration when code already exists', async () => {
      const existingCode = {
        id: 'existing-code-1',
        user_id: 'user-1',
        code: 'old-hashed-code',
        expires_at: '2025-05-27T00:00:00Z',
      };

      mockAccountActionCodeRepository.findSync.mockResolvedValue(existingCode);
      mockAccountActionCodeRepository.update.mockResolvedValue(undefined);
      mockAccountActionCodeRepository.create.mockResolvedValue({
        id: 'code-2',
        user_id: 'user-1',
        code: 'new-hashed-code',
        expires_at: '2025-05-27T00:05:00Z',
        type: 'deactivate',
      });

      const result = await service.createAccountActionCode(mockUser);

      expect(mockAccountActionCodeRepository.update).toHaveBeenCalledWith('user-1', {
        expires_at: expect.any(String),
      });
      expect(mockAccountActionCodeRepository.create).toHaveBeenCalled();
      expect(result).toHaveProperty('id', 'code-2');
    });

    it('should throw InternalServerErrorException if an error occurs', async () => {
      mockAccountActionCodeRepository.findSync.mockRejectedValue(new Error('DB error'));

      await expect(service.createAccountActionCode(mockUser)).rejects.toThrow(InternalServerErrorException);
    });

    it('should send AccountDeleteCodeMail when action is delete', async () => {
      mockAccountActionCodeRepository.findSync.mockResolvedValue(null);
      mockAccountActionCodeRepository.create.mockResolvedValue({
        id: 'code-1',
        user_id: 'user-1',
        code: 'hashed-code',
        expires_at: '2025-05-27T00:05:00Z',
        type: 'delete',
      });

      await service.createAccountActionCode(mockUser, AccountActionType.DELETE);

      expect(mockMailerService.send).toHaveBeenCalledWith(expect.any(AccountDeleteCodeMail));
    });

    it('should send AccountRestrictionMail when action is deactivate', async () => {
      mockAccountActionCodeRepository.findSync.mockResolvedValue(null);
      mockAccountActionCodeRepository.create.mockResolvedValue({
        id: 'code-1',
        user_id: 'user-1',
        code: 'hashed-code',
        expires_at: '2025-05-27T00:05:00Z',
        type: 'deactivate',
      });

      await service.createAccountActionCode(mockUser, AccountActionType.DEACTIVATE);

      expect(mockMailerService.send).toHaveBeenCalledWith(expect.any(AccountRestrictionMail));
    });

    it('should send AccountRestrictionMail by default when no action is provided', async () => {
      mockAccountActionCodeRepository.findSync.mockResolvedValue(null);
      mockAccountActionCodeRepository.create.mockResolvedValue({
        id: 'code-1',
        user_id: 'user-1',
        code: 'hashed-code',
        expires_at: '2025-05-27T00:05:00Z',
        type: 'deactivate',
      });

      await service.createAccountActionCode(mockUser);

      expect(mockMailerService.send).toHaveBeenCalledWith(expect.any(AccountRestrictionMail));
    });

    it('should send AccountRestrictionMail when action is ACCOUNT_DEACTIVATION', async () => {
      mockAccountActionCodeRepository.findSync.mockResolvedValue(null);
      mockAccountActionCodeRepository.create.mockResolvedValue({
        id: 'code-1',
        user_id: 'user-1',
        code: 'hashed-code',
        expires_at: '2025-05-27T00:05:00Z',
        type: 'account_deactivation',
      });

      await service.createAccountActionCode(mockUser, AccountActionType.ACCOUNT_DEACTIVATION);

      expect(mockMailerService.send).toHaveBeenCalledWith(expect.any(AccountRestrictionMail));
    });

    it('should send ChangeTransactionPinCodeMail when action is CHANGE_TRANSACTION_PIN', async () => {
      mockAccountActionCodeRepository.findSync.mockResolvedValue(null);
      mockAccountActionCodeRepository.create.mockResolvedValue({
        id: 'code-1',
        user_id: 'user-1',
        code: 'hashed-code',
        expires_at: '2025-05-27T00:05:00Z',
        type: 'change_transaction_pin',
      });

      await service.createAccountActionCode(mockUser, AccountActionType.CHANGE_TRANSACTION_PIN);

      expect(mockMailerService.send).toHaveBeenCalledWith(expect.any(ChangeTransactionPinCodeMail));
    });

    it('should send ChangePasswordCodeMail when action is CHANGE_PASSWORD', async () => {
      mockAccountActionCodeRepository.findSync.mockResolvedValue(null);
      mockAccountActionCodeRepository.create.mockResolvedValue({
        id: 'code-1',
        user_id: 'user-1',
        code: 'hashed-code',
        expires_at: '2025-05-27T00:05:00Z',
        type: 'change_password',
      });

      await service.createAccountActionCode(mockUser, AccountActionType.CHANGE_PASSWORD);

      expect(mockMailerService.send).toHaveBeenCalledWith(expect.any(ChangePasswordCodeMail));
    });

    it('should send EmailVerificationCodeMail when action is EMAIL_VERIFICATION', async () => {
      mockAccountActionCodeRepository.findSync.mockResolvedValue(null);
      mockAccountActionCodeRepository.create.mockResolvedValue({
        id: 'code-1',
        user_id: 'user-1',
        code: 'hashed-code',
        expires_at: '2025-05-27T00:05:00Z',
        type: 'email_verification',
      });

      await service.createAccountActionCode(mockUser, AccountActionType.EMAIL_VERIFICATION);

      expect(mockMailerService.send).toHaveBeenCalledWith(expect.any(EmailVerificationCodeMail));
    });

    it('should send PhoneVerificationCodeMail when action is PHONE_VERIFICATION', async () => {
      mockAccountActionCodeRepository.findSync.mockResolvedValue(null);
      mockAccountActionCodeRepository.create.mockResolvedValue({
        id: 'code-1',
        user_id: 'user-1',
        code: 'hashed-code',
        expires_at: '2025-05-27T00:05:00Z',
        type: 'phone_verification',
      });

      await service.createAccountActionCode(mockUser, AccountActionType.PHONE_VERIFICATION);

      expect(mockMailerService.send).toHaveBeenCalledWith(expect.any(PhoneVerificationCodeMail));
    });

    it('should send TwoFactorAuthCodeMail when action is TWO_FACTOR_AUTH', async () => {
      mockAccountActionCodeRepository.findSync.mockResolvedValue(null);
      mockAccountActionCodeRepository.create.mockResolvedValue({
        id: 'code-1',
        user_id: 'user-1',
        code: 'hashed-code',
        expires_at: '2025-05-27T00:05:00Z',
        type: 'two_factor_auth',
      });

      await service.createAccountActionCode(mockUser, AccountActionType.TWO_FACTOR_AUTH);

      expect(mockMailerService.send).toHaveBeenCalledWith(expect.any(TwoFactorAuthCodeMail));
    });

    it('should send WithdrawFundsCodeMail when action is WITHDRAW_FUNDS', async () => {
      mockAccountActionCodeRepository.findSync.mockResolvedValue(null);
      mockAccountActionCodeRepository.create.mockResolvedValue({
        id: 'code-1',
        user_id: 'user-1',
        code: 'hashed-code',
        expires_at: '2025-05-27T00:05:00Z',
        type: 'withdraw_funds',
      });

      await service.createAccountActionCode(mockUser, AccountActionType.WITHDRAW_FUNDS);

      expect(mockMailerService.send).toHaveBeenCalledWith(expect.any(WithdrawFundsCodeMail));
    });

    it('should send ResetPasswordMail when action is RESET_PASSWORD', async () => {
      mockAccountActionCodeRepository.findSync.mockResolvedValue(null);
      mockAccountActionCodeRepository.create.mockResolvedValue({
        id: 'code-1',
        user_id: 'user-1',
        code: 'hashed-code',
        expires_at: '2025-05-27T00:05:00Z',
        type: 'reset_password',
      });

      await service.createAccountActionCode(mockUser, AccountActionType.RESET_PASSWORD);

      expect(mockMailerService.send).toHaveBeenCalledWith(expect.any(ResetPasswordMail));
    });

    it('should send ResetTransactionPinMail when action is RESET_TRANSACTION_PIN', async () => {
      mockAccountActionCodeRepository.findSync.mockResolvedValue(null);
      mockAccountActionCodeRepository.create.mockResolvedValue({
        id: 'code-1',
        user_id: 'user-1',
        code: 'hashed-code',
        expires_at: '2025-05-27T00:05:00Z',
        type: 'reset_transaction_pin',
      });

      await service.createAccountActionCode(mockUser, AccountActionType.RESET_TRANSACTION_PIN);

      expect(mockMailerService.send).toHaveBeenCalledWith(expect.any(ResetTransactionPinMail));
    });

    it('should not send mail when action returns null', async () => {
      mockAccountActionCodeRepository.findSync.mockResolvedValue(null);
      mockAccountActionCodeRepository.create.mockResolvedValue({
        id: 'code-1',
        user_id: 'user-1',
        code: 'hashed-code',
        expires_at: '2025-05-27T00:05:00Z',
        type: 'unknown',
      });

      // Using an unknown action type that will return null
      await service.createAccountActionCode(mockUser, 'unknown' as AccountActionType);

      expect(mockMailerService.send).not.toHaveBeenCalled();
    });
  });

  describe('verifyAccountActionCode', () => {
    it('should return true for valid code', async () => {
      const mockCode = {
        id: 'code-1',
        user_id: 'user-1',
        code: 'hashed-code',
        expires_at: '2025-05-27T00:10:00Z',
        used_at: null,
        is_used: false,
      };

      mockAccountActionCodeRepository.findOne.mockResolvedValue(mockCode);
      jest.spyOn(UtilsService, 'comparePassword').mockResolvedValue(true);

      const result = await service.verifyAccountActionCode('ABC123', mockUser);

      expect(result).toBe(true);
      expect(mockAccountActionCodeRepository.findOne).toHaveBeenCalledWith({
        user_id: 'user-1',
      });
      expect(UtilsService.comparePassword).toHaveBeenCalledWith('ABC123', 'hashed-code');
    });

    it('should throw NotFoundException if code not found', async () => {
      mockAccountActionCodeRepository.findOne.mockResolvedValue(null);

      await expect(service.verifyAccountActionCode('ABC123', mockUser)).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException if code is expired', async () => {
      const expiredCode = {
        id: 'code-1',
        user_id: 'user-1',
        code: 'hashed-code',
        expires_at: '2020-01-01T00:00:00Z', // Expired date
        used_at: null,
        is_used: false,
      };

      mockAccountActionCodeRepository.findOne.mockResolvedValue(expiredCode);

      await expect(service.verifyAccountActionCode('ABC123', mockUser)).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException if code is already used (used_at set)', async () => {
      const usedCode = {
        id: 'code-1',
        user_id: 'user-1',
        code: 'hashed-code',
        expires_at: '2025-05-27T00:10:00Z',
        used_at: '2025-05-27T00:05:00Z',
        is_used: false,
      };

      mockAccountActionCodeRepository.findOne.mockResolvedValue(usedCode);

      await expect(service.verifyAccountActionCode('ABC123', mockUser)).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException if code is_used is true', async () => {
      const usedCode = {
        id: 'code-1',
        user_id: 'user-1',
        code: 'hashed-code',
        expires_at: '2025-05-27T00:10:00Z',
        used_at: null,
        is_used: true,
      };

      mockAccountActionCodeRepository.findOne.mockResolvedValue(usedCode);

      await expect(service.verifyAccountActionCode('ABC123', mockUser)).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException if code comparison fails', async () => {
      const mockCode = {
        id: 'code-1',
        user_id: 'user-1',
        code: 'hashed-code',
        expires_at: '2025-05-27T00:10:00Z',
        used_at: null,
        is_used: false,
      };

      mockAccountActionCodeRepository.findOne.mockResolvedValue(mockCode);
      jest.spyOn(UtilsService, 'comparePassword').mockResolvedValue(false);

      await expect(service.verifyAccountActionCode('INVALID', mockUser)).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException if verification fails', async () => {
      mockAccountActionCodeRepository.findOne.mockRejectedValue(new Error('DB error'));

      await expect(service.verifyAccountActionCode('ABC123', mockUser)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('handleSuccessfulAccountAction', () => {
    it('should update account action code to used', async () => {
      const mockTransaction = { trx: 'transaction' };
      mockAccountActionCodeRepository.update.mockResolvedValue(undefined);

      await service.handleSuccessfulAccountAction(mockUser, mockTransaction as any);

      expect(mockAccountActionCodeRepository.update).toHaveBeenCalledWith(
        'user-1',
        {
          is_used: true,
          used_at: expect.any(String),
        },
        { trx: mockTransaction },
      );
    });

    it('should throw InternalServerErrorException if update fails', async () => {
      const mockTransaction = { trx: 'transaction' };
      mockAccountActionCodeRepository.update.mockRejectedValue(new Error('DB error'));

      await expect(service.handleSuccessfulAccountAction(mockUser, mockTransaction as any)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
