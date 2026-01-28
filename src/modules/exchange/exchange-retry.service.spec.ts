jest.mock('../../config/environment/environment.service', () => ({
  EnvironmentService: {
    isProduction: jest.fn().mockReturnValue(false),
    isDevelopment: jest.fn().mockReturnValue(true),
    isTest: jest.fn().mockReturnValue(true),
    getValue: jest.fn(),
    getValues: jest.fn(() => ({
      db_host: 'localhost',
      db_password: 'password',
      db_user: 'user',
      db_name: 'test',
      db_port: 5432,
      db_ssl: false,
    })),
  },
}));

jest.mock('../../utils/utils.service', () => ({
  UtilsService: {
    generateTransactionReference: jest.fn().mockReturnValue('TXN123456789'),
  },
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ExchangeAdapter } from '../../adapters/exchange/exchange.adapter';
import {
  BankStatus,
  ExchangeChannelRampType,
  ExchangeChannelStatus,
  ExchangeChannelType,
} from '../../adapters/exchange/exchange.interface';
import { KYCAdapter } from '../../adapters/kyc/kyc-adapter';
import { IdentityDocType } from '../../adapters/kyc/kyc-adapter.interface';
import { EnvironmentService } from '../../config/environment/environment.service';
import { FiatWalletConfigProvider } from '../../config/fiat-wallet.config';
import { TransactionStatus, TransactionType } from '../../database';
import { VirtualAccountType } from '../../database/models/virtualAccount';
import { UserRepository } from '../auth/user/user.repository';
import { FiatWalletService } from '../fiatWallet/fiatWallet.service';
import { FiatWalletTransactionRepository } from '../fiatWalletTransactions/fiatWalletTransactions.repository';
import { FiatWalletTransactionService } from '../fiatWalletTransactions/fiatWalletTransactions.service';
import { RateRepository } from '../rate/rate.repository';
import { RateConfigRepository } from '../rateConfig/rateConfig.repository';
import { TransactionRepository } from '../transaction/transaction.repository';
import { TransactionService } from '../transaction/transaction.service';
import { VirtualAccountService } from '../virtualAccount/virtualAccount.service';
import { ExchangeRetryService } from './exchange-retry.service';

// Shared mock data factory functions
const createMockParentTransaction = (overrides = {}) => ({
  id: 'parent-123',
  user_id: 'user-123',
  transaction_type: TransactionType.EXCHANGE,
  asset: 'USD',
  amount: 10000,
  metadata: { destination_country_code: 'NG', rate_id: 'rate-123' },
  ...overrides,
});

const createMockVirtualAccount = (overrides = {}) => ({
  id: 'va-123',
  account_number: '1234567890',
  account_name: 'Test User',
  ...overrides,
});

const createMockWithdrawChannel = (overrides = {}) => ({
  ref: 'ch-1',
  status: ExchangeChannelStatus.ACTIVE,
  rampType: ExchangeChannelRampType.WITHDRAW,
  currency: 'NGN',
  countryCode: 'NG',
  localCurrency: 'NGN',
  max: 1000000,
  min: 100,
  vendorRef: 'vendor-123',
  type: ExchangeChannelType.BANK,
  settlementType: 'bank',
  settlementTime: 24,
  ...overrides,
});

const createMockPagaBank = (isProduction = false, overrides = {}) => ({
  ref: isProduction ? 'e5d96690-40d3-48f4-a745-b9e74566edc4' : '3d4d08c1-4811-4fee-9349-a302328e55c1',
  name: isProduction ? 'Paga' : 'Stanbic',
  code: isProduction ? '327' : '221',
  status: BankStatus.ACTIVE,
  countryCode: 'NG',
  accountNumberType: 'nuban',
  countryAccountNumberType: 'nuban',
  channelRefs: ['ch-1'],
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
  ...overrides,
});

const createMockPayOutResponse = (overrides = {}) => ({
  ref: 'ref-123',
  sequenceRef: 'seq-123',
  channelRef: 'ch-1',
  currency: 'NGN',
  country: 'NG',
  amount: 1500000,
  reason: 'other',
  convertedAmount: 1500000,
  status: 'pending',
  rate: 1500,
  sender: { name: 'Test User' },
  destination: { accountNumber: '1234567890' },
  userId: 'user-123',
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
  expiresAt: '2024-01-02',
  cryptoInfo: { walletAddress: '0x123' },
  ...overrides,
});

const createMockUserWithDetails = (overrides = {}) => ({
  id: 'user-123',
  first_name: 'Test',
  last_name: 'User',
  email: 'test@test.com',
  phone_number: '+2348012345678',
  country: { code: 'NG' },
  userProfile: {
    address_line1: '123 Street',
    dob: '1990-01-01',
  },
  ...overrides,
});

const createMockKycDetails = (overrides = {}) => ({
  data: {
    idDocument: {
      number: 'A123',
      type: 'PASSPORT',
    },
    idNumber: '12345678901',
    ...overrides,
  },
});

const createMockRateConfig = (
  overrides: {
    is_active?: boolean;
    partner_fee?: number | null;
    is_partner_fee_percentage?: boolean;
    disbursement_fee?: number | null;
    is_disbursement_fee_percentage?: boolean;
  } = {},
) => {
  const config = {
    is_active: overrides.is_active ?? true,
    fiat_exchange: {
      partner_fee: {
        value: overrides.partner_fee ?? 0,
        is_percentage: overrides.is_partner_fee_percentage ?? false,
      },
      disbursement_fee: {
        value: overrides.disbursement_fee ?? 0,
        is_percentage: overrides.is_disbursement_fee_percentage ?? false,
      },
    },
  };

  return {
    provider: 'yellowcard',
    config,
    get isActive() {
      return this.config?.is_active ?? false;
    },
    get fiatExchange() {
      return this.config?.fiat_exchange;
    },
  };
};

const createMockQueryBuilder = (firstResult = null) => ({
  withGraphFetched: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  forUpdate: jest.fn().mockReturnThis(),
  first: jest.fn().mockResolvedValue(firstResult),
});

describe('ExchangeRetryService', () => {
  let service: ExchangeRetryService;

  const mockTransactionRepository = {
    findById: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    transaction: jest.fn(),
    query: jest.fn(),
  };

  const mockTransactionService = {
    updateStatus: jest.fn(),
    create: jest.fn(),
  };

  const mockFiatWalletTransactionRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockFiatWalletTransactionService = {
    updateStatus: jest.fn(),
    create: jest.fn(),
  };

  const mockVirtualAccountService = {
    create: jest.fn(),
  };

  const mockExchangeAdapter = {
    getChannels: jest.fn(),
    getBanks: jest.fn(),
    createPayOutRequest: jest.fn(),
    getProviderName: jest.fn().mockReturnValue('yellowcard'),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  const mockKycAdapter = {
    getKycDetailsByUserId: jest.fn(),
  };

  const mockFiatWalletConfigProvider = {
    getConfig: jest.fn(),
  };

  const mockRateRepository = {
    findOne: jest.fn(),
  };

  const mockRateConfigRepository = {
    findOne: jest.fn(),
  };

  const mockFiatWalletService = {
    getUserWallet: jest.fn(),
  };

  // Helper to set up common mocks for successful retry flow
  const setupSuccessfulRetryMocks = (
    options: {
      isProduction?: boolean;
      parentTransaction?: ReturnType<typeof createMockParentTransaction>;
      ngnChildTransaction?: unknown;
      existingIncomingTransaction?: unknown;
    } = {},
  ) => {
    const {
      isProduction = false,
      parentTransaction,
      ngnChildTransaction = null,
      existingIncomingTransaction = null,
    } = options;

    (EnvironmentService.isProduction as jest.Mock).mockReturnValue(isProduction);
    mockTransactionRepository.findById.mockResolvedValue(parentTransaction || createMockParentTransaction());
    mockVirtualAccountService.create.mockResolvedValue(createMockVirtualAccount());
    mockExchangeAdapter.getChannels.mockResolvedValue([createMockWithdrawChannel()]);
    mockExchangeAdapter.getBanks.mockResolvedValue([createMockPagaBank(isProduction)]);
    mockUserRepository.findOne.mockResolvedValue(createMockUserWithDetails());
    mockKycAdapter.getKycDetailsByUserId.mockResolvedValue(createMockKycDetails());
    mockExchangeAdapter.createPayOutRequest.mockResolvedValue(createMockPayOutResponse());
    mockTransactionRepository.findOne.mockResolvedValue(ngnChildTransaction);
    mockRateRepository.findOne.mockResolvedValue({ id: 'rate-123', rate: 1500 });
    mockRateConfigRepository.findOne.mockResolvedValue(createMockRateConfig());
    mockFiatWalletService.getUserWallet.mockResolvedValue({ id: 'wallet-123', balance: 0 });
    mockTransactionRepository.transaction.mockImplementation(async (cb) => cb({}));
    mockTransactionRepository.query.mockReturnValue(createMockQueryBuilder(existingIncomingTransaction));
    mockTransactionService.create.mockResolvedValue({ id: 'new-txn-123' });
    mockTransactionRepository.update.mockResolvedValue({});
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    (EnvironmentService.isProduction as jest.Mock).mockReturnValue(false);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExchangeRetryService,
        { provide: TransactionRepository, useValue: mockTransactionRepository },
        { provide: TransactionService, useValue: mockTransactionService },
        { provide: FiatWalletTransactionRepository, useValue: mockFiatWalletTransactionRepository },
        { provide: FiatWalletTransactionService, useValue: mockFiatWalletTransactionService },
        { provide: VirtualAccountService, useValue: mockVirtualAccountService },
        { provide: ExchangeAdapter, useValue: mockExchangeAdapter },
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: KYCAdapter, useValue: mockKycAdapter },
        { provide: FiatWalletConfigProvider, useValue: mockFiatWalletConfigProvider },
        { provide: RateRepository, useValue: mockRateRepository },
        { provide: RateConfigRepository, useValue: mockRateConfigRepository },
        { provide: FiatWalletService, useValue: mockFiatWalletService },
      ],
    }).compile();

    service = module.get<ExchangeRetryService>(ExchangeRetryService);
  });

  const initializeService = async () => {
    mockFiatWalletConfigProvider.getConfig.mockReturnValue({
      default_underlying_currency: 'USDC.ETH',
    });
    await service.onModuleInit();
  };

  describe('onModuleInit', () => {
    it('should initialize fiatWalletConfig from provider', async () => {
      const mockConfig = {
        default_usd_fiat_wallet_provider: 'zero_hash',
        default_ngn_fiat_wallet_provider: 'paga',
        default_underlying_currency: 'USDC.ETH',
      };
      mockFiatWalletConfigProvider.getConfig.mockReturnValue(mockConfig);

      await service.onModuleInit();

      expect(mockFiatWalletConfigProvider.getConfig).toHaveBeenCalled();
    });
  });

  describe('retryExchange', () => {
    const mockParentTransactionId = 'parent-txn-123';

    beforeEach(async () => {
      await initializeService();
    });

    it('should successfully retry an exchange transaction', async () => {
      const parentTransaction = createMockParentTransaction({ id: mockParentTransactionId });
      setupSuccessfulRetryMocks({ parentTransaction });

      const result = await service.retryExchange(mockParentTransactionId);

      expect(result).toEqual({
        message: 'Exchange retry initiated successfully',
        parent_transaction_id: mockParentTransactionId,
        new_account_number: '1234567890',
        new_sequence_ref: 'seq-123',
      });

      expect(mockTransactionRepository.findById).toHaveBeenCalledWith(mockParentTransactionId);
      expect(mockVirtualAccountService.create).toHaveBeenCalledWith(
        parentTransaction.user_id,
        { transaction_id: parentTransaction.id },
        VirtualAccountType.EXCHANGE_ACCOUNT,
      );
      expect(mockTransactionRepository.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException when parent transaction not found', async () => {
      mockTransactionRepository.findById.mockResolvedValue(null);

      await expect(service.retryExchange(mockParentTransactionId)).rejects.toThrow(
        new NotFoundException(`Parent transaction with ID ${mockParentTransactionId} not found`),
      );
    });

    it('should throw BadRequestException when transaction is not an exchange type', async () => {
      mockTransactionRepository.findById.mockResolvedValue(
        createMockParentTransaction({ id: mockParentTransactionId, transaction_type: TransactionType.DEPOSIT }),
      );

      await expect(service.retryExchange(mockParentTransactionId)).rejects.toThrow(
        new BadRequestException(
          `Transaction ${mockParentTransactionId} is not an exchange transaction. Type: ${TransactionType.DEPOSIT}`,
        ),
      );
    });

    it('should throw BadRequestException when transaction is not a USD transaction', async () => {
      mockTransactionRepository.findById.mockResolvedValue(
        createMockParentTransaction({ id: mockParentTransactionId, asset: 'NGN' }),
      );

      await expect(service.retryExchange(mockParentTransactionId)).rejects.toThrow(
        new BadRequestException(`Transaction ${mockParentTransactionId} is not a USD transaction. Asset: NGN`),
      );
    });

    it('should throw BadRequestException when payout response is null', async () => {
      setupSuccessfulRetryMocks({ parentTransaction: createMockParentTransaction({ id: mockParentTransactionId }) });
      mockExchangeAdapter.createPayOutRequest.mockResolvedValue(null);

      await expect(service.retryExchange(mockParentTransactionId)).rejects.toThrow(
        new BadRequestException('Failed to create YellowCard payout request'),
      );
    });
  });

  describe('handleNgnChildTransaction', () => {
    beforeEach(async () => {
      await initializeService();
    });

    it('should update FAILED child transaction to RECONCILE status', async () => {
      const mockFailedChildTxn = { id: 'child-123', status: TransactionStatus.FAILED, metadata: {} };

      setupSuccessfulRetryMocks({ ngnChildTransaction: mockFailedChildTxn });
      mockFiatWalletTransactionRepository.findOne.mockResolvedValue(null);
      mockTransactionRepository.update.mockResolvedValue({});

      await service.retryExchange('parent-123');

      expect(mockTransactionRepository.update).toHaveBeenCalledWith(
        mockFailedChildTxn.id,
        expect.objectContaining({
          status: TransactionStatus.RECONCILE,
          metadata: expect.objectContaining({
            previous_status: TransactionStatus.FAILED,
          }),
        }),
      );
    });

    it('should also update fiat wallet transaction if exists', async () => {
      const mockFailedChildTxn = { id: 'child-123', status: TransactionStatus.FAILED, metadata: {} };
      const mockFiatWalletTxn = { id: 'fwt-123', status: TransactionStatus.FAILED, provider_metadata: {} };

      setupSuccessfulRetryMocks({ ngnChildTransaction: mockFailedChildTxn });
      mockFiatWalletTransactionRepository.findOne.mockResolvedValue(mockFiatWalletTxn);
      mockTransactionRepository.update.mockResolvedValue({});
      mockFiatWalletTransactionRepository.update.mockResolvedValue({});

      await service.retryExchange('parent-123');

      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith(
        mockFiatWalletTxn.id,
        expect.objectContaining({
          status: TransactionStatus.RECONCILE,
          provider_metadata: expect.objectContaining({
            previous_status: TransactionStatus.FAILED,
          }),
        }),
      );
    });
  });

  describe('getYellowCardChannelAndBank', () => {
    beforeEach(async () => {
      await initializeService();
    });

    const setupChannelBankTest = () => {
      mockTransactionRepository.findById.mockResolvedValue(createMockParentTransaction());
      mockVirtualAccountService.create.mockResolvedValue(createMockVirtualAccount());
    };

    it('should throw BadRequestException when no channels found', async () => {
      setupChannelBankTest();
      mockExchangeAdapter.getChannels.mockResolvedValue(null);

      await expect(service.retryExchange('parent-123')).rejects.toThrow(
        new BadRequestException('No channels found for NG'),
      );
    });

    it('should throw BadRequestException when channels array is empty', async () => {
      setupChannelBankTest();
      mockExchangeAdapter.getChannels.mockResolvedValue([]);

      await expect(service.retryExchange('parent-123')).rejects.toThrow(
        new BadRequestException('No channels found for NG'),
      );
    });

    it('should throw BadRequestException when no active withdrawal channel found', async () => {
      setupChannelBankTest();
      mockExchangeAdapter.getChannels.mockResolvedValue([
        { status: ExchangeChannelStatus.INACTIVE, rampType: ExchangeChannelRampType.WITHDRAW },
        { status: ExchangeChannelStatus.ACTIVE, rampType: ExchangeChannelRampType.DEPOSIT },
      ]);

      await expect(service.retryExchange('parent-123')).rejects.toThrow(
        new BadRequestException('No active withdrawal channel found for NG'),
      );
    });

    it('should throw BadRequestException when no banks found', async () => {
      setupChannelBankTest();
      mockExchangeAdapter.getChannels.mockResolvedValue([createMockWithdrawChannel()]);
      mockExchangeAdapter.getBanks.mockResolvedValue(null);

      await expect(service.retryExchange('parent-123')).rejects.toThrow(
        new BadRequestException('No banks found for NG'),
      );
    });

    it('should throw BadRequestException when Paga bank not found', async () => {
      setupChannelBankTest();
      mockExchangeAdapter.getChannels.mockResolvedValue([createMockWithdrawChannel()]);
      mockExchangeAdapter.getBanks.mockResolvedValue([
        { name: 'Other Bank', code: '001', status: BankStatus.ACTIVE, channelRefs: ['ch-1'] },
      ]);

      await expect(service.retryExchange('parent-123')).rejects.toThrow(
        new BadRequestException('Paga bank not found or inactive'),
      );
    });

    it('should throw BadRequestException when Paga does not support withdrawal channel', async () => {
      setupChannelBankTest();
      mockExchangeAdapter.getChannels.mockResolvedValue([createMockWithdrawChannel()]);
      mockExchangeAdapter.getBanks.mockResolvedValue([
        createMockPagaBank(false, { channelRefs: ['different-channel'] }),
      ]);

      await expect(service.retryExchange('parent-123')).rejects.toThrow(
        new BadRequestException('Channel not found: Paga does not support the withdrawal channel'),
      );
    });

    it('should throw BadRequestException when banks array is empty', async () => {
      setupChannelBankTest();
      mockExchangeAdapter.getChannels.mockResolvedValue([createMockWithdrawChannel()]);
      mockExchangeAdapter.getBanks.mockResolvedValue([]);

      await expect(service.retryExchange('parent-123')).rejects.toThrow(
        new BadRequestException('No banks found for NG'),
      );
    });

    it('should find Paga bank by code when name does not match', async () => {
      setupChannelBankTest();
      mockExchangeAdapter.getChannels.mockResolvedValue([createMockWithdrawChannel()]);
      mockExchangeAdapter.getBanks.mockResolvedValue([
        createMockPagaBank(false, { name: 'Stanbic IBTC', code: '221' }),
      ]);
      mockUserRepository.findOne.mockResolvedValue(createMockUserWithDetails());
      mockKycAdapter.getKycDetailsByUserId.mockResolvedValue(createMockKycDetails());
      mockExchangeAdapter.createPayOutRequest.mockResolvedValue(createMockPayOutResponse());
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockRateRepository.findOne.mockResolvedValue({ id: 'rate-123', rate: 1500 });
      mockRateConfigRepository.findOne.mockResolvedValue(createMockRateConfig());
      mockFiatWalletService.getUserWallet.mockResolvedValue({ id: 'wallet-123', balance: 0 });
      mockTransactionRepository.transaction.mockImplementation(async (cb) => cb({}));
      mockTransactionRepository.query.mockReturnValue(createMockQueryBuilder(null));
      mockTransactionService.create.mockResolvedValue({ id: 'new-txn-123' });

      const result = await service.retryExchange('parent-123');

      expect(result).toBeDefined();
    });

    it('should find Paga bank by ref when name and code do not match', async () => {
      setupChannelBankTest();
      mockExchangeAdapter.getChannels.mockResolvedValue([createMockWithdrawChannel()]);
      mockExchangeAdapter.getBanks.mockResolvedValue([
        createMockPagaBank(false, { name: 'Stanbic IBTC', code: '999', ref: '3d4d08c1-4811-4fee-9349-a302328e55c1' }),
      ]);
      mockUserRepository.findOne.mockResolvedValue(createMockUserWithDetails());
      mockKycAdapter.getKycDetailsByUserId.mockResolvedValue(createMockKycDetails());
      mockExchangeAdapter.createPayOutRequest.mockResolvedValue(createMockPayOutResponse());
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockRateRepository.findOne.mockResolvedValue({ id: 'rate-123', rate: 1500 });
      mockRateConfigRepository.findOne.mockResolvedValue(createMockRateConfig());
      mockFiatWalletService.getUserWallet.mockResolvedValue({ id: 'wallet-123', balance: 0 });
      mockTransactionRepository.transaction.mockImplementation(async (cb) => cb({}));
      mockTransactionRepository.query.mockReturnValue(createMockQueryBuilder(null));
      mockTransactionService.create.mockResolvedValue({ id: 'new-txn-123' });

      const result = await service.retryExchange('parent-123');

      expect(result).toBeDefined();
    });
  });

  describe('validateUserDetailsForExchange', () => {
    beforeEach(async () => {
      await initializeService();
    });

    const setupUserValidationTest = () => {
      mockTransactionRepository.findById.mockResolvedValue(createMockParentTransaction());
      mockVirtualAccountService.create.mockResolvedValue(createMockVirtualAccount());
      mockExchangeAdapter.getChannels.mockResolvedValue([createMockWithdrawChannel()]);
      mockExchangeAdapter.getBanks.mockResolvedValue([createMockPagaBank()]);
    };

    it('should throw BadRequestException when user not found', async () => {
      setupUserValidationTest();
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.retryExchange('parent-123')).rejects.toThrow(new BadRequestException('User not found'));
    });

    it('should throw BadRequestException when user country is missing', async () => {
      setupUserValidationTest();
      mockUserRepository.findOne.mockResolvedValue(createMockUserWithDetails({ country: null }));

      await expect(service.retryExchange('parent-123')).rejects.toThrow(
        new BadRequestException('User country information is required for exchange operations'),
      );
    });

    it('should throw BadRequestException when user country code is missing', async () => {
      setupUserValidationTest();
      mockUserRepository.findOne.mockResolvedValue(createMockUserWithDetails({ country: { code: null } }));

      await expect(service.retryExchange('parent-123')).rejects.toThrow(
        new BadRequestException('User country code is required for exchange operations'),
      );
    });

    it('should throw BadRequestException when user profile is missing', async () => {
      setupUserValidationTest();
      mockUserRepository.findOne.mockResolvedValue(createMockUserWithDetails({ userProfile: null }));

      await expect(service.retryExchange('parent-123')).rejects.toThrow(
        new BadRequestException('User profile is required for exchange operations'),
      );
    });

    it('should throw BadRequestException when user address is missing', async () => {
      setupUserValidationTest();
      mockUserRepository.findOne.mockResolvedValue(
        createMockUserWithDetails({ userProfile: { address_line1: null, dob: '1990-01-01' } }),
      );

      await expect(service.retryExchange('parent-123')).rejects.toThrow(
        new BadRequestException('User address information is required for exchange operations'),
      );
    });

    it('should throw BadRequestException when user dob is missing', async () => {
      setupUserValidationTest();
      mockUserRepository.findOne.mockResolvedValue(
        createMockUserWithDetails({ userProfile: { address_line1: '123 Street', dob: null } }),
      );

      await expect(service.retryExchange('parent-123')).rejects.toThrow(
        new BadRequestException('User date of birth information is required for exchange operations'),
      );
    });

    it('should throw BadRequestException when user first_name is missing', async () => {
      setupUserValidationTest();
      mockUserRepository.findOne.mockResolvedValue(createMockUserWithDetails({ first_name: null }));

      await expect(service.retryExchange('parent-123')).rejects.toThrow(
        new BadRequestException('User first name is required for exchange operations'),
      );
    });

    it('should throw BadRequestException when user last_name is missing', async () => {
      setupUserValidationTest();
      mockUserRepository.findOne.mockResolvedValue(createMockUserWithDetails({ last_name: null }));

      await expect(service.retryExchange('parent-123')).rejects.toThrow(
        new BadRequestException('User last name is required for exchange operations'),
      );
    });

    it('should throw BadRequestException when user email is missing', async () => {
      setupUserValidationTest();
      mockUserRepository.findOne.mockResolvedValue(createMockUserWithDetails({ email: null }));

      await expect(service.retryExchange('parent-123')).rejects.toThrow(
        new BadRequestException('User email is required for exchange operations'),
      );
    });

    it('should throw BadRequestException when user phone_number is missing', async () => {
      setupUserValidationTest();
      mockUserRepository.findOne.mockResolvedValue(createMockUserWithDetails({ phone_number: null }));

      await expect(service.retryExchange('parent-123')).rejects.toThrow(
        new BadRequestException('User phone number is required for exchange operations'),
      );
    });
  });

  describe('validateKycDetailsForExchange', () => {
    beforeEach(async () => {
      await initializeService();
    });

    const setupKycValidationTest = () => {
      mockTransactionRepository.findById.mockResolvedValue(createMockParentTransaction());
      mockVirtualAccountService.create.mockResolvedValue(createMockVirtualAccount());
      mockExchangeAdapter.getChannels.mockResolvedValue([createMockWithdrawChannel()]);
      mockExchangeAdapter.getBanks.mockResolvedValue([createMockPagaBank()]);
      mockUserRepository.findOne.mockResolvedValue(createMockUserWithDetails());
    };

    it('should throw BadRequestException when KYC details are missing', async () => {
      setupKycValidationTest();
      mockKycAdapter.getKycDetailsByUserId.mockResolvedValue(null);

      await expect(service.retryExchange('parent-123')).rejects.toThrow(
        new BadRequestException('User KYC details is required for exchange operations'),
      );
    });

    it('should throw BadRequestException when KYC data is missing', async () => {
      setupKycValidationTest();
      mockKycAdapter.getKycDetailsByUserId.mockResolvedValue({ data: null });

      await expect(service.retryExchange('parent-123')).rejects.toThrow(
        new BadRequestException('User KYC details is required for exchange operations'),
      );
    });

    it('should throw BadRequestException when ID document number is missing', async () => {
      setupKycValidationTest();
      mockKycAdapter.getKycDetailsByUserId.mockResolvedValue({
        data: { idDocument: { number: null, type: 'PASSPORT' } },
      });

      await expect(service.retryExchange('parent-123')).rejects.toThrow(
        new BadRequestException('User KYC ID document number is required for exchange operations'),
      );
    });

    it('should throw BadRequestException when ID document type is missing', async () => {
      setupKycValidationTest();
      mockKycAdapter.getKycDetailsByUserId.mockResolvedValue({
        data: { idDocument: { number: 'A123', type: null } },
      });

      await expect(service.retryExchange('parent-123')).rejects.toThrow(
        new BadRequestException('User KYC ID document type is required for exchange operations'),
      );
    });

    it('should throw BadRequestException when BVN is missing for Nigerian users', async () => {
      setupKycValidationTest();
      mockKycAdapter.getKycDetailsByUserId.mockResolvedValue({
        data: { idDocument: { number: 'A123', type: 'PASSPORT' }, idNumber: null },
      });

      await expect(service.retryExchange('parent-123')).rejects.toThrow(
        new BadRequestException('BVN information is required for Nigerian users'),
      );
    });
  });

  describe('createYellowCardPayoutRequest', () => {
    beforeEach(async () => {
      await initializeService();
    });

    it('should throw BadRequestException for invalid underlying currency format', async () => {
      mockFiatWalletConfigProvider.getConfig.mockReturnValue({ default_underlying_currency: 'INVALID_FORMAT' });
      await service.onModuleInit();

      setupSuccessfulRetryMocks();

      await expect(service.retryExchange('parent-123')).rejects.toThrow(
        new BadRequestException(
          'Invalid underlying currency format: INVALID_FORMAT. Expected format: CURRENCY.NETWORK',
        ),
      );
    });

    it('should add BVN info for Nigerian users', async () => {
      setupSuccessfulRetryMocks();

      await service.retryExchange('parent-123');

      expect(mockExchangeAdapter.createPayOutRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          sender: expect.objectContaining({
            additionalIdNumber: '12345678901',
            additionalIdType: IdentityDocType.BVN,
          }),
        }),
      );
    });

    it('should not add BVN info for non-Nigerian users', async () => {
      setupSuccessfulRetryMocks({
        parentTransaction: createMockParentTransaction({
          metadata: { destination_country_code: 'GH', rate_id: 'rate-123' },
        }),
      });
      mockUserRepository.findOne.mockResolvedValue(
        createMockUserWithDetails({ country: { code: 'GH' }, phone_number: '+233201234567' }),
      );
      mockKycAdapter.getKycDetailsByUserId.mockResolvedValue({
        data: { idDocument: { number: 'A123', type: 'PASSPORT' } },
      });

      await service.retryExchange('parent-123');

      expect(mockExchangeAdapter.createPayOutRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          sender: expect.not.objectContaining({
            additionalIdNumber: expect.anything(),
          }),
        }),
      );
    });

    it('should map ETH network to ERC20', async () => {
      setupSuccessfulRetryMocks({
        parentTransaction: createMockParentTransaction({
          metadata: { destination_country_code: 'GH', rate_id: 'rate-123' },
        }),
      });
      mockUserRepository.findOne.mockResolvedValue(
        createMockUserWithDetails({ country: { code: 'GH' }, phone_number: '+233201234567' }),
      );
      mockKycAdapter.getKycDetailsByUserId.mockResolvedValue({
        data: { idDocument: { number: 'A123', type: 'PASSPORT' } },
      });

      await service.retryExchange('parent-123');

      expect(mockExchangeAdapter.createPayOutRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          cryptoInfo: expect.objectContaining({
            cryptoNetwork: 'ERC20',
          }),
        }),
      );
    });

    it('should use non-ETH network as-is (e.g., Polygon)', async () => {
      mockFiatWalletConfigProvider.getConfig.mockReturnValue({
        default_underlying_currency: 'USDC.POLYGON',
      });
      await service.onModuleInit();

      setupSuccessfulRetryMocks({
        parentTransaction: createMockParentTransaction({
          metadata: { destination_country_code: 'GH', rate_id: 'rate-123' },
        }),
      });
      mockUserRepository.findOne.mockResolvedValue(
        createMockUserWithDetails({ country: { code: 'GH' }, phone_number: '+233201234567' }),
      );
      mockKycAdapter.getKycDetailsByUserId.mockResolvedValue({
        data: { idDocument: { number: 'A123', type: 'PASSPORT' } },
      });

      await service.retryExchange('parent-123');

      expect(mockExchangeAdapter.createPayOutRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          cryptoInfo: expect.objectContaining({
            cryptoNetwork: 'POLYGON',
          }),
        }),
      );
    });
  });

  describe('getBankAccountAndName', () => {
    beforeEach(async () => {
      await initializeService();
    });

    it('should use test account number in non-production environment', async () => {
      setupSuccessfulRetryMocks({ isProduction: false });
      mockVirtualAccountService.create.mockResolvedValue(
        createMockVirtualAccount({ account_number: '9876543210', account_name: 'Real Account Name' }),
      );

      await service.retryExchange('parent-123');

      expect(mockExchangeAdapter.createPayOutRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          destination: expect.objectContaining({
            accountNumber: '1111111111',
          }),
        }),
      );
    });

    it('should use real account number in production environment', async () => {
      setupSuccessfulRetryMocks({ isProduction: true });
      mockVirtualAccountService.create.mockResolvedValue(
        createMockVirtualAccount({ account_number: '9876543210', account_name: 'Real Account Name' }),
      );

      await service.retryExchange('parent-123');

      expect(mockExchangeAdapter.createPayOutRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          destination: expect.objectContaining({
            accountNumber: '9876543210',
          }),
        }),
      );
    });
  });

  describe('createIncomingNgnTransaction', () => {
    beforeEach(async () => {
      await initializeService();
    });

    it('should return null when rate_id is missing from parent transaction metadata', async () => {
      setupSuccessfulRetryMocks({
        parentTransaction: createMockParentTransaction({ metadata: { destination_country_code: 'NG' } }),
      });

      const result = await service.retryExchange('parent-123');

      expect(result).toBeDefined();
      expect(mockRateRepository.findOne).not.toHaveBeenCalled();
    });

    it('should return null when exchange rate is not found', async () => {
      setupSuccessfulRetryMocks();
      mockRateRepository.findOne.mockResolvedValue(null);

      const result = await service.retryExchange('parent-123');

      expect(result).toBeDefined();
    });

    it('should return null when rate config is not found', async () => {
      setupSuccessfulRetryMocks();
      mockRateConfigRepository.findOne.mockResolvedValue(null);

      const result = await service.retryExchange('parent-123');

      expect(result).toBeDefined();
    });

    it('should create new incoming NGN transaction successfully', async () => {
      setupSuccessfulRetryMocks();

      await service.retryExchange('parent-123');

      expect(mockTransactionService.create).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          transaction_type: TransactionType.EXCHANGE,
          asset: 'NGN',
          status: TransactionStatus.INITIATED,
        }),
        expect.anything(),
      );
    });

    it('should create fiat wallet transaction for new incoming NGN transaction', async () => {
      setupSuccessfulRetryMocks();

      await service.retryExchange('parent-123');

      expect(mockFiatWalletTransactionService.create).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          currency: 'NGN',
          status: TransactionStatus.PROCESSING,
        }),
        expect.anything(),
      );
    });

    it('should handle error in createIncomingNgnTransaction gracefully', async () => {
      setupSuccessfulRetryMocks();
      mockTransactionRepository.transaction.mockRejectedValue(new Error('Database error'));

      const result = await service.retryExchange('parent-123');

      expect(result).toBeDefined();
    });
  });

  describe('environment-based bank identifiers', () => {
    beforeEach(async () => {
      await initializeService();
    });

    it('should use production Paga bank identifiers in production', async () => {
      setupSuccessfulRetryMocks({ isProduction: true });

      const result = await service.retryExchange('parent-123');

      expect(result).toBeDefined();
    });

    it('should use development Stanbic bank identifiers in non-production', async () => {
      setupSuccessfulRetryMocks({ isProduction: false });

      const result = await service.retryExchange('parent-123');

      expect(result).toBeDefined();
    });

    it('should match Paga bank by production code in production environment', async () => {
      (EnvironmentService.isProduction as jest.Mock).mockReturnValue(true);
      mockTransactionRepository.findById.mockResolvedValue(createMockParentTransaction());
      mockVirtualAccountService.create.mockResolvedValue(createMockVirtualAccount());
      mockExchangeAdapter.getChannels.mockResolvedValue([createMockWithdrawChannel()]);
      mockExchangeAdapter.getBanks.mockResolvedValue([
        {
          name: 'Paga',
          code: '327',
          ref: 'e5d96690-40d3-48f4-a745-b9e74566edc4',
          status: BankStatus.ACTIVE,
          channelRefs: ['ch-1'],
        },
      ]);
      mockUserRepository.findOne.mockResolvedValue(createMockUserWithDetails());
      mockKycAdapter.getKycDetailsByUserId.mockResolvedValue(createMockKycDetails());
      mockExchangeAdapter.createPayOutRequest.mockResolvedValue(createMockPayOutResponse());
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockRateRepository.findOne.mockResolvedValue({ id: 'rate-123', rate: 1500 });
      mockRateConfigRepository.findOne.mockResolvedValue(createMockRateConfig());
      mockFiatWalletService.getUserWallet.mockResolvedValue({ id: 'wallet-123', balance: 0 });
      mockTransactionRepository.transaction.mockImplementation(async (cb) => cb({}));
      mockTransactionRepository.query.mockReturnValue(createMockQueryBuilder(null));
      mockTransactionService.create.mockResolvedValue({ id: 'new-txn-123' });
      mockTransactionRepository.update.mockResolvedValue({});

      const result = await service.retryExchange('parent-123');

      expect(result).toBeDefined();
    });

    it('should match Paga bank by production ref in production environment', async () => {
      (EnvironmentService.isProduction as jest.Mock).mockReturnValue(true);
      mockTransactionRepository.findById.mockResolvedValue(createMockParentTransaction());
      mockVirtualAccountService.create.mockResolvedValue(createMockVirtualAccount());
      mockExchangeAdapter.getChannels.mockResolvedValue([createMockWithdrawChannel()]);
      mockExchangeAdapter.getBanks.mockResolvedValue([
        {
          name: 'Paga MFB',
          code: '999',
          ref: 'e5d96690-40d3-48f4-a745-b9e74566edc4',
          status: BankStatus.ACTIVE,
          channelRefs: ['ch-1'],
        },
      ]);
      mockUserRepository.findOne.mockResolvedValue(createMockUserWithDetails());
      mockKycAdapter.getKycDetailsByUserId.mockResolvedValue(createMockKycDetails());
      mockExchangeAdapter.createPayOutRequest.mockResolvedValue(createMockPayOutResponse());
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockRateRepository.findOne.mockResolvedValue({ id: 'rate-123', rate: 1500 });
      mockRateConfigRepository.findOne.mockResolvedValue(createMockRateConfig());
      mockFiatWalletService.getUserWallet.mockResolvedValue({ id: 'wallet-123', balance: 0 });
      mockTransactionRepository.transaction.mockImplementation(async (cb) => cb({}));
      mockTransactionRepository.query.mockReturnValue(createMockQueryBuilder(null));
      mockTransactionService.create.mockResolvedValue({ id: 'new-txn-123' });
      mockTransactionRepository.update.mockResolvedValue({});

      const result = await service.retryExchange('parent-123');

      expect(result).toBeDefined();
    });

    it('should match Stanbic bank by development code in non-production environment', async () => {
      (EnvironmentService.isProduction as jest.Mock).mockReturnValue(false);
      mockTransactionRepository.findById.mockResolvedValue(createMockParentTransaction());
      mockVirtualAccountService.create.mockResolvedValue(createMockVirtualAccount());
      mockExchangeAdapter.getChannels.mockResolvedValue([createMockWithdrawChannel()]);
      mockExchangeAdapter.getBanks.mockResolvedValue([
        {
          name: 'Stanbic IBTC',
          code: '221',
          ref: '3d4d08c1-4811-4fee-9349-a302328e55c1',
          status: BankStatus.ACTIVE,
          channelRefs: ['ch-1'],
        },
      ]);
      mockUserRepository.findOne.mockResolvedValue(createMockUserWithDetails());
      mockKycAdapter.getKycDetailsByUserId.mockResolvedValue(createMockKycDetails());
      mockExchangeAdapter.createPayOutRequest.mockResolvedValue(createMockPayOutResponse());
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockRateRepository.findOne.mockResolvedValue({ id: 'rate-123', rate: 1500 });
      mockRateConfigRepository.findOne.mockResolvedValue(createMockRateConfig());
      mockFiatWalletService.getUserWallet.mockResolvedValue({ id: 'wallet-123', balance: 0 });
      mockTransactionRepository.transaction.mockImplementation(async (cb) => cb({}));
      mockTransactionRepository.query.mockReturnValue(createMockQueryBuilder(null));
      mockTransactionService.create.mockResolvedValue({ id: 'new-txn-123' });
      mockTransactionRepository.update.mockResolvedValue({});

      const result = await service.retryExchange('parent-123');

      expect(result).toBeDefined();
    });

    it('should match Stanbic bank by development ref in non-production environment', async () => {
      (EnvironmentService.isProduction as jest.Mock).mockReturnValue(false);
      mockTransactionRepository.findById.mockResolvedValue(createMockParentTransaction());
      mockVirtualAccountService.create.mockResolvedValue(createMockVirtualAccount());
      mockExchangeAdapter.getChannels.mockResolvedValue([createMockWithdrawChannel()]);
      mockExchangeAdapter.getBanks.mockResolvedValue([
        {
          name: 'Stanbic Bank',
          code: '999',
          ref: '3d4d08c1-4811-4fee-9349-a302328e55c1',
          status: BankStatus.ACTIVE,
          channelRefs: ['ch-1'],
        },
      ]);
      mockUserRepository.findOne.mockResolvedValue(createMockUserWithDetails());
      mockKycAdapter.getKycDetailsByUserId.mockResolvedValue(createMockKycDetails());
      mockExchangeAdapter.createPayOutRequest.mockResolvedValue(createMockPayOutResponse());
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockRateRepository.findOne.mockResolvedValue({ id: 'rate-123', rate: 1500 });
      mockRateConfigRepository.findOne.mockResolvedValue(createMockRateConfig());
      mockFiatWalletService.getUserWallet.mockResolvedValue({ id: 'wallet-123', balance: 0 });
      mockTransactionRepository.transaction.mockImplementation(async (cb) => cb({}));
      mockTransactionRepository.query.mockReturnValue(createMockQueryBuilder(null));
      mockTransactionService.create.mockResolvedValue({ id: 'new-txn-123' });
      mockTransactionRepository.update.mockResolvedValue({});

      const result = await service.retryExchange('parent-123');

      expect(result).toBeDefined();
    });

    it('should find bank using production code when name does not match but code matches', async () => {
      (EnvironmentService.isProduction as jest.Mock).mockReturnValue(true);
      mockTransactionRepository.findById.mockResolvedValue(createMockParentTransaction());
      mockVirtualAccountService.create.mockResolvedValue(createMockVirtualAccount());
      mockExchangeAdapter.getChannels.mockResolvedValue([createMockWithdrawChannel()]);
      // Bank with non-matching name but matching production code 327
      mockExchangeAdapter.getBanks.mockResolvedValue([
        { name: 'Paga MFB Ltd', code: '327', ref: 'different-ref', status: BankStatus.ACTIVE, channelRefs: ['ch-1'] },
      ]);
      mockUserRepository.findOne.mockResolvedValue(createMockUserWithDetails());
      mockKycAdapter.getKycDetailsByUserId.mockResolvedValue(createMockKycDetails());
      mockExchangeAdapter.createPayOutRequest.mockResolvedValue(createMockPayOutResponse());
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockRateRepository.findOne.mockResolvedValue({ id: 'rate-123', rate: 1500 });
      mockRateConfigRepository.findOne.mockResolvedValue(createMockRateConfig());
      mockFiatWalletService.getUserWallet.mockResolvedValue({ id: 'wallet-123', balance: 0 });
      mockTransactionRepository.transaction.mockImplementation(async (cb) => cb({}));
      mockTransactionRepository.query.mockReturnValue(createMockQueryBuilder(null));
      mockTransactionService.create.mockResolvedValue({ id: 'new-txn-123' });
      mockTransactionRepository.update.mockResolvedValue({});

      const result = await service.retryExchange('parent-123');

      expect(result).toBeDefined();
    });
  });

  describe('destination country code fallback', () => {
    beforeEach(async () => {
      await initializeService();
    });

    it('should use NG as default destination country when destination_country_code is missing', async () => {
      setupSuccessfulRetryMocks({
        parentTransaction: createMockParentTransaction({ metadata: { rate_id: 'rate-123' } }),
      });

      await service.retryExchange('parent-123');

      expect(mockExchangeAdapter.getChannels).toHaveBeenCalledWith({ countryCode: 'NG' });
      expect(mockExchangeAdapter.getBanks).toHaveBeenCalledWith({ countryCode: 'NG' });
    });

    it('should use destination_country_code from metadata when provided', async () => {
      setupSuccessfulRetryMocks({
        parentTransaction: createMockParentTransaction({
          metadata: { destination_country_code: 'GH', rate_id: 'rate-123' },
        }),
      });
      mockUserRepository.findOne.mockResolvedValue(
        createMockUserWithDetails({ country: { code: 'GH' }, phone_number: '+233201234567' }),
      );
      mockKycAdapter.getKycDetailsByUserId.mockResolvedValue({
        data: { idDocument: { number: 'A123', type: 'PASSPORT' } },
      });

      await service.retryExchange('parent-123');

      expect(mockExchangeAdapter.getChannels).toHaveBeenCalledWith({ countryCode: 'GH' });
      expect(mockExchangeAdapter.getBanks).toHaveBeenCalledWith({ countryCode: 'GH' });
    });
  });

  describe('handleNgnChildTransaction with different statuses', () => {
    beforeEach(async () => {
      await initializeService();
    });

    it('should proceed with retry when child transaction is COMPLETED', async () => {
      setupSuccessfulRetryMocks({ ngnChildTransaction: { id: 'child-123', status: TransactionStatus.COMPLETED } });

      const result = await service.retryExchange('parent-123');

      expect(result).toBeDefined();
      expect(mockTransactionService.updateStatus).not.toHaveBeenCalled();
    });

    it('should proceed with retry when child transaction is PROCESSING', async () => {
      setupSuccessfulRetryMocks({ ngnChildTransaction: { id: 'child-123', status: TransactionStatus.PROCESSING } });

      const result = await service.retryExchange('parent-123');

      expect(result).toBeDefined();
      expect(mockTransactionService.updateStatus).not.toHaveBeenCalled();
    });

    it('should proceed with retry when child transaction is PENDING', async () => {
      setupSuccessfulRetryMocks({ ngnChildTransaction: { id: 'child-123', status: TransactionStatus.PENDING } });

      const result = await service.retryExchange('parent-123');

      expect(result).toBeDefined();
      expect(mockTransactionService.updateStatus).not.toHaveBeenCalled();
    });

    it('should proceed with retry when child transaction has undefined status', async () => {
      setupSuccessfulRetryMocks({ ngnChildTransaction: { id: 'child-123', status: undefined, metadata: {} } });

      const result = await service.retryExchange('parent-123');

      expect(result).toBeDefined();
      expect(mockTransactionService.updateStatus).not.toHaveBeenCalled();
    });

    it('should proceed with retry when child transaction has RECONCILE status', async () => {
      setupSuccessfulRetryMocks({ ngnChildTransaction: { id: 'child-123', status: TransactionStatus.RECONCILE } });

      const result = await service.retryExchange('parent-123');

      expect(result).toBeDefined();
      expect(mockTransactionService.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('fee calculation with different configurations', () => {
    beforeEach(async () => {
      await initializeService();
    });

    it('should calculate fees correctly with percentage partner fee', async () => {
      setupSuccessfulRetryMocks();
      mockRateConfigRepository.findOne.mockResolvedValue(
        createMockRateConfig({
          is_partner_fee_percentage: true,
          partner_fee: 2,
          is_disbursement_fee_percentage: false,
          disbursement_fee: 100,
        }),
      );

      const result = await service.retryExchange('parent-123');

      expect(result).toBeDefined();
      expect(mockTransactionService.create).toHaveBeenCalled();
    });

    it('should calculate fees correctly with flat partner fee', async () => {
      setupSuccessfulRetryMocks();
      mockRateConfigRepository.findOne.mockResolvedValue(
        createMockRateConfig({
          is_partner_fee_percentage: false,
          partner_fee: 5,
          is_disbursement_fee_percentage: true,
          disbursement_fee: 1,
        }),
      );

      const result = await service.retryExchange('parent-123');

      expect(result).toBeDefined();
      expect(mockTransactionService.create).toHaveBeenCalled();
    });

    it('should handle null partner_fee with percentage fee', async () => {
      setupSuccessfulRetryMocks();
      mockRateConfigRepository.findOne.mockResolvedValue(
        createMockRateConfig({
          is_partner_fee_percentage: true,
          partner_fee: null,
          is_disbursement_fee_percentage: false,
          disbursement_fee: 100,
        }),
      );

      const result = await service.retryExchange('parent-123');

      expect(result).toBeDefined();
      expect(mockTransactionService.create).toHaveBeenCalled();
    });

    it('should handle undefined partner_fee with flat fee', async () => {
      setupSuccessfulRetryMocks();
      mockRateConfigRepository.findOne.mockResolvedValue(
        createMockRateConfig({
          is_partner_fee_percentage: false,
          partner_fee: undefined,
          is_disbursement_fee_percentage: false,
          disbursement_fee: 100,
        }),
      );

      const result = await service.retryExchange('parent-123');

      expect(result).toBeDefined();
      expect(mockTransactionService.create).toHaveBeenCalled();
    });

    it('should handle null disbursement_fee with percentage fee', async () => {
      setupSuccessfulRetryMocks();
      mockRateConfigRepository.findOne.mockResolvedValue(
        createMockRateConfig({
          is_partner_fee_percentage: false,
          partner_fee: 5,
          is_disbursement_fee_percentage: true,
          disbursement_fee: null,
        }),
      );

      const result = await service.retryExchange('parent-123');

      expect(result).toBeDefined();
      expect(mockTransactionService.create).toHaveBeenCalled();
    });

    it('should handle undefined disbursement_fee with flat fee', async () => {
      setupSuccessfulRetryMocks();
      mockRateConfigRepository.findOne.mockResolvedValue(
        createMockRateConfig({
          is_partner_fee_percentage: false,
          partner_fee: 5,
          is_disbursement_fee_percentage: false,
          disbursement_fee: undefined,
        }),
      );

      const result = await service.retryExchange('parent-123');

      expect(result).toBeDefined();
      expect(mockTransactionService.create).toHaveBeenCalled();
    });
  });

  describe('retryExchange metadata updates', () => {
    beforeEach(async () => {
      await initializeService();
    });

    it('should increment retry_count when retrying', async () => {
      const parentTransaction = createMockParentTransaction({
        metadata: { destination_country_code: 'NG', rate_id: 'rate-123', retry_count: 2 },
      });
      setupSuccessfulRetryMocks({ parentTransaction });

      await service.retryExchange('parent-123');

      expect(mockTransactionRepository.update).toHaveBeenCalledWith(
        parentTransaction.id,
        expect.objectContaining({
          metadata: expect.objectContaining({
            retry_count: 3,
          }),
        }),
      );
    });

    it('should set retry_count to 1 when no previous retry_count exists', async () => {
      const parentTransaction = createMockParentTransaction({
        metadata: { destination_country_code: 'NG', rate_id: 'rate-123' },
      });
      setupSuccessfulRetryMocks({ parentTransaction });

      await service.retryExchange('parent-123');

      expect(mockTransactionRepository.update).toHaveBeenCalledWith(
        parentTransaction.id,
        expect.objectContaining({
          metadata: expect.objectContaining({
            retry_count: 1,
          }),
        }),
      );
    });

    it('should handle parent transaction with undefined metadata', async () => {
      const parentTransaction = createMockParentTransaction({ metadata: undefined });
      setupSuccessfulRetryMocks({ parentTransaction });

      await service.retryExchange('parent-123');

      expect(mockExchangeAdapter.getChannels).toHaveBeenCalledWith({ countryCode: 'NG' });
    });
  });

  describe('asset case sensitivity', () => {
    beforeEach(async () => {
      await initializeService();
    });

    it('should accept lowercase usd asset', async () => {
      const parentTransaction = createMockParentTransaction({ asset: 'usd' });
      setupSuccessfulRetryMocks({ parentTransaction });

      const result = await service.retryExchange('parent-123');

      expect(result).toBeDefined();
    });

    it('should accept mixed case Usd asset', async () => {
      const parentTransaction = createMockParentTransaction({ asset: 'Usd' });
      setupSuccessfulRetryMocks({ parentTransaction });

      const result = await service.retryExchange('parent-123');

      expect(result).toBeDefined();
    });
  });

  describe('bank status validation', () => {
    beforeEach(async () => {
      await initializeService();
    });

    it('should find bank with uppercase ACTIVE status', async () => {
      setupSuccessfulRetryMocks();
      mockExchangeAdapter.getBanks.mockResolvedValue([createMockPagaBank(false, { status: 'ACTIVE' })]);

      const result = await service.retryExchange('parent-123');

      expect(result).toBeDefined();
    });

    it('should find bank with lowercase active status', async () => {
      setupSuccessfulRetryMocks();
      mockExchangeAdapter.getBanks.mockResolvedValue([createMockPagaBank(false, { status: 'active' })]);

      const result = await service.retryExchange('parent-123');

      expect(result).toBeDefined();
    });
  });
});
