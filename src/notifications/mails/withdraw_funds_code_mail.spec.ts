import { UserModel } from '../../database/models/user/user.model';
import { WithdrawFundsCodeMail } from './withdraw_funds_code_mail';

describe('WithdrawFundsCodeMail', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    username: 'johndoe',
    first_name: 'John',
    last_name: 'Doe',
  } as Partial<UserModel>;

  describe('constructor', () => {
    it('should set to email from user', () => {
      const mail = new WithdrawFundsCodeMail(mockUser as UserModel, '123456', '2025-01-01 12:00:00');
      expect(mail.to).toBe('test@example.com');
    });
  });

  describe('properties', () => {
    it('should have correct subject and view', () => {
      const mail = new WithdrawFundsCodeMail(mockUser as UserModel, '123456', '2025-01-01 12:00:00');
      expect(mail.subject).toBe('Withdrawal Verification Code - OneDosh');
      expect(mail.view).toBe('withdraw_funds_code');
    });
  });

  describe('prepare', () => {
    it('should prepare mail data correctly with username', async () => {
      const mail = new WithdrawFundsCodeMail(mockUser as UserModel, '123456', '2025-01-01 12:00:00');
      const data = await mail.prepare();

      expect(data.username).toBe('johndoe');
      expect(data.code).toBe('123456');
      expect(data.expiresAt).toBe('2025-01-01 12:00:00');
      expect(data.userEmail).toBe('test@example.com');
    });

    it('should use first_name when username not provided', async () => {
      const userWithoutUsername = {
        email: 'test@example.com',
        first_name: 'John',
      } as Partial<UserModel>;
      const mail = new WithdrawFundsCodeMail(userWithoutUsername as UserModel, '123456', '2025-01-01 12:00:00');
      const data = await mail.prepare();

      expect(data.username).toBe('John');
    });

    it('should use default username when username and first_name not provided', async () => {
      const userWithoutName = { email: 'test@example.com' } as Partial<UserModel>;
      const mail = new WithdrawFundsCodeMail(userWithoutName as UserModel, '123456', '2025-01-01 12:00:00');
      const data = await mail.prepare();

      expect(data.username).toBe('User');
    });
  });
});
