import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserModel } from '../../../database';
import { AccountActionCodeController } from './accountActionCode.controller';
import { AccountActionCodeService } from './accountActionCode.service';
import { AccountActionType } from './dtos/sendAccountActionCodeMail.dto';

describe('AccountActionCodeController', () => {
  let controller: AccountActionCodeController;

  const mockAccountActionCodeService = {
    createAccountActionCode: jest.fn(),
    verifyAccountActionCode: jest.fn(),
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

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountActionCodeController],
      providers: [
        {
          provide: AccountActionCodeService,
          useValue: mockAccountActionCodeService,
        },
      ],
    }).compile();

    controller = module.get<AccountActionCodeController>(AccountActionCodeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('sendAccountActionCodeMail', () => {
    it('should send account action code mail with provided action', async () => {
      const mockResponse = {
        id: 'code-1',
        user_id: 'user-1',
        email: 'test@example.com',
        type: AccountActionType.DELETE,
      };

      mockAccountActionCodeService.createAccountActionCode.mockResolvedValue(mockResponse);

      const result = await controller.sendAccountActionCodeMail(mockUser, {
        action: AccountActionType.DELETE,
      });

      expect(mockAccountActionCodeService.createAccountActionCode).toHaveBeenCalledWith(
        mockUser,
        AccountActionType.DELETE,
      );
      expect(result).toMatchObject({
        message: 'Account action verification initiated successfully',
        data: mockResponse,
        statusCode: HttpStatus.CREATED,
      });
    });

    it('should use DEACTIVATE as default action when no action provided', async () => {
      const mockResponse = {
        id: 'code-1',
        user_id: 'user-1',
        email: 'test@example.com',
        type: AccountActionType.DEACTIVATE,
      };

      mockAccountActionCodeService.createAccountActionCode.mockResolvedValue(mockResponse);

      const result = await controller.sendAccountActionCodeMail(mockUser, {} as any);

      expect(mockAccountActionCodeService.createAccountActionCode).toHaveBeenCalledWith(
        mockUser,
        AccountActionType.DEACTIVATE,
      );
      expect(result).toMatchObject({
        message: 'Account action verification initiated successfully',
        data: mockResponse,
        statusCode: HttpStatus.CREATED,
      });
    });

    it('should send CHANGE_TRANSACTION_PIN action code', async () => {
      const mockResponse = {
        id: 'code-1',
        user_id: 'user-1',
        email: 'test@example.com',
        type: AccountActionType.CHANGE_TRANSACTION_PIN,
      };

      mockAccountActionCodeService.createAccountActionCode.mockResolvedValue(mockResponse);

      const result = await controller.sendAccountActionCodeMail(mockUser, {
        action: AccountActionType.CHANGE_TRANSACTION_PIN,
      });

      expect(mockAccountActionCodeService.createAccountActionCode).toHaveBeenCalledWith(
        mockUser,
        AccountActionType.CHANGE_TRANSACTION_PIN,
      );
      expect(result.statusCode).toBe(HttpStatus.CREATED);
    });

    it('should send CHANGE_PASSWORD action code', async () => {
      const mockResponse = {
        id: 'code-1',
        user_id: 'user-1',
        email: 'test@example.com',
        type: AccountActionType.CHANGE_PASSWORD,
      };

      mockAccountActionCodeService.createAccountActionCode.mockResolvedValue(mockResponse);

      const result = await controller.sendAccountActionCodeMail(mockUser, {
        action: AccountActionType.CHANGE_PASSWORD,
      });

      expect(mockAccountActionCodeService.createAccountActionCode).toHaveBeenCalledWith(
        mockUser,
        AccountActionType.CHANGE_PASSWORD,
      );
      expect(result.statusCode).toBe(HttpStatus.CREATED);
    });

    it('should send EMAIL_VERIFICATION action code', async () => {
      const mockResponse = {
        id: 'code-1',
        user_id: 'user-1',
        email: 'test@example.com',
        type: AccountActionType.EMAIL_VERIFICATION,
      };

      mockAccountActionCodeService.createAccountActionCode.mockResolvedValue(mockResponse);

      const result = await controller.sendAccountActionCodeMail(mockUser, {
        action: AccountActionType.EMAIL_VERIFICATION,
      });

      expect(mockAccountActionCodeService.createAccountActionCode).toHaveBeenCalledWith(
        mockUser,
        AccountActionType.EMAIL_VERIFICATION,
      );
      expect(result.statusCode).toBe(HttpStatus.CREATED);
    });

    it('should send PHONE_VERIFICATION action code', async () => {
      const mockResponse = {
        id: 'code-1',
        user_id: 'user-1',
        email: 'test@example.com',
        type: AccountActionType.PHONE_VERIFICATION,
      };

      mockAccountActionCodeService.createAccountActionCode.mockResolvedValue(mockResponse);

      const result = await controller.sendAccountActionCodeMail(mockUser, {
        action: AccountActionType.PHONE_VERIFICATION,
      });

      expect(mockAccountActionCodeService.createAccountActionCode).toHaveBeenCalledWith(
        mockUser,
        AccountActionType.PHONE_VERIFICATION,
      );
      expect(result.statusCode).toBe(HttpStatus.CREATED);
    });

    it('should send TWO_FACTOR_AUTH action code', async () => {
      const mockResponse = {
        id: 'code-1',
        user_id: 'user-1',
        email: 'test@example.com',
        type: AccountActionType.TWO_FACTOR_AUTH,
      };

      mockAccountActionCodeService.createAccountActionCode.mockResolvedValue(mockResponse);

      const result = await controller.sendAccountActionCodeMail(mockUser, {
        action: AccountActionType.TWO_FACTOR_AUTH,
      });

      expect(mockAccountActionCodeService.createAccountActionCode).toHaveBeenCalledWith(
        mockUser,
        AccountActionType.TWO_FACTOR_AUTH,
      );
      expect(result.statusCode).toBe(HttpStatus.CREATED);
    });

    it('should send WITHDRAW_FUNDS action code', async () => {
      const mockResponse = {
        id: 'code-1',
        user_id: 'user-1',
        email: 'test@example.com',
        type: AccountActionType.WITHDRAW_FUNDS,
      };

      mockAccountActionCodeService.createAccountActionCode.mockResolvedValue(mockResponse);

      const result = await controller.sendAccountActionCodeMail(mockUser, {
        action: AccountActionType.WITHDRAW_FUNDS,
      });

      expect(mockAccountActionCodeService.createAccountActionCode).toHaveBeenCalledWith(
        mockUser,
        AccountActionType.WITHDRAW_FUNDS,
      );
      expect(result.statusCode).toBe(HttpStatus.CREATED);
    });
  });

  describe('verifyCode', () => {
    it('should verify account action code successfully', async () => {
      mockAccountActionCodeService.verifyAccountActionCode.mockResolvedValue(true);

      const result = await controller.verifyCode(mockUser, { code: 'ABC123' });

      expect(mockAccountActionCodeService.verifyAccountActionCode).toHaveBeenCalledWith('ABC123', mockUser);
      expect(result).toMatchObject({
        message: 'Account action code verified successfully',
        data: true,
        statusCode: HttpStatus.OK,
      });
    });

    it('should handle verification failure', async () => {
      mockAccountActionCodeService.verifyAccountActionCode.mockRejectedValue(new Error('Invalid code'));

      await expect(controller.verifyCode(mockUser, { code: 'INVALID' })).rejects.toThrow('Invalid code');
    });
  });
});
