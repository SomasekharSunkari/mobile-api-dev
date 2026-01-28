import { UserModel } from '../../database/models/user/user.model';
import { WalletExchangeSuccessData, WalletExchangeSuccessMail } from './wallet_exchange_success_mail';

describe('WalletExchangeSuccessMail', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    first_name: 'John',
    last_name: 'Doe',
    username: 'johndoe',
  } as Partial<UserModel>;

  const mockExchangeData: WalletExchangeSuccessData = {
    fromCurrency: 'USD',
    toCurrency: 'NGN',
    toCountry: 'Nigeria',
    formattedAmount: '$100.00',
    formattedLocalAmount: '₦158,000.00',
    transactionId: 'TXN-123456789',
    transactionDate: '2026-01-23 10:30:00',
    description: 'Wallet exchange',
    accountId: 'ACC-123',
    orderNumber: 'ORD-456',
    walletAddress: '0x1234567890abcdef',
    receivingInstitution: 'YC Financial Inc.',
    senderName: 'John Doe',
    recipientName: 'Jane Smith',
    recipientLocation: 'Lagos, Nigeria',
    exchangeRate: '₦1,580.00',
    formattedFee: '$2.00',
    formattedTotal: '$102.00',
    availableDate: '2026-01-24',
  };

  describe('constructor', () => {
    it('should set to email from user', () => {
      const mail = new WalletExchangeSuccessMail(mockUser, mockExchangeData);
      expect(mail.to).toBe('test@example.com');
    });
  });

  describe('properties', () => {
    it('should have correct subject and view', () => {
      const mail = new WalletExchangeSuccessMail(mockUser, mockExchangeData);
      expect(mail.subject).toBe('Withdrawal & Exchange Processed - OneDosh');
      expect(mail.view).toBe('wallet_exchange_success');
    });
  });

  describe('prepare', () => {
    it('should prepare mail data correctly with first_name', async () => {
      const mail = new WalletExchangeSuccessMail(mockUser, mockExchangeData);
      const data = await mail.prepare();

      expect(data.username).toBe('John');
      expect(data.fromCurrency).toBe('USD');
      expect(data.toCurrency).toBe('NGN');
      expect(data.toCountry).toBe('Nigeria');
      expect(data.formattedAmount).toBe('$100.00');
      expect(data.formattedLocalAmount).toBe('₦158,000.00');
      expect(data.transactionId).toBe('TXN-123456789');
      expect(data.transactionDate).toBe('2026-01-23 10:30:00');
      expect(data.description).toBe('Wallet exchange');
      expect(data.accountId).toBe('ACC-123');
      expect(data.orderNumber).toBe('ORD-456');
      expect(data.walletAddress).toBe('0x1234567890abcdef');
      expect(data.receivingInstitution).toBe('YC Financial Inc.');
      expect(data.senderName).toBe('John Doe');
      expect(data.recipientName).toBe('Jane Smith');
      expect(data.recipientLocation).toBe('Lagos, Nigeria');
      expect(data.exchangeRate).toBe('$1 ~ ₦1,580.00');
      expect(data.formattedFee).toBe('$2.00');
      expect(data.formattedTotal).toBe('$102.00');
      expect(data.availableDate).toBe('2026-01-24');
    });

    it('should use username when first_name is not provided', async () => {
      const userWithUsername = {
        email: 'test@example.com',
        username: 'johndoe',
      } as Partial<UserModel>;
      const mail = new WalletExchangeSuccessMail(userWithUsername, mockExchangeData);
      const data = await mail.prepare();

      expect(data.username).toBe('johndoe');
    });

    it('should use default username when first_name and username are not provided', async () => {
      const userWithoutName = { email: 'test@example.com' } as Partial<UserModel>;
      const mail = new WalletExchangeSuccessMail(userWithoutName, mockExchangeData);
      const data = await mail.prepare();

      expect(data.username).toBe('Valued Customer');
    });

    it('should format exchange rate with dollar prefix', async () => {
      const mail = new WalletExchangeSuccessMail(mockUser, mockExchangeData);
      const data = await mail.prepare();

      expect(data.exchangeRate).toBe('$1 ~ ₦1,580.00');
    });

    it('should return undefined exchange rate when not provided', async () => {
      const exchangeDataWithoutRate: WalletExchangeSuccessData = {
        ...mockExchangeData,
        exchangeRate: undefined,
      };
      const mail = new WalletExchangeSuccessMail(mockUser, exchangeDataWithoutRate);
      const data = await mail.prepare();

      expect(data.exchangeRate).toBeUndefined();
    });

    it('should use default receiving institution when not provided', async () => {
      const exchangeDataWithoutInstitution: WalletExchangeSuccessData = {
        ...mockExchangeData,
        receivingInstitution: undefined,
      };
      const mail = new WalletExchangeSuccessMail(mockUser, exchangeDataWithoutInstitution);
      const data = await mail.prepare();

      expect(data.receivingInstitution).toBe('YC Financial Inc.');
    });

    it('should handle minimal exchange data', async () => {
      const minimalExchangeData: WalletExchangeSuccessData = {};
      const mail = new WalletExchangeSuccessMail(mockUser, minimalExchangeData);
      const data = await mail.prepare();

      expect(data.username).toBe('John');
      expect(data.receivingInstitution).toBe('YC Financial Inc.');
      expect(data.exchangeRate).toBeUndefined();
    });
  });
});
