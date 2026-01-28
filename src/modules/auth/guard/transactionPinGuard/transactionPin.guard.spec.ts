import { BadRequestException, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  RestrictionCategory,
  RestrictionErrorType,
  RestrictionException,
} from '../../../../exceptions/restriction_exception';
import { EventEmitterEventsEnum } from '../../../../services/eventEmitter/eventEmitter.interface';
import { EventEmitterService } from '../../../../services/eventEmitter/eventEmitter.service';
import { LockerService } from '../../../../services/locker';
import { TransactionPinService } from '../../transactionPin/transactionPin.service';
import { UserRepository } from '../../user/user.repository';
import { TransactionPinGuard } from './transactionPin.guard';

describe('TransactionPinGuard', () => {
  let guard: TransactionPinGuard;

  const mockTransactionPinService = {
    incrementFailedAttempts: jest.fn(),
    getFailedAttempts: jest.fn(),
    verifyTransactionPinWithoutThrowing: jest.fn(),
    resetFailedAttempts: jest.fn(),
    checkPinRateLimitAndLockout: jest.fn(),
    applyProgressiveLockout: jest.fn(),
    clearLockout: jest.fn(),
  } as unknown as jest.Mocked<TransactionPinService>;

  const mockLockerService = {
    withLock: jest.fn(),
  } as unknown as jest.Mocked<LockerService>;

  const mockEventEmitterService = {
    emitAsync: jest.fn(),
  } as unknown as jest.Mocked<EventEmitterService>;

  const mockUserRepository = {
    findById: jest.fn(),
  } as unknown as jest.Mocked<UserRepository>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionPinGuard,
        { provide: TransactionPinService, useValue: mockTransactionPinService },
        { provide: LockerService, useValue: mockLockerService },
        { provide: EventEmitterService, useValue: mockEventEmitterService },
        { provide: UserRepository, useValue: mockUserRepository },
      ],
    }).compile();

    guard = module.get<TransactionPinGuard>(TransactionPinGuard);

    // default lock passthrough
    (mockLockerService.withLock as any).mockImplementation(async (_key: string, callback: () => Promise<any>) => {
      return await callback();
    });

    // Override the internally constructed service with our mock
    (guard as any).transactionPinService = mockTransactionPinService;
  });

  const createMockExecutionContext = (user: any = null, body: any = {}) => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          body,
        }),
      }),
    } as unknown as ExecutionContext;
  };

  describe('canActivate', () => {
    it('throws UnauthorizedException when user is not present', async () => {
      const context = createMockExecutionContext(null);
      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('You are not authorize to access this resource'),
      );
    });

    it('throws UnauthorizedException when user id is missing', async () => {
      const context = createMockExecutionContext({});
      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('You are not authorize to access this resource'),
      );
    });

    it('throws BadRequestException when user requires transaction pin reset', async () => {
      const userId = 'user-1';
      const context = createMockExecutionContext({ id: userId }, { transaction_pin: '123456' });

      (mockUserRepository.findById as any).mockResolvedValue({
        id: userId,
        require_transaction_pin_reset: true,
        transactionPin: { pin: 'hashed-pin' },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new BadRequestException('Your transaction pin has been locked. Reset your transaction pin to continue.'),
      );

      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId, '[transactionPin]');
    });

    it('throws BadRequestException when transaction pin is not set', async () => {
      const userId = 'user-1';
      const context = createMockExecutionContext({ id: userId }, { transaction_pin: '123456' });

      (mockUserRepository.findById as any).mockResolvedValue({
        id: userId,
        require_transaction_pin_reset: false,
        transactionPin: { pin: null },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new BadRequestException('Your transaction pin has not been set. Please set your transaction pin to continue.'),
      );

      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId, '[transactionPin]');
    });

    it('throws BadRequestException when transaction_pin is missing', async () => {
      const userId = 'user-1';
      const context = createMockExecutionContext({ id: userId }, {});

      (mockUserRepository.findById as any).mockResolvedValue({
        id: userId,
        require_transaction_pin_reset: false,
        transactionPin: { pin: 'hashed-pin' },
      });
      (mockTransactionPinService.checkPinRateLimitAndLockout as any).mockResolvedValue(undefined);

      await expect(guard.canActivate(context)).rejects.toThrow(new BadRequestException('Transaction PIN is required'));

      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId, '[transactionPin]');
    });

    it('allows access when PIN is valid and resets failed attempts', async () => {
      const userId = 'user-1';
      const pin = '123456';
      const context = createMockExecutionContext({ id: userId }, { transaction_pin: pin });

      (mockUserRepository.findById as any).mockResolvedValue({
        id: userId,
        require_transaction_pin_reset: false,
        transactionPin: { pin: 'hashed-pin' },
      });
      (mockTransactionPinService.checkPinRateLimitAndLockout as any).mockResolvedValue(undefined);
      (mockTransactionPinService.getFailedAttempts as any).mockResolvedValue(0);
      (mockTransactionPinService.verifyTransactionPinWithoutThrowing as any).mockResolvedValue(true);
      (mockTransactionPinService.clearLockout as any).mockResolvedValue(undefined);

      const result = await guard.canActivate(context);

      expect(mockLockerService.withLock).toHaveBeenCalledWith(`transaction-pin:${userId}`, expect.any(Function));
      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId, '[transactionPin]');
      expect(mockTransactionPinService.checkPinRateLimitAndLockout).toHaveBeenCalledWith(userId);
      expect(mockTransactionPinService.getFailedAttempts).toHaveBeenCalledWith(userId);
      expect(mockTransactionPinService.verifyTransactionPinWithoutThrowing).toHaveBeenCalledWith(userId, pin);
      expect(mockTransactionPinService.resetFailedAttempts).toHaveBeenCalledWith(userId);
      expect(mockTransactionPinService.clearLockout).toHaveBeenCalledWith(userId);
      expect(result).toBe(true);
    });

    it('increments failed attempts and returns remaining attempts on invalid PIN', async () => {
      const userId = 'user-1';
      const pin = '111111';
      const context = createMockExecutionContext({ id: userId }, { transaction_pin: pin });

      (mockUserRepository.findById as any).mockResolvedValue({
        id: userId,
        require_transaction_pin_reset: false,
        transactionPin: { pin: 'hashed-pin' },
      });
      (mockTransactionPinService.checkPinRateLimitAndLockout as any).mockResolvedValue(undefined);
      (mockTransactionPinService.getFailedAttempts as any).mockResolvedValue(2).mockResolvedValue(3);
      (mockTransactionPinService.verifyTransactionPinWithoutThrowing as any).mockResolvedValue(false);
      (mockTransactionPinService.incrementFailedAttempts as any).mockResolvedValue(3);
      (mockTransactionPinService.applyProgressiveLockout as any).mockResolvedValue(undefined);

      await expect(guard.canActivate(context)).rejects.toThrow(
        new BadRequestException('Invalid transaction PIN. 2 attempt(s) left.'),
      );

      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId, '[transactionPin]');
      expect(mockTransactionPinService.checkPinRateLimitAndLockout).toHaveBeenCalledWith(userId);
      expect(mockTransactionPinService.verifyTransactionPinWithoutThrowing).toHaveBeenCalledWith(userId, pin);
      expect(mockTransactionPinService.incrementFailedAttempts).toHaveBeenCalledWith(userId);
      expect(mockTransactionPinService.applyProgressiveLockout).toHaveBeenCalledWith(userId, 3);
    });

    it('emits REQUIRE_TRANSACTION_PIN_RESET and throws RestrictionException when attempts reach limit', async () => {
      const userId = 'user-1';
      const pin = '111111';
      const context = createMockExecutionContext({ id: userId }, { transaction_pin: pin });

      (mockUserRepository.findById as any).mockResolvedValue({
        id: userId,
        require_transaction_pin_reset: false,
        transactionPin: { pin: 'hashed-pin' },
      });
      (mockTransactionPinService.checkPinRateLimitAndLockout as any).mockResolvedValue(undefined);
      (mockTransactionPinService.getFailedAttempts as any).mockResolvedValue(4).mockResolvedValue(5);
      (mockTransactionPinService.verifyTransactionPinWithoutThrowing as any).mockResolvedValue(false);
      (mockTransactionPinService.incrementFailedAttempts as any).mockResolvedValue(5);
      (mockTransactionPinService.applyProgressiveLockout as any).mockResolvedValue(undefined);

      try {
        await guard.canActivate(context);
        fail('Expected RestrictionException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RestrictionException);
        expect(error.type).toBe(RestrictionErrorType.ERR_USER_PIN_LOCKED);
        expect(error.restrictionCategory).toBe(RestrictionCategory.USER);
        expect(error.data.canSelfResolve).toBe(true);
      }

      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId, '[transactionPin]');
      expect(mockTransactionPinService.checkPinRateLimitAndLockout).toHaveBeenCalledWith(userId);
      expect(mockTransactionPinService.verifyTransactionPinWithoutThrowing).toHaveBeenCalledWith(userId, pin);
      expect(mockTransactionPinService.incrementFailedAttempts).toHaveBeenCalledWith(userId);
      expect(mockTransactionPinService.applyProgressiveLockout).toHaveBeenCalledWith(userId, 5);
      expect(mockEventEmitterService.emitAsync).toHaveBeenCalledWith(
        EventEmitterEventsEnum.REQUIRE_TRANSACTION_PIN_RESET,
        userId,
      );
    });
  });
});
