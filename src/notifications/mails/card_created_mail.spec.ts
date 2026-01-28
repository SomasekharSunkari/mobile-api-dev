import { UserModel } from '../../database/models/user/user.model';
import { CardCreatedMail } from './card_created_mail';

describe('CardCreatedMail', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    first_name: 'John',
    last_name: 'Doe',
  } as Partial<UserModel>;

  describe('constructor', () => {
    it('should set to email from user', () => {
      const mail = new CardCreatedMail(mockUser, 'card-123', 'virtual', '1234');
      expect(mail.to).toBe('test@example.com');
    });
  });

  describe('properties', () => {
    it('should have correct subject and view', () => {
      const mail = new CardCreatedMail(mockUser, 'card-123', 'virtual', '1234');
      expect(mail.subject).toBe('Your OneDosh Virtual Card is Ready');
      expect(mail.view).toBe('card_created');
    });
  });

  describe('prepare', () => {
    it('should prepare mail data correctly for virtual card', async () => {
      const mail = new CardCreatedMail(mockUser, 'card-123', 'virtual', '1234');
      const data = await mail.prepare();

      expect(data.username).toBe('John');
      expect(data.cardId).toBe('card-123');
      expect(data.cardType).toBe('Virtual');
      expect(data.lastFourDigits).toBe('1234');
      expect(data.transactionDate).toBeDefined();
    });

    it('should prepare mail data correctly for physical card', async () => {
      const mail = new CardCreatedMail(mockUser, 'card-123', 'physical', '5678');
      const data = await mail.prepare();

      expect(data.cardType).toBe('Physical');
      expect(data.lastFourDigits).toBe('5678');
    });

    it('should use default lastFourDigits when not provided', async () => {
      const mail = new CardCreatedMail(mockUser, 'card-123', 'virtual');
      const data = await mail.prepare();

      expect(data.lastFourDigits).toBe('****');
    });

    it('should use default username when first_name not provided', async () => {
      const userWithoutName = { email: 'test@example.com' } as Partial<UserModel>;
      const mail = new CardCreatedMail(userWithoutName, 'card-123', 'virtual', '1234');
      const data = await mail.prepare();

      expect(data.username).toBe('User');
    });
  });
});
