import { UserModel } from '../../database/models/user/user.model';
import { CardManagementMail } from './card_management_mail';

describe('CardManagementMail', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    first_name: 'John',
    last_name: 'Doe',
  } as Partial<UserModel>;

  describe('constructor', () => {
    it('should set to email from user', () => {
      const mail = new CardManagementMail(mockUser, 'freeze', 'card-123');
      expect(mail.to).toBe('test@example.com');
    });

    it('should set correct subject for freeze action', () => {
      const mail = new CardManagementMail(mockUser, 'freeze', 'card-123');
      expect(mail.subject).toBe('Your OneDosh Card Was Frozen');
    });

    it('should set correct subject for unfreeze action', () => {
      const mail = new CardManagementMail(mockUser, 'unfreeze', 'card-123');
      expect(mail.subject).toBe('Card Unlocked');
    });

    it('should set correct subject for limit_updated action', () => {
      const mail = new CardManagementMail(mockUser, 'limit_updated', 'card-123', 2000, 'per7DayPeriod');
      expect(mail.subject).toBe('Card Limit Updated');
    });

    it('should set correct subject for blocked action', () => {
      const mail = new CardManagementMail(mockUser, 'blocked', 'card-123');
      expect(mail.subject).toBe('Card Blocked');
    });

    it('should set correct subject for reissue action', () => {
      const mail = new CardManagementMail(mockUser, 'reissue', 'card-123');
      expect(mail.subject).toBe('Card Reissued Successfully');
    });

    it('should set default subject for unknown action', () => {
      const mail = new CardManagementMail(mockUser, 'unknown' as any, 'card-123');
      expect(mail.subject).toBe('Card Management Update');
    });
  });

  describe('properties', () => {
    it('should have correct view', () => {
      const mail = new CardManagementMail(mockUser, 'freeze', 'card-123');
      expect(mail.view).toBe('card_management');
    });
  });

  describe('prepare', () => {
    it('should prepare mail data correctly for freeze action', async () => {
      const mail = new CardManagementMail(mockUser, 'freeze', 'card-123');
      const data = await mail.prepare();

      expect(data.username).toBe('John');
      expect(data.action).toBe('freeze');
      expect(data.actionText).toBe('You froze your OneDosh virtual card.');
      expect(data.cardId).toBe('card-123');
      expect(data.transactionDate).toBeDefined();
    });

    it('should prepare mail data correctly for unfreeze action', async () => {
      const mail = new CardManagementMail(mockUser, 'unfreeze', 'card-123');
      const data = await mail.prepare();

      expect(data.action).toBe('unfreeze');
      expect(data.actionText).toBe('Your OneDosh virtual card is active again and ready for use.');
    });

    it('should prepare mail data correctly for limit_updated action', async () => {
      const mail = new CardManagementMail(mockUser, 'limit_updated', 'card-123', 2000, 'per7DayPeriod');
      const data = await mail.prepare();

      expect(data.action).toBe('limit_updated');
      expect(data.actionText).toBe('Your card spending limit has been updated');
      expect(data.limitAmount).toBe(2000);
      expect(data.formattedLimit).toBe('2,000.00');
      expect(data.limitFrequency).toBe('per7DayPeriod');
    });

    it('should format limit amount correctly', async () => {
      const mail = new CardManagementMail(mockUser, 'limit_updated', 'card-123', 1500.5, 'per30DayPeriod');
      const data = await mail.prepare();

      expect(data.formattedLimit).toBe('1,500.50');
    });

    it('should handle null limit amount', async () => {
      const mail = new CardManagementMail(mockUser, 'freeze', 'card-123');
      const data = await mail.prepare();

      expect(data.limitAmount).toBeUndefined();
      expect(data.formattedLimit).toBeNull();
    });

    it('should use default username when first_name not provided', async () => {
      const userWithoutName = { email: 'test@example.com' } as Partial<UserModel>;
      const mail = new CardManagementMail(userWithoutName, 'freeze', 'card-123');
      const data = await mail.prepare();

      expect(data.username).toBe('User');
    });

    it('should prepare mail data correctly for blocked action', async () => {
      const mail = new CardManagementMail(mockUser, 'blocked', 'card-123');
      const data = await mail.prepare();

      expect(data.action).toBe('blocked');
      expect(data.actionText).toBe('Your card has been blocked');
    });

    it('should prepare mail data correctly for reissue action', async () => {
      const mail = new CardManagementMail(mockUser, 'reissue', 'card-123');
      const data = await mail.prepare();

      expect(data.action).toBe('reissue');
      expect(data.actionText).toBe('Your OneDosh card has been successfully reissued.');
    });

    it('should return default action text for unknown action', async () => {
      const mail = new CardManagementMail(mockUser, 'unknown' as any, 'card-123');
      const data = await mail.prepare();

      expect(data.actionText).toBe('Your card settings have been updated');
    });
  });
});
