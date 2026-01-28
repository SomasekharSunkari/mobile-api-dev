import { UserModel } from '../../database/models/user/user.model';
import { NgBankTransferSuccessData, NgBankTransferSuccessMail } from './ng_bank_transfer_success_mail';

describe('NgBankTransferSuccessMail', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    first_name: 'John',
    last_name: 'Doe',
    username: 'johndoe',
  } as Partial<UserModel>;

  const mockTransferData: NgBankTransferSuccessData = {
    amount: 50000,
    formattedAmount: '₦50,000.00',
    fee: 50,
    formattedFee: '₦50.00',
    transactionReference: 'TXN-123456789',
    transactionDate: '2026-01-05 10:30:00',
    description: 'Payment for services',
    senderName: 'John Doe',
    recipientName: 'Jane Smith',
    recipientBank: 'First Bank',
    recipientAccountNumber: '0123456789',
  };

  describe('constructor', () => {
    it('should set to email from user', () => {
      const mail = new NgBankTransferSuccessMail(mockUser, mockTransferData);
      expect(mail.to).toBe('test@example.com');
    });
  });

  describe('properties', () => {
    it('should have correct subject and view', () => {
      const mail = new NgBankTransferSuccessMail(mockUser, mockTransferData);
      expect(mail.subject).toBe('Bank Transfer Successful - OneDosh');
      expect(mail.view).toBe('ng_bank_transfer_success');
    });
  });

  describe('prepare', () => {
    it('should prepare mail data correctly with first_name', async () => {
      const mail = new NgBankTransferSuccessMail(mockUser, mockTransferData);
      const data = await mail.prepare();

      expect(data.username).toBe('John');
      expect(data.amount).toBe(50000);
      expect(data.formattedAmount).toBe('₦50,000.00');
      expect(data.fee).toBe(50);
      expect(data.formattedFee).toBe('₦50.00');
      expect(data.transactionReference).toBe('TXN-123456789');
      expect(data.transactionDate).toBe('2026-01-05 10:30:00');
      expect(data.description).toBe('Payment for services');
      expect(data.senderName).toBe('John Doe');
      expect(data.recipientName).toBe('Jane Smith');
      expect(data.recipientBank).toBe('First Bank');
      expect(data.recipientAccountNumber).toBe('0123456789');
    });

    it('should use username when first_name is not provided', async () => {
      const userWithUsername = {
        email: 'test@example.com',
        username: 'johndoe',
      } as Partial<UserModel>;
      const mail = new NgBankTransferSuccessMail(userWithUsername, mockTransferData);
      const data = await mail.prepare();

      expect(data.username).toBe('johndoe');
    });

    it('should use default username when first_name and username are not provided', async () => {
      const userWithoutName = { email: 'test@example.com' } as Partial<UserModel>;
      const mail = new NgBankTransferSuccessMail(userWithoutName, mockTransferData);
      const data = await mail.prepare();

      expect(data.username).toBe('Valued Customer');
    });

    it('should handle transfer without description', async () => {
      const transferDataWithoutDescription: NgBankTransferSuccessData = {
        ...mockTransferData,
        description: undefined,
      };
      const mail = new NgBankTransferSuccessMail(mockUser, transferDataWithoutDescription);
      const data = await mail.prepare();

      expect(data.description).toBeUndefined();
    });
  });
});
