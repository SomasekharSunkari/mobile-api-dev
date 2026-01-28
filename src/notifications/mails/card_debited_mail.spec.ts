import { UserModel } from '../../database/models/user/user.model';
import { CardDebitedMail } from './card_debited_mail';

describe('CardDebitedMail', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    first_name: 'John',
    last_name: 'Doe',
  } as Partial<UserModel>;

  describe('constructor', () => {
    it('should set to email from user', () => {
      const mail = new CardDebitedMail(mockUser, -50, 'USD', 'txn-123', 450, 'Merchant Name', 'card-123');
      expect(mail.to).toBe('test@example.com');
    });
  });

  describe('properties', () => {
    it('should have correct subject and view', () => {
      const mail = new CardDebitedMail(mockUser, -50, 'USD', 'txn-123', 450, 'Merchant Name', 'card-123');
      expect(mail.subject).toBe('Payment Successful- OneDosh Card');
      expect(mail.view).toBe('card_debited');
    });
  });

  describe('prepare', () => {
    it('should prepare mail data correctly', async () => {
      const mail = new CardDebitedMail(
        mockUser,
        -50,
        'USD',
        'txn-123',
        450,
        'Merchant Name',
        'card-123',
        'New York, NY',
      );
      const data = await mail.prepare();

      expect(data.username).toBe('John');
      expect(data.amount).toBe(-50);
      expect(data.formattedAmount).toBe('50.00');
      expect(data.currency).toBe('USD');
      expect(data.transactionId).toBe('txn-123');
      expect(data.newBalance).toBe(450);
      expect(data.formattedNewBalance).toBe('450.00');
      expect(data.cardId).toBe('card-123');
      expect(data.merchantName).toBe('Merchant Name');
      expect(data.merchantLocation).toBe('New York, NY');
      expect(data.transactionDate).toBeDefined();
    });

    it('should format negative amounts correctly', async () => {
      const mail = new CardDebitedMail(mockUser, -100, 'USD', 'txn-123', 400, 'Merchant');
      const data = await mail.prepare();

      expect(data.formattedAmount).toBe('100.00');
    });

    it('should handle optional cardId and merchantLocation', async () => {
      const mail = new CardDebitedMail(mockUser, -50, 'USD', 'txn-123', 450, 'Merchant Name');
      const data = await mail.prepare();

      expect(data.cardId).toBeUndefined();
      expect(data.merchantLocation).toBeUndefined();
    });
  });
});
