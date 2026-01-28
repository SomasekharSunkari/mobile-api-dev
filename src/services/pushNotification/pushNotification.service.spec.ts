import { Test, TestingModule } from '@nestjs/testing';
import { FirebaseService } from './firebase/firebase.service';
import { PushNotificationService } from './pushNotification.service';

describe('PushNotificationService', () => {
  let service: PushNotificationService;
  let firebaseService: jest.Mocked<FirebaseService>;

  const mockFirebaseService = {
    sendPushNotification: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushNotificationService,
        {
          provide: FirebaseService,
          useValue: mockFirebaseService,
        },
      ],
    }).compile();

    service = module.get<PushNotificationService>(PushNotificationService);
    firebaseService = module.get<jest.Mocked<FirebaseService>>(FirebaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendPushNotification', () => {
    it('should call firebase service with valid tokens', async () => {
      const tokens = ['token1', 'token2'];
      const notification = { title: 'Test', body: 'Test body' };

      await service.sendPushNotification(tokens, notification);

      expect(firebaseService.sendPushNotification).toHaveBeenCalledWith(tokens, notification);
    });

    it('should filter out non-string tokens', async () => {
      const tokens = ['token1', null, 'token2', undefined, 123] as any;
      const notification = { title: 'Test', body: 'Test body' };

      await service.sendPushNotification(tokens, notification);

      expect(firebaseService.sendPushNotification).toHaveBeenCalledWith(['token1', 'token2'], notification);
    });

    it('should handle empty token array', async () => {
      const tokens: string[] = [];
      const notification = { title: 'Test', body: 'Test body' };

      await service.sendPushNotification(tokens, notification);

      expect(firebaseService.sendPushNotification).toHaveBeenCalledWith([], notification);
    });
  });

  describe('getTransactionPushNotificationConfig', () => {
    describe('USD Deposit', () => {
      it('should return correct config for USD deposit', () => {
        const result = service.getTransactionPushNotificationConfig('deposit', '100.00', 'USD');

        expect(result).toEqual({
          title: 'USD Deposit',
          body: 'Added $100.00 USDC to your US wallet.',
        });
      });

      it('should strip symbol if already present in formattedAmount', () => {
        const result = service.getTransactionPushNotificationConfig('deposit', '$100.00', 'USD');

        expect(result).toEqual({
          title: 'USD Deposit',
          body: 'Added $100.00 USDC to your US wallet.',
        });
      });
    });

    describe('NGN Deposit', () => {
      it('should return correct config for NGN deposit', () => {
        const result = service.getTransactionPushNotificationConfig('deposit', '50,000.00', 'NGN');

        expect(result).toEqual({
          title: 'NGN Deposit',
          body: 'Added ₦50,000.00 to your NGN wallet.',
        });
      });

      it('should strip symbol if already present', () => {
        const result = service.getTransactionPushNotificationConfig('deposit', '₦50,000.00', 'NGN');

        expect(result).toEqual({
          title: 'NGN Deposit',
          body: 'Added ₦50,000.00 to your NGN wallet.',
        });
      });
    });

    describe('USD Withdrawal', () => {
      it('should return correct config for USD withdrawal', () => {
        const result = service.getTransactionPushNotificationConfig('withdrawal', '50.00', 'USD');

        expect(result).toEqual({
          title: 'USD Withdraw',
          body: 'You have withdrawn $50.00 to your bank',
        });
      });

      it('should ignore recipientName for USD withdrawals', () => {
        const result = service.getTransactionPushNotificationConfig('withdrawal', '50.00', 'USD', 'John Doe');

        expect(result).toEqual({
          title: 'USD Withdraw',
          body: 'You have withdrawn $50.00 to your bank',
        });
      });
    });

    describe('NGN Withdrawal', () => {
      it('should return correct config for NGN withdrawal with recipient', () => {
        const result = service.getTransactionPushNotificationConfig('withdrawal', '3,000.00', 'NGN', 'Test Customer');

        expect(result).toEqual({
          title: 'NGN withdraw',
          body: "You sent ₦3,000.00 to Test Customer's bank account",
        });
      });

      it('should return correct config for NGN withdrawal without recipient', () => {
        const result = service.getTransactionPushNotificationConfig('withdrawal', '3,000.00', 'NGN');

        expect(result).toEqual({
          title: 'NGN withdraw',
          body: 'You sent ₦3,000.00 to your bank',
        });
      });
    });

    describe('Withdrawal Initiated', () => {
      it('should return correct config for withdrawal initiated with USD', () => {
        const result = service.getTransactionPushNotificationConfig('withdrawal_initiated', '100.00', 'USD');

        expect(result).toEqual({
          title: 'Withdrawal Initiated',
          body: 'Your withdrawal of $100.00 has been initiated and funds have been reserved.',
        });
      });

      it('should return correct config for withdrawal initiated with NGN', () => {
        const result = service.getTransactionPushNotificationConfig('withdrawal_initiated', '3,000.00', 'NGN');

        expect(result).toEqual({
          title: 'Withdrawal Initiated',
          body: 'Your withdrawal of ₦3,000.00 has been initiated and funds have been reserved.',
        });
      });
    });

    describe('USD Transfer In', () => {
      it('should return correct config for USD transfer in with sender name', () => {
        const result = service.getTransactionPushNotificationConfig('transfer_in', '200.00', 'USD', undefined, 'Juwon');

        expect(result).toEqual({
          title: 'Transfer',
          body: "You've received $200.00 USDC from Juwon",
        });
      });

      it('should use default sender name when not provided', () => {
        const result = service.getTransactionPushNotificationConfig('transfer_in', '200.00', 'USD');

        expect(result).toEqual({
          title: 'Transfer',
          body: "You've received $200.00 USDC from another user",
        });
      });
    });

    describe('NGN Transfer In', () => {
      it('should return correct config for NGN transfer in with sender name', () => {
        const result = service.getTransactionPushNotificationConfig(
          'transfer_in',
          '2,500.00',
          'NGN',
          undefined,
          'Kyle Harmon',
        );

        expect(result).toEqual({
          title: 'Transfer',
          body: "You've received ₦2,500.00 from Kyle Harmon",
        });
      });

      it('should use default sender name when not provided', () => {
        const result = service.getTransactionPushNotificationConfig('transfer_in', '2,500.00', 'NGN');

        expect(result).toEqual({
          title: 'Transfer',
          body: "You've received ₦2,500.00 from another user",
        });
      });
    });

    describe('USD Transfer Out', () => {
      it('should return correct config for USD transfer out with recipient name', () => {
        const result = service.getTransactionPushNotificationConfig('transfer_out', '500.00', 'USD', 'Thelma');

        expect(result).toEqual({
          title: 'Transfer',
          body: 'You sent $500.00 USDC to Thelma',
        });
      });

      it('should use default recipient name when not provided', () => {
        const result = service.getTransactionPushNotificationConfig('transfer_out', '500.00', 'USD');

        expect(result).toEqual({
          title: 'Transfer',
          body: 'You sent $500.00 USDC to another user',
        });
      });
    });

    describe('NGN Transfer Out', () => {
      it('should return correct config for NGN transfer out with recipient name', () => {
        const result = service.getTransactionPushNotificationConfig('transfer_out', '162,000.00', 'NGN', 'Somto');

        expect(result).toEqual({
          title: 'Transfer',
          body: 'You sent ₦162,000.00 to Somto',
        });
      });

      it('should use default recipient name when not provided', () => {
        const result = service.getTransactionPushNotificationConfig('transfer_out', '162,000.00', 'NGN');

        expect(result).toEqual({
          title: 'Transfer',
          body: 'You sent ₦162,000.00 to another user',
        });
      });
    });

    describe('USD Exchange', () => {
      it('should return correct config for USD exchange', () => {
        const result = service.getTransactionPushNotificationConfig('exchange', '100.00', 'USD');

        expect(result).toEqual({
          title: 'Exchange',
          body: '$100.00 USDC has been successfully exchanged',
        });
      });
    });

    describe('NGN Exchange', () => {
      it('should return correct config for NGN exchange', () => {
        const result = service.getTransactionPushNotificationConfig('exchange', '750,000.00', 'NGN');

        expect(result).toEqual({
          title: 'Exchange',
          body: '₦750,000.00 NGN has been successfully exchanged',
        });
      });
    });

    describe('Reward', () => {
      it('should return correct config for reward', () => {
        const result = service.getTransactionPushNotificationConfig('reward', '10.00', 'USD');

        expect(result).toEqual({
          title: 'Reward Received!',
          body: 'You received a $10.00 USDC deposit reward for your first deposit.',
        });
      });
    });

    describe('Default/Unknown Transaction Type', () => {
      it('should return default config for unknown transaction type with USD', () => {
        const result = service.getTransactionPushNotificationConfig('unknown_type', '15.50', 'USD');

        expect(result).toEqual({
          title: 'Transaction Completed',
          body: 'Your $15.50 transaction has been completed successfully.',
        });
      });

      it('should return default config for unknown transaction type with NGN', () => {
        const result = service.getTransactionPushNotificationConfig('unknown_type', '5,000.00', 'NGN');

        expect(result).toEqual({
          title: 'Transaction Completed',
          body: 'Your ₦5,000.00 transaction has been completed successfully.',
        });
      });
    });

    describe('Edge Cases', () => {
      it('should handle null asset', () => {
        const result = service.getTransactionPushNotificationConfig('deposit', '100.00', null as any);

        expect(result).toEqual({
          title: 'Deposit',
          body: 'Added 100.00 to your wallet.',
        });
      });

      it('should handle undefined asset', () => {
        const result = service.getTransactionPushNotificationConfig('deposit', '100.00', undefined as any);

        expect(result).toEqual({
          title: 'Deposit',
          body: 'Added 100.00 to your wallet.',
        });
      });

      it('should handle empty asset', () => {
        const result = service.getTransactionPushNotificationConfig('deposit', '100.00', '');

        expect(result).toEqual({
          title: 'Deposit',
          body: 'Added 100.00 to your wallet.',
        });
      });

      it('should handle unsupported currency', () => {
        const result = service.getTransactionPushNotificationConfig('deposit', '100.00', 'EUR');

        expect(result).toEqual({
          title: 'Deposit',
          body: 'Added 100.00 to your wallet.',
        });
      });

      it('should handle withdrawal with null asset', () => {
        const result = service.getTransactionPushNotificationConfig('withdrawal', '50.00', null as any);

        expect(result).toEqual({
          title: 'Withdrawal',
          body: 'You have withdrawn 50.00 to your bank',
        });
      });

      it('should handle transfer_in with empty sender name', () => {
        const result = service.getTransactionPushNotificationConfig('transfer_in', '200.00', 'USD', undefined, '');

        expect(result).toEqual({
          title: 'Transfer',
          body: "You've received $200.00 USDC from ",
        });
      });

      it('should handle transfer_out with empty recipient name', () => {
        const result = service.getTransactionPushNotificationConfig('transfer_out', '500.00', 'NGN', '');

        expect(result).toEqual({
          title: 'Transfer',
          body: 'You sent ₦500.00 to ',
        });
      });

      it('should handle exchange with unsupported currency', () => {
        const result = service.getTransactionPushNotificationConfig('exchange', '200.00', 'GBP');

        expect(result).toEqual({
          title: 'Exchange',
          body: '200.00 GBP has been successfully exchanged',
        });
      });
    });

    describe('Symbol Stripping', () => {
      it('should strip USD symbol from formattedAmount', () => {
        const result = service.getTransactionPushNotificationConfig('deposit', '$100.00', 'USD');

        expect(result.body).toBe('Added $100.00 USDC to your US wallet.');
        expect(result.body).not.toContain('$$');
      });

      it('should strip NGN symbol from formattedAmount', () => {
        const result = service.getTransactionPushNotificationConfig('deposit', '₦50,000.00', 'NGN');

        expect(result.body).toBe('Added ₦50,000.00 to your NGN wallet.');
        expect(result.body).not.toContain('₦₦');
      });

      it('should not double-strip if symbol not present', () => {
        const result = service.getTransactionPushNotificationConfig('deposit', '100.00', 'USD');

        expect(result.body).toBe('Added $100.00 USDC to your US wallet.');
      });
    });
  });
});
