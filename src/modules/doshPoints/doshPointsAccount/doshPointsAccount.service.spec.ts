import { DoshPointsAccountStatus } from '../../../database/models/doshPointsAccount/doshPointsAccount.interface';
import { DoshPointsAccountModel } from '../../../database/models/doshPointsAccount/doshPointsAccount.model';
import { DoshPointsAccountService } from './doshPointsAccount.service';

describe('DoshPointsAccountService', () => {
  let service: DoshPointsAccountService;

  const mockAccountRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const mockAccount: DoshPointsAccountModel = {
    id: 'account-123',
    user_id: 'user-123',
    balance: 100,
    status: DoshPointsAccountStatus.ACTIVE,
    usd_fiat_rewards_enabled: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as DoshPointsAccountModel;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new DoshPointsAccountService();
    (service as any).accountRepository = mockAccountRepository;
    (service as any).logger = { log: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() };
  });

  describe('findOrCreate', () => {
    it('should return existing account when found', async () => {
      mockAccountRepository.findOne.mockResolvedValue(mockAccount);

      const result = await service.findOrCreate('user-123');

      expect(result).toBe(mockAccount);
      expect(mockAccountRepository.findOne).toHaveBeenCalledWith({ user_id: 'user-123' });
      expect(mockAccountRepository.create).not.toHaveBeenCalled();
    });

    it('should create new account when not found', async () => {
      const newAccount = { ...mockAccount, id: 'new-account-123', balance: 0 };
      mockAccountRepository.findOne.mockResolvedValue(null);
      mockAccountRepository.create.mockResolvedValue(newAccount);

      const result = await service.findOrCreate('user-123');

      expect(result).toBe(newAccount);
      expect(mockAccountRepository.findOne).toHaveBeenCalledWith({ user_id: 'user-123' });
      expect(mockAccountRepository.create).toHaveBeenCalledWith({
        user_id: 'user-123',
        balance: 0,
        status: DoshPointsAccountStatus.ACTIVE,
      });
    });

    it('should log when finding existing account', async () => {
      mockAccountRepository.findOne.mockResolvedValue(mockAccount);

      await service.findOrCreate('user-123');

      expect((service as any).logger.log).toHaveBeenCalledWith(
        'Finding or creating Dosh Points account for user: user-123',
      );
      expect((service as any).logger.log).toHaveBeenCalledWith('Found existing Dosh Points account: account-123');
    });

    it('should log when creating new account', async () => {
      const newAccount = { ...mockAccount, id: 'new-account-123' };
      mockAccountRepository.findOne.mockResolvedValue(null);
      mockAccountRepository.create.mockResolvedValue(newAccount);

      await service.findOrCreate('user-123');

      expect((service as any).logger.log).toHaveBeenCalledWith('Created new Dosh Points account: new-account-123');
    });
  });

  describe('updateBalance', () => {
    it('should update account balance with transaction', async () => {
      const updatedAccount = { ...mockAccount, balance: 200 };
      const mockTrx = {} as any;
      mockAccountRepository.update.mockResolvedValue(updatedAccount);

      const result = await service.updateBalance('account-123', 200, mockTrx);

      expect(result).toBe(updatedAccount);
      expect(mockAccountRepository.update).toHaveBeenCalledWith('account-123', { balance: 200 }, { trx: mockTrx });
    });
  });

  describe('updateUsdFiatRewardsEnabled', () => {
    it('should update usd_fiat_rewards_enabled to true for existing account', async () => {
      const updatedAccount = { ...mockAccount, usd_fiat_rewards_enabled: true };
      mockAccountRepository.findOne.mockResolvedValue(mockAccount);
      mockAccountRepository.update.mockResolvedValue(updatedAccount);

      const result = await service.updateUsdFiatRewardsEnabled('user-123', true);

      expect(result).toBe(updatedAccount);
      expect(mockAccountRepository.update).toHaveBeenCalledWith('account-123', { usd_fiat_rewards_enabled: true });
    });

    it('should update usd_fiat_rewards_enabled to false for existing account', async () => {
      const updatedAccount = { ...mockAccount, usd_fiat_rewards_enabled: false };
      mockAccountRepository.findOne.mockResolvedValue(mockAccount);
      mockAccountRepository.update.mockResolvedValue(updatedAccount);

      const result = await service.updateUsdFiatRewardsEnabled('user-123', false);

      expect(result).toBe(updatedAccount);
      expect(mockAccountRepository.update).toHaveBeenCalledWith('account-123', { usd_fiat_rewards_enabled: false });
    });

    it('should create account if not exists then update usd_fiat_rewards_enabled', async () => {
      const newAccount = { ...mockAccount, id: 'new-account-123', balance: 0, usd_fiat_rewards_enabled: null };
      const updatedAccount = { ...newAccount, usd_fiat_rewards_enabled: true };
      mockAccountRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(newAccount);
      mockAccountRepository.create.mockResolvedValue(newAccount);
      mockAccountRepository.update.mockResolvedValue(updatedAccount);

      const result = await service.updateUsdFiatRewardsEnabled('user-123', true);

      expect(result).toBe(updatedAccount);
      expect(mockAccountRepository.create).toHaveBeenCalled();
      expect(mockAccountRepository.update).toHaveBeenCalledWith('new-account-123', {
        usd_fiat_rewards_enabled: true,
      });
    });

    it('should log when updating usd_fiat_rewards_enabled', async () => {
      const updatedAccount = { ...mockAccount, usd_fiat_rewards_enabled: true };
      mockAccountRepository.findOne.mockResolvedValue(mockAccount);
      mockAccountRepository.update.mockResolvedValue(updatedAccount);

      await service.updateUsdFiatRewardsEnabled('user-123', true);

      expect((service as any).logger.log).toHaveBeenCalledWith(
        'Updating usd_fiat_rewards_enabled to true for user: user-123',
      );
    });
  });
});
