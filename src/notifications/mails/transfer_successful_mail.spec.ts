import { UserModel } from '../../database/models/user/user.model';
import { TransferSuccessfulMail } from './transfer_successful_mail';

describe('TransferSuccessfulMail', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    first_name: 'John',
    last_name: 'Doe',
  } as Partial<UserModel>;

  describe('constructor', () => {
    it('should set to email from user', () => {
      const mail = new TransferSuccessfulMail(
        mockUser,
        100,
        'USD',
        'txn-123',
        'Test transfer',
        'recipient-123',
        '$1.00',
        'Completed',
        'account-123',
      );
      expect(mail.to).toBe('test@example.com');
    });
  });

  describe('properties', () => {
    it('should have correct subject and view', () => {
      const mail = new TransferSuccessfulMail(
        mockUser,
        100,
        'USD',
        'txn-123',
        'Test transfer',
        'recipient-123',
        '$1.00',
        'Completed',
        'account-123',
      );
      expect(mail.subject).toBe('Transfer Successful');
      expect(mail.view).toBe('transfer_successful');
    });
  });

  describe('prepare', () => {
    it('should prepare mail data correctly for regular transfer', async () => {
      const mail = new TransferSuccessfulMail(
        mockUser,
        100,
        'USD',
        'txn-123',
        'Regular transfer',
        'recipient-123',
        '$1.00',
        'Completed',
        'account-123',
        'Sender Name',
        'Recipient Name',
        'Recipient Location',
        100, // providerFee in cents
      );
      const data = await mail.prepare();

      expect(data.username).toBe('John');
      expect(data.amount).toBe(100);
      expect(data.formattedAmount).toBe('100.00');
      expect(data.currency).toBe('USD');
      expect(data.transactionId).toBe('txn-123');
      expect(data.description).toBe('Regular transfer');
      expect(data.fees).toBe('$1.00 USDC');
      // For regular transfer, amountRecipientWillReceive should be amount - fee
      expect(data.amountRecipientWillReceive).toBe('99.00');
      // For regular transfer, should use recipientName
      expect(data.transferFromTo).toBe('to Recipient Name');
    });

    it('should prepare mail data correctly for card funding transfer', async () => {
      const mail = new TransferSuccessfulMail(
        mockUser,
        30,
        'USDC',
        'txn-123',
        'Card funding from USD wallet',
        'recipient-123',
        '$0.01',
        'Completed',
        'account-123',
        'Sender Name',
        'Recipient Name',
        'Recipient Location',
        1, // providerFee in cents (1 cent)
      );
      const data = await mail.prepare();

      expect(data.username).toBe('John');
      expect(data.amount).toBe(30);
      expect(data.formattedAmount).toBe('30.00');
      expect(data.currency).toBe('USDC');
      expect(data.description).toBe('Card funding from USD wallet');
      expect(data.fees).toBe('$0.01 USDC');
      // For card funding, amountRecipientWillReceive should be full amount (not amount - fee)
      expect(data.amountRecipientWillReceive).toBe('30.00');
      // When recipientName is provided, should use it
      expect(data.transferFromTo).toBe('to Recipient Name');
    });

    it('should handle card funding with different case in description', async () => {
      const mail = new TransferSuccessfulMail(
        mockUser,
        50,
        'USDC',
        'txn-123',
        'CARD FUNDING from USD wallet',
        'recipient-123',
        '$0.01',
        'Completed',
        'account-123',
        undefined,
        undefined,
        undefined,
        1,
      );
      const data = await mail.prepare();

      // Should still recognize as card funding
      expect(data.amountRecipientWillReceive).toBe('50.00');
      // Should show "to your virtual card" when recipientName is undefined for card funding
      expect(data.transferFromTo).toBe('to your virtual card');
    });

    it('should subtract fee for non-card funding transfers', async () => {
      const mail = new TransferSuccessfulMail(
        mockUser,
        100,
        'USD',
        'txn-123',
        'Regular money transfer',
        'recipient-123',
        '$2.50',
        'Completed',
        'account-123',
        undefined,
        undefined,
        undefined,
        250, // providerFee in cents (2.50)
      );
      const data = await mail.prepare();

      expect(data.fees).toBe('$2.50 USDC');
      // For regular transfer, should subtract fee
      expect(data.amountRecipientWillReceive).toBe('97.50');
    });

    it('should handle USDC currency normalization', async () => {
      const mail = new TransferSuccessfulMail(
        mockUser,
        100,
        'USDC',
        'txn-123',
        'Regular transfer',
        'recipient-123',
        '$1.00',
        'Completed',
        'account-123',
        undefined,
        undefined,
        undefined,
        100,
      );
      const data = await mail.prepare();

      expect(data.fees).toBe('$1.00 USDC');
      expect(data.amountRecipientWillReceive).toBe('99.00');
    });

    it('should handle zero fee', async () => {
      const mail = new TransferSuccessfulMail(
        mockUser,
        100,
        'USD',
        'txn-123',
        'Regular transfer',
        'recipient-123',
        '$0.00',
        'Completed',
        'account-123',
        undefined,
        undefined,
        undefined,
        0,
      );
      const data = await mail.prepare();

      expect(data.fees).toBe('$0 USDC');
      expect(data.amountRecipientWillReceive).toBe('100.00');
    });

    it('should use default username when first_name not provided', async () => {
      const userWithoutName = { email: 'test@example.com' } as Partial<UserModel>;
      const mail = new TransferSuccessfulMail(
        userWithoutName,
        100,
        'USD',
        'txn-123',
        'Test transfer',
        'recipient-123',
        '$1.00',
        'Completed',
      );
      const data = await mail.prepare();

      expect(data.username).toBe('User');
    });
  });
});
