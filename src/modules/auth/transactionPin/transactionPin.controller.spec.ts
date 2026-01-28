import { BadRequestException, ConflictException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserModel } from '../../../database/models/user/user.model';
import { ChangePinDto } from './dtos/changePin.dto';
import { SetPinDto } from './dtos/setPin.dto';
import { ValidateTransactionPinDto } from './dtos/validateTransactionPin.dto';
import { TransactionPinController } from './transactionPin.controller';
import { TransactionPinService } from './transactionPin.service';

describe('TransactionPinController', () => {
  let controller: TransactionPinController;
  let transactionPinService: jest.Mocked<TransactionPinService>;

  const mockUser: UserModel = {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    first_name: 'Test',
    last_name: 'User',
    phone_number: '1234567890',
    is_email_verified: true,
    status: 'active',
  } as UserModel;

  beforeEach(async () => {
    const mockTransactionPinService = {
      setPin: jest.fn(),
      changePin: jest.fn(),
      validateTransactionPin: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionPinController],
      providers: [
        {
          provide: TransactionPinService,
          useValue: mockTransactionPinService,
        },
      ],
    }).compile();

    controller = module.get<TransactionPinController>(TransactionPinController);
    transactionPinService = module.get(TransactionPinService);
  });

  describe('setTransactionPin', () => {
    it('should set transaction PIN successfully', async () => {
      const dto: SetPinDto = {
        pin: '123456',
        confirm_pin: '123456',
      };

      transactionPinService.setPin.mockResolvedValue(true);

      const result = await controller.setTransactionPin(mockUser, dto);

      expect(transactionPinService.setPin).toHaveBeenCalledWith(mockUser.id, dto);
      expect(result).toMatchObject({
        message: 'Transaction PIN set successfully',
        data: true,
        statusCode: HttpStatus.OK,
      });
    });

    it('should handle ConflictException when PIN already exists', async () => {
      const dto: SetPinDto = {
        pin: '123456',
        confirm_pin: '123456',
      };

      transactionPinService.setPin.mockRejectedValue(new ConflictException('Transaction PIN already set'));

      await expect(controller.setTransactionPin(mockUser, dto)).rejects.toThrow(ConflictException);
      expect(transactionPinService.setPin).toHaveBeenCalledWith(mockUser.id, dto);
    });

    it('should handle BadRequestException when validation fails', async () => {
      const dto: SetPinDto = {
        pin: '123456',
        confirm_pin: '123456',
      };

      transactionPinService.setPin.mockRejectedValue(new BadRequestException('Transaction PIN already set'));

      await expect(controller.setTransactionPin(mockUser, dto)).rejects.toThrow(BadRequestException);
      expect(transactionPinService.setPin).toHaveBeenCalledWith(mockUser.id, dto);
    });
  });

  describe('changeTransactionPin', () => {
    it('should change transaction PIN successfully', async () => {
      const dto: ChangePinDto = {
        old_pin: '123456',
        pin: '654321',
        confirm_pin: '654321',
      };

      transactionPinService.changePin.mockResolvedValue(true);

      const result = await controller.changeTransactionPin(mockUser, dto);

      expect(transactionPinService.changePin).toHaveBeenCalledWith(mockUser.id, dto);
      expect(result).toMatchObject({
        message: 'Transaction PIN changed successfully',
        data: true,
        statusCode: HttpStatus.OK,
      });
    });

    it('should handle BadRequestException when old PIN is incorrect', async () => {
      const dto: ChangePinDto = {
        old_pin: '123456',
        pin: '654321',
        confirm_pin: '654321',
      };

      transactionPinService.changePin.mockRejectedValue(new BadRequestException('Old PIN is incorrect'));

      await expect(controller.changeTransactionPin(mockUser, dto)).rejects.toThrow(BadRequestException);
      expect(transactionPinService.changePin).toHaveBeenCalledWith(mockUser.id, dto);
    });

    it('should handle BadRequestException when PIN not set', async () => {
      const dto: ChangePinDto = {
        old_pin: '123456',
        pin: '654321',
        confirm_pin: '654321',
      };

      transactionPinService.changePin.mockRejectedValue(
        new BadRequestException('Transaction PIN not set for this user'),
      );

      await expect(controller.changeTransactionPin(mockUser, dto)).rejects.toThrow(BadRequestException);
      expect(transactionPinService.changePin).toHaveBeenCalledWith(mockUser.id, dto);
    });

    it('should handle BadRequestException when new PIN is same as old PIN', async () => {
      const dto: ChangePinDto = {
        old_pin: '123456',
        pin: '123456',
        confirm_pin: '123456',
      };

      transactionPinService.changePin.mockRejectedValue(
        new BadRequestException('New PIN must be different from old PIN'),
      );

      await expect(controller.changeTransactionPin(mockUser, dto)).rejects.toThrow(BadRequestException);
      expect(transactionPinService.changePin).toHaveBeenCalledWith(mockUser.id, dto);
    });
  });

  describe('validateTransactionPin', () => {
    it('should validate transaction PIN successfully with isValid true', async () => {
      const dto: ValidateTransactionPinDto = {
        pin: '123456',
      };

      transactionPinService.validateTransactionPin.mockResolvedValue({ isValid: true });

      const result = await controller.validateTransactionPin(mockUser, dto);

      expect(transactionPinService.validateTransactionPin).toHaveBeenCalledWith(mockUser.id, dto.pin);
      expect(result).toMatchObject({
        message: 'Transaction PIN validated',
        data: { isValid: true },
        statusCode: HttpStatus.OK,
      });
    });

    it('should validate transaction PIN successfully with isValid false', async () => {
      const dto: ValidateTransactionPinDto = {
        pin: '123456',
      };

      transactionPinService.validateTransactionPin.mockResolvedValue({ isValid: false });

      const result = await controller.validateTransactionPin(mockUser, dto);

      expect(transactionPinService.validateTransactionPin).toHaveBeenCalledWith(mockUser.id, dto.pin);
      expect(result).toMatchObject({
        message: 'Transaction PIN validated',
        data: { isValid: false },
        statusCode: HttpStatus.OK,
      });
    });

    it('should handle BadRequestException when validation fails', async () => {
      const dto: ValidateTransactionPinDto = {
        pin: '123456',
      };

      transactionPinService.validateTransactionPin.mockRejectedValue(
        new BadRequestException('Failed to validate transaction PIN'),
      );

      await expect(controller.validateTransactionPin(mockUser, dto)).rejects.toThrow(BadRequestException);
      expect(transactionPinService.validateTransactionPin).toHaveBeenCalledWith(mockUser.id, dto.pin);
    });

    it('should handle service errors gracefully', async () => {
      const dto: ValidateTransactionPinDto = {
        pin: '123456',
      };

      transactionPinService.validateTransactionPin.mockRejectedValue(new Error('Unexpected error'));

      await expect(controller.validateTransactionPin(mockUser, dto)).rejects.toThrow(Error);
      expect(transactionPinService.validateTransactionPin).toHaveBeenCalledWith(mockUser.id, dto.pin);
    });
  });
});
