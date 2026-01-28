import { UserModel } from '../../database/models/user/user.model';
import { CardFundedMail } from './card_funded_mail';

describe('CardFundedMail', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    first_name: 'John',
    last_name: 'Doe',
  } as Partial<UserModel>;

  describe('constructor', () => {
    it('should set to email from user', () => {
      const mail = new CardFundedMail(mockUser, 100, 'USD', 'txn-123', 500, 'card-123');
      expect(mail.to).toBe('test@example.com');
    });
  });

  describe('properties', () => {
    it('should have correct subject and view', () => {
      const mail = new CardFundedMail(mockUser, 100, 'USD', 'txn-123', 500, 'card-123');
      expect(mail.subject).toBe('Card Funding Successful');
      expect(mail.view).toBe('card_funded');
    });
  });

  describe('prepare', () => {
    it('should prepare mail data correctly', async () => {
      const mail = new CardFundedMail(mockUser, 100, 'USD', 'txn-123', 500, 'card-123');
      const data = await mail.prepare();

      expect(data.username).toBe('John');
      expect(data.amount).toBe(100);
      expect(data.formattedAmount).toBe('100.00');
      expect(data.currency).toBe('USD');
      expect(data.transactionId).toBe('txn-123');
      expect(data.newBalance).toBe(500);
      expect(data.formattedNewBalance).toBe('500.00');
      expect(data.cardId).toBe('card-123');
      expect(data.transactionDate).toBeDefined();
    });

    it('should format negative amounts correctly', async () => {
      const mail = new CardFundedMail(mockUser, -100, 'USD', 'txn-123', 500);
      const data = await mail.prepare();

      expect(data.formattedAmount).toBe('100.00');
    });

    it('should use default username when first_name not provided', async () => {
      const userWithoutName = { email: 'test@example.com' } as Partial<UserModel>;
      const mail = new CardFundedMail(userWithoutName, 100, 'USD', 'txn-123', 500);
      const data = await mail.prepare();

      expect(data.username).toBe('User');
    });
  });
});
