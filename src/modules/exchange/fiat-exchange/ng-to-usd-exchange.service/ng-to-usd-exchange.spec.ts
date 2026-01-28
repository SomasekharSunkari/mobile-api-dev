import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DateTime } from 'luxon';
import { ExchangeAdapter } from '../../../../adapters/exchange/exchange.adapter';
import { KYCAdapter } from '../../../../adapters/kyc/kyc-adapter';
import { WaasAdapter } from '../../../../adapters/waas/waas.adapter';
import { EnvironmentService } from '../../../../config/environment';
import {
  YELLOWCARD_COLLECTION_SUCCESS_CRYPTO_CURRENCY,
  YELLOWCARD_COLLECTION_SUCCESS_CRYPTO_NETWORK,
  YELLOWCARD_COLLECTION_SUCCESS_WALLET_ADDRESS,
} from '../../../../constants/constants';
import { CurrencyUtility } from '../../../../currencies';
import { TransactionStatus } from '../../../../database/models/transaction';
import { LockerService } from '../../../../services/locker/locker.service';
import { UserRepository } from '../../../auth/user/user.repository';
import { DepositAddressService } from '../../../depositAddress/depositAddress.service';
import { FiatWalletService } from '../../../fiatWallet';
import { FiatWalletEscrowService } from '../../../fiatWallet/fiatWalletEscrow.service';
import { FiatWalletTransactionRepository } from '../../../fiatWalletTransactions/fiatWalletTransactions.repository';
import { FiatWalletTransactionService } from '../../../fiatWalletTransactions/fiatWalletTransactions.service';
import { PagaLedgerAccountService } from '../../../pagaLedgerAccount/pagaLedgerAccount.service';
import { RateRepository } from '../../../rate/rate.repository';
import { RateService } from '../../../rate/rate.service';
import { RateConfigRepository } from '../../../rateConfig/rateConfig.repository';
import { TransactionRepository } from '../../../transaction';
import { TransactionService } from '../../../transaction/transaction.service';
import { UserTierService } from '../../../userTier';
import { VirtualAccountService } from '../../../virtualAccount';

// Mock the FiatExchangeService to break circular dependency
jest.mock('../fiat-exchange.service', () => ({
  FiatExchangeService: jest.fn().mockImplementation(() => ({
    getValidatedVirtualAccount: jest.fn(),
  })),
}));

// Mock the ExecuteNgUsdExchangeProcessor to break circular dependency
jest.mock('../../../../services/queue/processors/exchange/execute-ng-usd-exchange.processor', () => ({
  ExecuteNgUsdExchangeProcessor: jest.fn().mockImplementation(() => ({
    queueExecuteNgToUSDExchange: jest.fn(),
  })),
}));

import { ExecuteNgUsdExchangeProcessor } from '../../../../services/queue/processors/exchange/execute-ng-usd-exchange.processor';
import { FiatExchangeService } from '../fiat-exchange.service';
import { NgToUsdExchangeEscrowService } from './ng-to-usd-exchange.escrow.service';
import { NgToUsdExchangeService } from './ng-to-usd-exchange.service';

/**
 * Helper function to create a mock rate config with the new config structure
 */
function createMockRateConfig(overrides?: {
  id?: string;
  provider?: string;
  ngn_withdrawal_fee?: number;
  is_ngn_withdrawal_fee_percentage?: boolean;
  ngn_withdrawal_fee_cap?: number;
  is_active?: boolean;
}) {
  const ngnWithdrawalFee = overrides?.ngn_withdrawal_fee ?? 50;
  const isPercentage = overrides?.is_ngn_withdrawal_fee_percentage ?? false;
  const cap = overrides?.ngn_withdrawal_fee_cap ?? 500;
  const isActive = overrides?.is_active ?? true;

  return {
    id: overrides?.id ?? 'rate-config-123',
    provider: overrides?.provider ?? 'yellowcard',
    description: null,
    config: {
      fiat_exchange: {
        service_fee: { value: 0, currency: null, is_percentage: false },
        partner_fee: { value: 0, currency: null, is_percentage: false },
        disbursement_fee: { value: 0, currency: null, is_percentage: false },
        ngn_withdrawal_fee: { value: ngnWithdrawalFee, is_percentage: isPercentage, cap },
      },
      is_active: isActive,
    },
    get isActive() {
      return this.config?.is_active ?? false;
    },
    get fiatExchange() {
      return this.config?.fiat_exchange;
    },
    get ngnWithdrawalFee() {
      return this.config?.fiat_exchange?.ngn_withdrawal_fee;
    },
  };
}

jest.mock('../../../../config/environment', () => ({
  EnvironmentService: {
    isProduction: jest.fn().mockReturnValue(false),
    getValue: jest.fn().mockImplementation((key: string) => {
      const values: Record<string, string> = {
        DEFAULT_UNDERLYING_CURRENCY: 'USDC.ETH',
        BUSINESS_NAME: 'Test Business',
        BUSINESS_CAC_NUMBER: 'CAC123456',
      };
      return values[key] || 'USDC.ETH';
    }),
    getValues: jest.fn(() => ({
      db_host: 'localhost',
      db_password: 'test',
      db_user: 'test',
      db_name: 'test',
      db_port: 5432,
      db_ssl: false,
    })),
  },
}));

jest.mock('../../../../database/database.connection', () => ({
  KnexDB: {
    connection: jest.fn(() => ({
      raw: jest.fn(),
      destroy: jest.fn(),
    })),
  },
}));

describe('NgToUsdExchangeService', () => {
  let service: NgToUsdExchangeService;
  let lockerService: jest.Mocked<LockerService>;
  let rateRepository: jest.Mocked<RateRepository>;
  let transactionRepository: jest.Mocked<TransactionRepository>;
  let fiatWalletTransactionRepository: jest.Mocked<FiatWalletTransactionRepository>;
  let fiatWalletService: jest.Mocked<FiatWalletService>;
  let transactionService: jest.Mocked<TransactionService>;
  let fiatWalletTransactionService: jest.Mocked<FiatWalletTransactionService>;
  let executeNgUsdExchangeProcessor: jest.Mocked<ExecuteNgUsdExchangeProcessor>;
  let exchangeAdapter: jest.Mocked<ExchangeAdapter>;
  let depositAddressService: jest.Mocked<DepositAddressService>;
  let kycAdapter: jest.Mocked<KYCAdapter>;
  let userRepository: jest.Mocked<UserRepository>;
  let userTierService: jest.Mocked<UserTierService>;
  let fiatWalletEscrowService: jest.Mocked<FiatWalletEscrowService>;
  let rateConfigRepository: jest.Mocked<RateConfigRepository>;
  let rateService: jest.Mocked<RateService>;
  let ngToUsdExchangeEscrowService: jest.Mocked<NgToUsdExchangeEscrowService>;
  let virtualAccountService: jest.Mocked<VirtualAccountService>;
  // These are used by the service but tests don't directly assert on them
  let _pagaLedgerAccountService: jest.Mocked<PagaLedgerAccountService>;
  let _waasAdapter: jest.Mocked<WaasAdapter>;

  console.log(_pagaLedgerAccountService, _waasAdapter);

  const mockUser = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    phone_number: '+2348012345678',
    userProfile: {
      id: 'profile-123',
      user_id: 'user-123',
      address_line1: '123 Test St',
      dob: '1990-01-01',
    },
    country: {
      id: 'country-1',
      code: 'NG',
      name: 'Nigeria',
    },
  };

  const mockRate = {
    id: 'rate-123',
    rate: 160000,
    buying_currency_code: 'USD',
    selling_currency_code: 'NGN',
    provider: 'yellowcard',
    provider_rate_ref: 'rate-ref-123',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  };

  const mockChannel = {
    ref: 'channel-123',
    status: 'active',
    rampType: 'deposit',
    min: 1000,
    max: 1000000,
  };

  const mockNetwork = {
    ref: 'network-123',
    status: 'active',
    channelRefs: ['channel-123'],
  };

  const mockDepositAddress = {
    id: 'address-123',
    user_id: 'user-123',
    address: '0x123456789',
    asset: 'USDC.ETH',
  };

  const mockKycDetails = {
    data: {
      idDocument: {
        number: 'A12345678',
        type: 'PASSPORT',
      },
      idNumber: '12345678901',
      country: 'NGA',
      additionalIdDocuments: [
        {
          type: 'NIN',
          number: '98765432101',
        },
      ],
    },
  };

  const mockKycDetailsWithoutNIN = {
    data: {
      idDocument: {
        number: 'A12345678',
        type: 'PASSPORT',
      },
      idNumber: '12345678901',
      country: 'NGA',
      additionalIdDocuments: [],
    },
  };
  console.log('🚀 ~~ mockKycDetailsWithoutNIN:', mockKycDetailsWithoutNIN);

  const mockPayInRequest = {
    ref: 'payin-ref-123',
    feeLocal: 50,
    networkFeeLocal: 25,
    partnerFeeLocal: 10,
    feeUSD: 0.05,
    networkFeeUSD: 0.025,
    partnerFeeUSD: 0.01,
    receiverCryptoInfo: {
      cryptoAmount: 10.5,
    },
  };

  const mockTransaction = {
    id: 'txn-123',
    user_id: 'user-123',
    amount: 10000,
    status: TransactionStatus.INITIATED,
    transaction_type: 'exchange',
    external_reference: 'ext-ref-123',
    reference: 'ref-123',
    metadata: {
      source_currency: 'NGN',
      destination_currency: 'USD',
      from_currency_code: 'NGN',
      source_user_id: 'user-123',
      destination_user_id: 'user-123',
      expires_at: DateTime.now().plus({ minutes: 10 }).toSQL(),
      local_fee: 8500,
      usd_fee: 850,
      rate_id: 'rate-123',
    },
    fiatWalletTransaction: {
      id: 'fiat-txn-123',
      transaction_id: 'txn-123',
      user_id: 'user-123',
      fiat_wallet_id: 'wallet-123',
      amount: 10000,
      currency: 'NGN',
      status: TransactionStatus.INITIATED,
      provider_metadata: {},
    },
  };

  const mockFiatWallet = {
    id: 'wallet-123',
    user_id: 'user-123',
    currency: 'NGN',
    balance: 100000000,
  };

  const mockVirtualAccount = {
    id: 'virtual-account-123',
    user_id: 'user-123',
    account_number: '1234567890',
    account_name: 'Test User',
    bank_name: 'Test Bank',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NgToUsdExchangeService,
        {
          provide: LockerService,
          useValue: {
            withLock: jest.fn((lockKey, callback) => callback()),
          },
        },
        {
          provide: UserTierService,
          useValue: {
            getAssetLimits: jest.fn(),
          },
        },
        {
          provide: RateRepository,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: TransactionRepository,
          useValue: {
            findOne: jest.fn(),
            update: jest.fn(),
            transaction: jest.fn((callback) => callback()),
          },
        },
        {
          provide: FiatWalletTransactionRepository,
          useValue: {
            update: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: FiatWalletService,
          useValue: {
            getUserWallet: jest.fn(),
            checkIfUserHasEnoughBalanceOrThrow: jest.fn(),
            updateBalance: jest.fn(),
          },
        },
        {
          provide: FiatWalletEscrowService,
          useValue: {
            moveMoneyToEscrow: jest.fn(),
            releaseMoneyFromEscrow: jest.fn(),
            getEscrowAmount: jest.fn(),
          },
        },
        {
          provide: TransactionService,
          useValue: {
            create: jest.fn(),
            updateStatus: jest.fn(),
          },
        },
        {
          provide: FiatWalletTransactionService,
          useValue: {
            create: jest.fn(),
            updateStatus: jest.fn(),
          },
        },
        {
          provide: ExecuteNgUsdExchangeProcessor,
          useValue: {
            queueExecuteNgToUSDExchange: jest.fn(),
          },
        },
        {
          provide: ExchangeAdapter,
          useValue: {
            createPayInRequest: jest.fn(),
            getChannels: jest.fn(),
            getBanks: jest.fn(),
          },
        },
        {
          provide: DepositAddressService,
          useValue: {
            getDepositAddresses: jest.fn(),
          },
        },
        {
          provide: KYCAdapter,
          useValue: {
            getKycDetailsByUserId: jest.fn(),
          },
        },
        {
          provide: UserRepository,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: FiatExchangeService,
          useValue: {
            getValidatedVirtualAccount: jest.fn(),
          },
        },
        {
          provide: RateConfigRepository,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: RateService,
          useValue: {
            validateRateOrThrow: jest.fn(),
          },
        },
        {
          provide: PagaLedgerAccountService,
          useValue: {
            depositMoney: jest.fn(),
          },
        },
        {
          provide: VirtualAccountService,
          useValue: {
            findOneByUserIdOrThrow: jest.fn(),
            findOrCreateVirtualAccount: jest.fn(),
          },
        },
        {
          provide: WaasAdapter,
          useValue: {
            getProvider: jest.fn(() => ({
              getProviderName: jest.fn(() => 'paga'),
            })),
          },
        },
        {
          provide: NgToUsdExchangeEscrowService,
          useValue: {
            storeTransactionData: jest.fn(),
            getTransactionData: jest.fn(),
            removeTransactionData: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NgToUsdExchangeService>(NgToUsdExchangeService);
    lockerService = module.get(LockerService);
    rateRepository = module.get(RateRepository);
    transactionRepository = module.get(TransactionRepository);
    fiatWalletTransactionRepository = module.get(FiatWalletTransactionRepository);
    fiatWalletService = module.get(FiatWalletService);
    transactionService = module.get(TransactionService);
    fiatWalletTransactionService = module.get(FiatWalletTransactionService);
    executeNgUsdExchangeProcessor = module.get(ExecuteNgUsdExchangeProcessor);
    exchangeAdapter = module.get(ExchangeAdapter);
    depositAddressService = module.get(DepositAddressService);
    kycAdapter = module.get(KYCAdapter);
    userRepository = module.get(UserRepository);
    userTierService = module.get(UserTierService);
    fiatWalletEscrowService = module.get(FiatWalletEscrowService);
    rateConfigRepository = module.get(RateConfigRepository);
    rateService = module.get(RateService);
    ngToUsdExchangeEscrowService = module.get(NgToUsdExchangeEscrowService);
    virtualAccountService = module.get(VirtualAccountService);
    _pagaLedgerAccountService = module.get(PagaLedgerAccountService);
    _waasAdapter = module.get(WaasAdapter);

    jest.clearAllMocks();
  });

  describe('initializeNgToUSDExchange', () => {
    const payload = {
      from: 'NGN',
      to: 'USD',
      amount: 10000,
      rate_id: 'rate-123',
    };

    beforeEach(() => {
      userTierService.getAssetLimits.mockResolvedValue({
        id: 'tier-config-123',
        tier_id: 'tier-123',
        country_id: 'country-1',
        minimum_balance: 0,
        maximum_balance: 10000000,
        minimum_per_deposit: 100,
        maximum_per_deposit: 1000000,
        maximum_daily_deposit: 5000000,
        maximum_monthly_deposit: 20000000,
        minimum_transaction_amount: 1000,
        maximum_transaction_amount: 1000000,
        maximum_daily_transaction: 5000000,
        maximum_weekly_deposit: 10000000,
        maximum_weekly_transaction: 25000000,
        minimum_per_withdrawal: 100,
        maximum_per_withdrawal: 1000000,
        maximum_daily_withdrawal: 5000000,
        maximum_weekly_withdrawal: 10000000,
        maximum_monthly_withdrawal: 20000000,
        maximum_monthly_transaction: 50000000,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      } as any);

      rateRepository.findOne.mockResolvedValue(mockRate as any);
      userRepository.findOne.mockResolvedValue(mockUser as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet as any);
      fiatWalletService.checkIfUserHasEnoughBalanceOrThrow.mockImplementation(async (userId, amount, currency) => {
        // Simulate the real implementation by calling getUserWallet and checking balance
        const wallet = await fiatWalletService.getUserWallet(userId, currency);
        const amountInSmallestUnit = CurrencyUtility.formatCurrencyAmountToSmallestUnit(amount, currency);
        if (wallet.balance < amountInSmallestUnit) {
          throw new BadRequestException('Insufficient balance');
        }
      });
      exchangeAdapter.getChannels.mockResolvedValue([mockChannel] as any);
      exchangeAdapter.getBanks.mockResolvedValue([mockNetwork] as any);
      depositAddressService.getDepositAddresses.mockResolvedValue([mockDepositAddress] as any);
      kycAdapter.getKycDetailsByUserId.mockResolvedValue(mockKycDetails as any);
      exchangeAdapter.createPayInRequest.mockResolvedValue(mockPayInRequest as any);
      transactionService.create.mockResolvedValue(mockTransaction as any);
      fiatWalletTransactionService.create.mockResolvedValue(mockTransaction.fiatWalletTransaction as any);
      transactionRepository.update.mockResolvedValue(mockTransaction as any);
      fiatWalletTransactionRepository.update.mockResolvedValue(mockTransaction.fiatWalletTransaction as any);
      fiatWalletService.updateBalance.mockResolvedValue(undefined);
      fiatWalletEscrowService.moveMoneyToEscrow.mockResolvedValue(undefined);
      rateConfigRepository.findOne.mockResolvedValue(createMockRateConfig() as any);
      rateService.validateRateOrThrow.mockResolvedValue(undefined);
      ngToUsdExchangeEscrowService.storeTransactionData.mockResolvedValue(undefined);
      ngToUsdExchangeEscrowService.getTransactionData.mockResolvedValue(null);
      ngToUsdExchangeEscrowService.removeTransactionData.mockResolvedValue(undefined);
    });

    it('should successfully initialize NG to USD exchange', async () => {
      const result = await service.initializeNgToUSDExchange('user-123', payload);

      expect(result).toBeDefined();
      expect(result.sourceTransactionId).toBeDefined();
      expect(result.rateInMainUnit).toBeDefined();
      expect(result.amountToReceiveUSD).toBe(10.5);
      expect(rateRepository.findOne).toHaveBeenCalledWith({ id: payload.rate_id });
      expect(userRepository.findOne).toHaveBeenCalled();
      expect(ngToUsdExchangeEscrowService.storeTransactionData).toHaveBeenCalled();
    });

    it('should throw error if rate not found', async () => {
      rateRepository.findOne.mockResolvedValue(null);

      await expect(service.initializeNgToUSDExchange('user-123', payload)).rejects.toThrow();
    });

    it('should throw error if rate is not to buy dollar', async () => {
      const invalidRate = { ...mockRate, buying_currency_code: 'EUR' };
      rateRepository.findOne.mockResolvedValue(invalidRate as any);

      await expect(service.initializeNgToUSDExchange('user-123', payload)).rejects.toThrow();
    });

    it('should throw error if user has insufficient balance', async () => {
      const lowBalanceWallet = { ...mockFiatWallet, balance: 100 };
      fiatWalletService.getUserWallet.mockResolvedValue(lowBalanceWallet as any);

      await expect(service.initializeNgToUSDExchange('user-123', payload)).rejects.toThrow();
    });

    it('should throw error if amount is less than minimum', async () => {
      const lowAmountPayload = { ...payload, amount: 500 };

      await expect(service.initializeNgToUSDExchange('user-123', lowAmountPayload)).rejects.toThrow();
    });

    it('should throw error if amount is greater than maximum', async () => {
      const highAmountPayload = { ...payload, amount: 2000000 };

      await expect(service.initializeNgToUSDExchange('user-123', highAmountPayload)).rejects.toThrow();
    });

    it('should store transaction data in redis', async () => {
      await service.initializeNgToUSDExchange('user-123', payload);

      expect(ngToUsdExchangeEscrowService.storeTransactionData).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          transactionReference: expect.any(String),
          fromCurrency: 'NGN',
          from: 'NGN',
          to: 'USD',
          amount: payload.amount,
        }),
      );
    });

    it('should create pay in request with correct data', async () => {
      await service.initializeNgToUSDExchange('user-123', payload);

      expect(exchangeAdapter.createPayInRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          channelRef: mockChannel.ref,
          networkRef: mockNetwork.ref,
          currencyCode: 'NGN',
          customerType: 'institution',
          sender: expect.objectContaining({
            businessName: 'Test Business',
            businessIdNumber: 'CAC123456',
          }),
        }),
      );
    });

    it('should use test wallet address in non-production environment', async () => {
      await service.initializeNgToUSDExchange('user-123', payload);

      expect(exchangeAdapter.createPayInRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          receiver: expect.objectContaining({
            walletAddress: YELLOWCARD_COLLECTION_SUCCESS_WALLET_ADDRESS,
            cryptoCurrency: YELLOWCARD_COLLECTION_SUCCESS_CRYPTO_CURRENCY,
            cryptoNetwork: YELLOWCARD_COLLECTION_SUCCESS_CRYPTO_NETWORK,
          }),
        }),
      );
    });

    it('should return pay in request in response', async () => {
      const result = await service.initializeNgToUSDExchange('user-123', payload);

      expect(result.payInRequest).toBeDefined();
      expect(result.payInRequest.ref).toBe(mockPayInRequest.ref);
    });

    it('should use lock to prevent concurrent operations', async () => {
      await service.initializeNgToUSDExchange('user-123', payload);

      expect(lockerService.withLock).toHaveBeenCalledWith(
        expect.stringContaining('exchange:user-123'),
        expect.any(Function),
        expect.any(Object),
      );
    });

    it('should throw error if user has no deposit address', async () => {
      depositAddressService.getDepositAddresses.mockResolvedValue([]);

      await expect(service.initializeNgToUSDExchange('user-123', payload)).rejects.toThrow();
    });

    it('should throw error if user KYC not found', async () => {
      kycAdapter.getKycDetailsByUserId.mockResolvedValue(null);

      await expect(service.initializeNgToUSDExchange('user-123', payload)).rejects.toThrow();
    });

    it('should use institution customer type for business transactions', async () => {
      await service.initializeNgToUSDExchange('user-123', payload);

      expect(exchangeAdapter.createPayInRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          customerType: 'institution',
          sender: expect.objectContaining({
            businessName: 'Test Business',
            businessIdNumber: 'CAC123456',
          }),
        }),
      );
    });

    it('should throw error if no active deposit channel found', async () => {
      exchangeAdapter.getChannels.mockResolvedValue([]);

      await expect(service.initializeNgToUSDExchange('user-123', payload)).rejects.toThrow();
    });

    it('should throw error if no active bank found', async () => {
      exchangeAdapter.getBanks.mockResolvedValue([]);

      await expect(service.initializeNgToUSDExchange('user-123', payload)).rejects.toThrow();
    });

    it('should calculate fees correctly', async () => {
      const result = await service.initializeNgToUSDExchange('user-123', payload);

      // Total fee local = 50 (feeLocal) + 25 (networkFeeLocal) + 10 (partnerFeeLocal) = 85
      // NGN withdrawal fee = 50 (fixed fee from rate config)
      // Total feeLocal = 85 + 50 = 135
      expect(result.feeLocal).toBe(135);

      // Total fee USD = 0.05 + 0.025 + 0.01 = 0.085
      // NGN withdrawal fee in USD = 50 / 1600 (rateInMainUnit) = 0.03125
      // Total feeUSD = 0.085 + 0.03125 = 0.11625
      expect(result.feeUSD).toBeCloseTo(0.11625, 4);
      expect(result.totalAmountToPayLocal).toBeGreaterThan(result.localAmount);
    });
  });

  describe('executeExchange', () => {
    const executePayload = {
      transaction_id: 'txn-ref-123',
    };

    const mockStoredTransactionData = {
      transactionReference: 'txn-ref-123',
      activeChannelRef: 'channel-123',
      activeNetworkRef: 'network-123',
      transferType: 'deposit',
      fromCurrency: 'NGN',
      amount: 10000,
      from: 'NGN',
      to: 'USD',
      destinationWalletAddress: '0x123456789',
      rate: mockRate,
      minimumLocalAmount: 1000,
      maximumLocalAmount: 1000000,
      rateInMainUnit: 1600,
    };

    beforeEach(() => {
      ngToUsdExchangeEscrowService.getTransactionData.mockResolvedValue(mockStoredTransactionData);
      transactionRepository.findOne.mockResolvedValue(mockTransaction as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet as any);
      fiatWalletService.checkIfUserHasEnoughBalanceOrThrow.mockImplementation(async (userId, amount, currency) => {
        const wallet = await fiatWalletService.getUserWallet(userId, currency);
        const amountInSmallestUnit = CurrencyUtility.formatCurrencyAmountToSmallestUnit(amount, currency);
        if (wallet.balance < amountInSmallestUnit) {
          throw new BadRequestException('Insufficient balance');
        }
      });
      transactionService.updateStatus.mockResolvedValue(mockTransaction as any);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(mockTransaction.fiatWalletTransaction as any);
      virtualAccountService.findOrCreateVirtualAccount.mockResolvedValue(mockVirtualAccount as any);
      executeNgUsdExchangeProcessor.queueExecuteNgToUSDExchange.mockResolvedValue({ id: 'job-123' } as any);
      fiatWalletTransactionRepository.findOne.mockResolvedValue(mockTransaction.fiatWalletTransaction as any);
      fiatWalletEscrowService.getEscrowAmount.mockResolvedValue(0);
    });

    it('should successfully execute exchange', async () => {
      const result = await service.executeExchange(mockUser as any, executePayload as any);

      expect(result).toBeDefined();
      expect(result.status).toBe('processing');
      expect(result.transactionRef).toBe(mockStoredTransactionData.transactionReference);
      expect(result.jobId).toBe('job-123');
    });

    it('should get transaction data from redis', async () => {
      await service.executeExchange(mockUser as any, executePayload as any);

      expect(ngToUsdExchangeEscrowService.getTransactionData).toHaveBeenCalledWith(executePayload.transaction_id);
    });

    it('should throw error if transaction data not found in redis', async () => {
      ngToUsdExchangeEscrowService.getTransactionData.mockResolvedValue(null);

      await expect(service.executeExchange(mockUser as any, executePayload as any)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should get validated virtual account', async () => {
      await service.executeExchange(mockUser as any, executePayload as any);

      expect(virtualAccountService.findOrCreateVirtualAccount).toHaveBeenCalledWith(
        mockUser.id,
        {
          fiat_wallet_id: null,
          transaction_id: executePayload.transaction_id,
        },
        'main_account',
      );
    });

    it('should queue execute exchange job with correct data', async () => {
      await service.executeExchange(mockUser as any, executePayload as any);

      expect(executeNgUsdExchangeProcessor.queueExecuteNgToUSDExchange).toHaveBeenCalledWith({
        transactionReference: mockStoredTransactionData.transactionReference,
        accountNumber: mockVirtualAccount.account_number,
        rateId: mockStoredTransactionData.rate?.id,
        userId: mockUser.id,
      });
    });

    it('should throw InternalServerErrorException if job creation fails', async () => {
      executeNgUsdExchangeProcessor.queueExecuteNgToUSDExchange.mockResolvedValue(null);

      await expect(service.executeExchange(mockUser as any, executePayload as any)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should use lock to prevent concurrent operations', async () => {
      await service.executeExchange(mockUser as any, executePayload as any);

      expect(lockerService.withLock).toHaveBeenCalledWith(
        expect.stringContaining('exchange:user-123'),
        expect.any(Function),
        expect.any(Object),
      );
    });
  });

  describe('Institution customer type behavior', () => {
    const payload = {
      from: 'NGN',
      to: 'USD',
      amount: 10000,
      rate_id: 'rate-123',
    };

    beforeEach(() => {
      userTierService.getAssetLimits.mockResolvedValue({
        id: 'tier-config-123',
        tier_id: 'tier-123',
        country_id: 'country-1',
        minimum_balance: 0,
        maximum_balance: 10000000,
        minimum_per_deposit: 100,
        maximum_per_deposit: 1000000,
        maximum_daily_deposit: 5000000,
        maximum_monthly_deposit: 20000000,
        minimum_transaction_amount: 1000,
        maximum_transaction_amount: 1000000,
        maximum_daily_transaction: 5000000,
        maximum_weekly_deposit: 10000000,
        maximum_weekly_transaction: 25000000,
        minimum_per_withdrawal: 100,
        maximum_per_withdrawal: 1000000,
        maximum_daily_withdrawal: 5000000,
        maximum_weekly_withdrawal: 10000000,
        maximum_monthly_withdrawal: 20000000,
        maximum_monthly_transaction: 50000000,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      } as any);

      rateRepository.findOne.mockResolvedValue(mockRate as any);
      userRepository.findOne.mockResolvedValue(mockUser as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet as any);
      fiatWalletService.checkIfUserHasEnoughBalanceOrThrow.mockResolvedValue();
      fiatWalletService.updateBalance.mockResolvedValue(undefined);
      exchangeAdapter.getChannels.mockResolvedValue([mockChannel] as any);
      exchangeAdapter.getBanks.mockResolvedValue([mockNetwork] as any);
      depositAddressService.getDepositAddresses.mockResolvedValue([mockDepositAddress] as any);
      exchangeAdapter.createPayInRequest.mockResolvedValue(mockPayInRequest as any);
      transactionService.create.mockResolvedValue(mockTransaction as any);
      fiatWalletTransactionService.create.mockResolvedValue(mockTransaction.fiatWalletTransaction as any);
      transactionRepository.update.mockResolvedValue(mockTransaction as any);
      fiatWalletTransactionRepository.update.mockResolvedValue(mockTransaction.fiatWalletTransaction as any);
      fiatWalletEscrowService.moveMoneyToEscrow.mockResolvedValue(undefined);
      rateConfigRepository.findOne.mockResolvedValue(createMockRateConfig() as any);
      rateService.validateRateOrThrow.mockResolvedValue(undefined);
      ngToUsdExchangeEscrowService.storeTransactionData.mockResolvedValue(undefined);
    });

    it('should use business credentials for institution customer type', async () => {
      kycAdapter.getKycDetailsByUserId.mockResolvedValue(mockKycDetails as any);

      await service.initializeNgToUSDExchange('user-123', payload);

      expect(exchangeAdapter.createPayInRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          customerType: 'institution',
          sender: expect.objectContaining({
            businessName: 'Test Business',
            businessIdNumber: 'CAC123456',
          }),
        }),
      );
    });

    it('should not include individual identity documents for institution type', async () => {
      kycAdapter.getKycDetailsByUserId.mockResolvedValue(mockKycDetails as any);

      await service.initializeNgToUSDExchange('user-123', payload);

      const callArgs = exchangeAdapter.createPayInRequest.mock.calls[0][0];
      expect(callArgs.sender.idNumber).toBeUndefined();
      expect(callArgs.sender.idType).toBeUndefined();
    });

    it('should work with Nigerian users without adding BVN for institution type', async () => {
      kycAdapter.getKycDetailsByUserId.mockResolvedValue(mockKycDetails as any);

      const result = await service.initializeNgToUSDExchange('user-123', payload);

      expect(result).toBeDefined();
      const callArgs = exchangeAdapter.createPayInRequest.mock.calls[0][0];
      expect(callArgs.sender.additionalIdNumber).toBeUndefined();
      expect(callArgs.sender.additionalIdType).toBeUndefined();
    });

    it('should work in production for Nigerian users without NIN for institution type', async () => {
      (EnvironmentService.isProduction as jest.Mock).mockReturnValue(true);

      const mockKycDetailsNigerianWithoutNIN = {
        data: {
          idDocument: {
            number: 'A12345678',
            type: 'PASSPORT',
          },
          idNumber: '12345678901',
          country: 'NGA',
          additionalIdDocuments: [],
        },
      };
      kycAdapter.getKycDetailsByUserId.mockResolvedValue(mockKycDetailsNigerianWithoutNIN as any);

      const result = await service.initializeNgToUSDExchange('user-123', payload);

      expect(result).toBeDefined();
      expect(exchangeAdapter.createPayInRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          customerType: 'institution',
        }),
      );

      (EnvironmentService.isProduction as jest.Mock).mockReturnValue(false);
    });

    it('should work for non-Nigerian users as institution type', async () => {
      const mockKycDetailsNonNigerian = {
        data: {
          idDocument: {
            number: 'A12345678',
            type: 'PASSPORT',
          },
          idNumber: '12345678901',
          country: 'GHA',
          additionalIdDocuments: [],
        },
      };
      kycAdapter.getKycDetailsByUserId.mockResolvedValue(mockKycDetailsNonNigerian as any);

      const result = await service.initializeNgToUSDExchange('user-123', payload);

      expect(result).toBeDefined();
      expect(exchangeAdapter.createPayInRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          customerType: 'institution',
          sender: expect.objectContaining({
            businessName: 'Test Business',
            businessIdNumber: 'CAC123456',
          }),
        }),
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large amounts', async () => {
      const payload = {
        from: 'NGN',
        to: 'USD',
        amount: 900000,
        rate_id: 'rate-123',
      };

      userTierService.getAssetLimits.mockResolvedValue({
        id: 'tier-config-123',
        tier_id: 'tier-123',
        country_id: 'country-1',
        minimum_balance: 0,
        maximum_balance: 10000000,
        minimum_per_deposit: 100,
        maximum_per_deposit: 1000000,
        maximum_daily_deposit: 5000000,
        maximum_monthly_deposit: 20000000,
        minimum_transaction_amount: 1000,
        maximum_transaction_amount: 1000000,
        maximum_daily_transaction: 5000000,
        maximum_weekly_deposit: 10000000,
        maximum_weekly_transaction: 25000000,
        minimum_per_withdrawal: 100,
        maximum_per_withdrawal: 1000000,
        maximum_daily_withdrawal: 5000000,
        maximum_weekly_withdrawal: 10000000,
        maximum_monthly_withdrawal: 20000000,
        maximum_monthly_transaction: 50000000,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      } as any);

      rateRepository.findOne.mockResolvedValue(mockRate as any);
      userRepository.findOne.mockResolvedValue(mockUser as any);
      fiatWalletService.getUserWallet.mockResolvedValue({ ...mockFiatWallet, balance: 1000000000 } as any);
      fiatWalletService.checkIfUserHasEnoughBalanceOrThrow.mockImplementation(async (userId, amount, currency) => {
        const wallet = await fiatWalletService.getUserWallet(userId, currency);
        const amountInSmallestUnit = CurrencyUtility.formatCurrencyAmountToSmallestUnit(amount, currency);
        if (wallet.balance < amountInSmallestUnit) {
          throw new BadRequestException('Insufficient balance');
        }
      });
      exchangeAdapter.getChannels.mockResolvedValue([mockChannel] as any);
      exchangeAdapter.getBanks.mockResolvedValue([mockNetwork] as any);
      depositAddressService.getDepositAddresses.mockResolvedValue([mockDepositAddress] as any);
      kycAdapter.getKycDetailsByUserId.mockResolvedValue(mockKycDetails as any);
      exchangeAdapter.createPayInRequest.mockResolvedValue(mockPayInRequest as any);
      transactionService.create.mockResolvedValue(mockTransaction as any);
      fiatWalletTransactionService.create.mockResolvedValue(mockTransaction.fiatWalletTransaction as any);
      transactionRepository.update.mockResolvedValue(mockTransaction as any);
      fiatWalletTransactionRepository.update.mockResolvedValue(mockTransaction.fiatWalletTransaction as any);
      fiatWalletService.updateBalance.mockResolvedValue(undefined);
      fiatWalletEscrowService.moveMoneyToEscrow.mockResolvedValue(undefined);
      rateConfigRepository.findOne.mockResolvedValue(createMockRateConfig() as any);
      rateService.validateRateOrThrow.mockResolvedValue(undefined);
      ngToUsdExchangeEscrowService.storeTransactionData.mockResolvedValue(undefined);

      const result = await service.initializeNgToUSDExchange('user-123', payload);

      expect(result).toBeDefined();
    });

    it('should handle minimum amount', async () => {
      const payload = {
        from: 'NGN',
        to: 'USD',
        amount: 1000,
        rate_id: 'rate-123',
      };

      userTierService.getAssetLimits.mockResolvedValue({
        id: 'tier-config-123',
        tier_id: 'tier-123',
        country_id: 'country-1',
        minimum_balance: 0,
        maximum_balance: 10000000,
        minimum_per_deposit: 100,
        maximum_per_deposit: 1000000,
        maximum_daily_deposit: 5000000,
        maximum_monthly_deposit: 20000000,
        minimum_transaction_amount: 1000,
        maximum_transaction_amount: 1000000,
        maximum_daily_transaction: 5000000,
        maximum_weekly_deposit: 10000000,
        maximum_weekly_transaction: 25000000,
        minimum_per_withdrawal: 100,
        maximum_per_withdrawal: 1000000,
        maximum_daily_withdrawal: 5000000,
        maximum_weekly_withdrawal: 10000000,
        maximum_monthly_withdrawal: 20000000,
        maximum_monthly_transaction: 50000000,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      } as any);

      rateRepository.findOne.mockResolvedValue(mockRate as any);
      userRepository.findOne.mockResolvedValue(mockUser as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet as any);
      fiatWalletService.checkIfUserHasEnoughBalanceOrThrow.mockImplementation(async (userId, amount, currency) => {
        const wallet = await fiatWalletService.getUserWallet(userId, currency);
        const amountInSmallestUnit = CurrencyUtility.formatCurrencyAmountToSmallestUnit(amount, currency);
        if (wallet.balance < amountInSmallestUnit) {
          throw new BadRequestException('Insufficient balance');
        }
      });
      exchangeAdapter.getChannels.mockResolvedValue([mockChannel] as any);
      exchangeAdapter.getBanks.mockResolvedValue([mockNetwork] as any);
      depositAddressService.getDepositAddresses.mockResolvedValue([mockDepositAddress] as any);
      kycAdapter.getKycDetailsByUserId.mockResolvedValue(mockKycDetails as any);
      exchangeAdapter.createPayInRequest.mockResolvedValue(mockPayInRequest as any);
      transactionService.create.mockResolvedValue(mockTransaction as any);
      fiatWalletTransactionService.create.mockResolvedValue(mockTransaction.fiatWalletTransaction as any);
      transactionRepository.update.mockResolvedValue(mockTransaction as any);
      fiatWalletTransactionRepository.update.mockResolvedValue(mockTransaction.fiatWalletTransaction as any);
      fiatWalletService.updateBalance.mockResolvedValue(undefined);
      fiatWalletEscrowService.moveMoneyToEscrow.mockResolvedValue(undefined);
      rateConfigRepository.findOne.mockResolvedValue(createMockRateConfig() as any);
      rateService.validateRateOrThrow.mockResolvedValue(undefined);
      ngToUsdExchangeEscrowService.storeTransactionData.mockResolvedValue(undefined);

      const result = await service.initializeNgToUSDExchange('user-123', payload);

      expect(result).toBeDefined();
    });

    it('should handle special characters in user IDs', async () => {
      const specialUser = { ...mockUser, id: 'user-123@test.com' };
      userRepository.findOne.mockResolvedValue(specialUser as any);

      const payload = {
        from: 'NGN',
        to: 'USD',
        amount: 10000,
        rate_id: 'rate-123',
      };

      userTierService.getAssetLimits.mockResolvedValue({
        id: 'tier-config-123',
        tier_id: 'tier-123',
        country_id: 'country-1',
        minimum_balance: 0,
        maximum_balance: 10000000,
        minimum_per_deposit: 100,
        maximum_per_deposit: 1000000,
        maximum_daily_deposit: 5000000,
        maximum_monthly_deposit: 20000000,
        minimum_transaction_amount: 1000,
        maximum_transaction_amount: 1000000,
        maximum_daily_transaction: 5000000,
        maximum_weekly_deposit: 10000000,
        maximum_weekly_transaction: 25000000,
        minimum_per_withdrawal: 100,
        maximum_per_withdrawal: 1000000,
        maximum_daily_withdrawal: 5000000,
        maximum_weekly_withdrawal: 10000000,
        maximum_monthly_withdrawal: 20000000,
        maximum_monthly_transaction: 50000000,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      } as any);

      rateRepository.findOne.mockResolvedValue(mockRate as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet as any);
      fiatWalletService.checkIfUserHasEnoughBalanceOrThrow.mockResolvedValue();
      fiatWalletService.updateBalance.mockResolvedValue(undefined);
      exchangeAdapter.getChannels.mockResolvedValue([mockChannel] as any);
      exchangeAdapter.getBanks.mockResolvedValue([mockNetwork] as any);
      depositAddressService.getDepositAddresses.mockResolvedValue([mockDepositAddress] as any);
      kycAdapter.getKycDetailsByUserId.mockResolvedValue(mockKycDetails as any);
      exchangeAdapter.createPayInRequest.mockResolvedValue(mockPayInRequest as any);
      transactionService.create.mockResolvedValue(mockTransaction as any);
      fiatWalletTransactionService.create.mockResolvedValue(mockTransaction.fiatWalletTransaction as any);
      transactionRepository.update.mockResolvedValue(mockTransaction as any);
      fiatWalletTransactionRepository.update.mockResolvedValue(mockTransaction.fiatWalletTransaction as any);
      fiatWalletEscrowService.moveMoneyToEscrow.mockResolvedValue(undefined);
      rateConfigRepository.findOne.mockResolvedValue(createMockRateConfig() as any);
      rateService.validateRateOrThrow.mockResolvedValue(undefined);
      ngToUsdExchangeEscrowService.storeTransactionData.mockResolvedValue(undefined);

      const result = await service.initializeNgToUSDExchange(specialUser.id, payload);

      expect(result).toBeDefined();
    });
  });

  describe('calculateNgnWithdrawalFee', () => {
    it('should return 0 when rate config not found', async () => {
      rateConfigRepository.findOne.mockResolvedValue(null);

      const result = await service.calculateNgnWithdrawalFee(10000);

      expect(result).toBe(0);
    });

    it('should return 0 when ngnWithdrawalFee config is not set', async () => {
      const configWithoutFee = createMockRateConfig();
      configWithoutFee.config.fiat_exchange = undefined as any;
      rateConfigRepository.findOne.mockResolvedValue(configWithoutFee as any);

      const result = await service.calculateNgnWithdrawalFee(10000);

      expect(result).toBe(0);
    });

    it('should calculate fixed fee correctly', async () => {
      rateConfigRepository.findOne.mockResolvedValue(
        createMockRateConfig({
          ngn_withdrawal_fee: 50,
          is_ngn_withdrawal_fee_percentage: false,
          ngn_withdrawal_fee_cap: 500,
        }) as any,
      );

      const result = await service.calculateNgnWithdrawalFee(10000);

      expect(result).toBe(50);
    });

    it('should calculate percentage fee correctly', async () => {
      rateConfigRepository.findOne.mockResolvedValue(
        createMockRateConfig({
          ngn_withdrawal_fee: 1,
          is_ngn_withdrawal_fee_percentage: true,
          ngn_withdrawal_fee_cap: 500,
        }) as any,
      );

      const result = await service.calculateNgnWithdrawalFee(10000);

      expect(result).toBe(100);
    });

    it('should cap fee at ngn_withdrawal_fee_cap', async () => {
      rateConfigRepository.findOne.mockResolvedValue(
        createMockRateConfig({
          ngn_withdrawal_fee: 10,
          is_ngn_withdrawal_fee_percentage: true,
          ngn_withdrawal_fee_cap: 500,
        }) as any,
      );

      const result = await service.calculateNgnWithdrawalFee(100000);

      expect(result).toBe(500);
    });
  });

  describe('validateUserLimitsOrThrow', () => {
    it('should throw error when user limits not found', async () => {
      userTierService.getAssetLimits.mockResolvedValue(null);

      await expect(service.validateUserLimitsOrThrow('user-123', 'NGN', 10000)).rejects.toThrow(BadRequestException);
    });

    it('should throw error when amount is less than minimum', async () => {
      userTierService.getAssetLimits.mockResolvedValue({
        minimum_transaction_amount: 5000,
        maximum_transaction_amount: 1000000,
      } as any);

      await expect(service.validateUserLimitsOrThrow('user-123', 'NGN', 1000)).rejects.toThrow(BadRequestException);
    });

    it('should throw error when amount is greater than maximum', async () => {
      userTierService.getAssetLimits.mockResolvedValue({
        minimum_transaction_amount: 1000,
        maximum_transaction_amount: 100000,
      } as any);

      await expect(service.validateUserLimitsOrThrow('user-123', 'NGN', 500000)).rejects.toThrow(BadRequestException);
    });

    it('should not throw when amount is within limits', async () => {
      userTierService.getAssetLimits.mockResolvedValue({
        minimum_transaction_amount: 1000,
        maximum_transaction_amount: 1000000,
      } as any);

      await expect(service.validateUserLimitsOrThrow('user-123', 'NGN', 10000)).resolves.not.toThrow();
    });
  });

  describe('validateRateIsToBuyDollarOrThrow', () => {
    it('should throw error when rate not found', async () => {
      rateRepository.findOne.mockResolvedValue(null);

      await expect(service.validateRateIsToBuyDollarOrThrow('rate-123')).rejects.toThrow(BadRequestException);
    });

    it('should throw error when rate is not to buy dollar', async () => {
      rateRepository.findOne.mockResolvedValue({
        id: 'rate-123',
        buying_currency_code: 'EUR',
      } as any);

      await expect(service.validateRateIsToBuyDollarOrThrow('rate-123')).rejects.toThrow(BadRequestException);
    });

    it('should return rate when valid', async () => {
      rateRepository.findOne.mockResolvedValue(mockRate as any);

      const result = await service.validateRateIsToBuyDollarOrThrow('rate-123');

      expect(result).toEqual(mockRate);
    });
  });

  describe('updateSourceTransactionsToFailed', () => {
    beforeEach(() => {
      fiatWalletTransactionRepository.findOne.mockResolvedValue(mockTransaction.fiatWalletTransaction as any);
      fiatWalletEscrowService.getEscrowAmount.mockResolvedValue(0);
    });

    it('should return early when parent transaction not found', async () => {
      transactionRepository.findOne.mockResolvedValue(null);

      await service.updateSourceTransactionsToFailed('txn-123', 'Error message');

      expect(transactionService.updateStatus).not.toHaveBeenCalled();
    });

    it('should return early when transaction is already failed', async () => {
      transactionRepository.findOne.mockResolvedValue({
        ...mockTransaction,
        status: TransactionStatus.FAILED,
      } as any);

      await service.updateSourceTransactionsToFailed('txn-123', 'Error message');

      expect(transactionService.updateStatus).not.toHaveBeenCalled();
    });

    it('should return early when transaction is already completed', async () => {
      transactionRepository.findOne.mockResolvedValue({
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
      } as any);

      await service.updateSourceTransactionsToFailed('txn-123', 'Error message');

      expect(transactionService.updateStatus).not.toHaveBeenCalled();
    });

    it('should update transaction and fiat transaction to failed', async () => {
      transactionRepository.findOne.mockResolvedValue({
        ...mockTransaction,
        status: TransactionStatus.PENDING,
      } as any);

      await service.updateSourceTransactionsToFailed('txn-123', 'Error message');

      expect(transactionService.updateStatus).toHaveBeenCalledWith(
        mockTransaction.id,
        TransactionStatus.FAILED,
        expect.objectContaining({ failure_reason: 'Error message' }),
        undefined,
      );
      expect(fiatWalletTransactionService.updateStatus).toHaveBeenCalledWith(
        mockTransaction.fiatWalletTransaction.id,
        TransactionStatus.FAILED,
        expect.objectContaining({ failure_reason: 'Error message' }),
        undefined,
      );
    });

    it('should truncate long error messages to 255 characters', async () => {
      transactionRepository.findOne.mockResolvedValue({
        ...mockTransaction,
        status: TransactionStatus.PENDING,
      } as any);

      const longErrorMessage = 'A'.repeat(300);

      await service.updateSourceTransactionsToFailed('txn-123', longErrorMessage);

      expect(transactionService.updateStatus).toHaveBeenCalledWith(
        mockTransaction.id,
        TransactionStatus.FAILED,
        expect.objectContaining({ failure_reason: 'A'.repeat(255) }),
        undefined,
      );
    });

    it('should release escrow and create refund when escrow has balance', async () => {
      transactionRepository.findOne.mockResolvedValue({
        ...mockTransaction,
        status: TransactionStatus.PENDING,
      } as any);
      fiatWalletEscrowService.getEscrowAmount.mockResolvedValue(10000);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet as any);
      transactionService.create.mockResolvedValue(mockTransaction as any);
      fiatWalletTransactionService.create.mockResolvedValue(mockTransaction.fiatWalletTransaction as any);
      fiatWalletService.updateBalance.mockResolvedValue(undefined);

      await service.updateSourceTransactionsToFailed('txn-123', 'Error message');

      expect(fiatWalletEscrowService.releaseMoneyFromEscrow).toHaveBeenCalledWith(mockTransaction.id);
    });
  });

  describe('deductFundsFromUser', () => {
    it('should deduct funds from user wallet and move to escrow', async () => {
      fiatWalletService.updateBalance.mockResolvedValue(undefined);
      fiatWalletEscrowService.moveMoneyToEscrow.mockResolvedValue(undefined);

      await service.deductFundsFromUser(mockTransaction as any, mockTransaction.fiatWalletTransaction as any, 10000);

      expect(fiatWalletService.updateBalance).toHaveBeenCalledWith(
        mockTransaction.fiatWalletTransaction.fiat_wallet_id,
        -10000,
        mockTransaction.id,
        'exchange',
        TransactionStatus.PENDING,
        expect.objectContaining({
          fiat_wallet_transaction_id: mockTransaction.fiatWalletTransaction.id,
        }),
        undefined,
      );
      expect(fiatWalletEscrowService.moveMoneyToEscrow).toHaveBeenCalledWith(mockTransaction.id, 10000);
    });
  });

  describe('validateTransactionToExecuteExchangeOrThrow', () => {
    it('should throw error when transaction not found', async () => {
      transactionRepository.findOne.mockResolvedValue(null);

      await expect(service.validateTransactionToExecuteExchangeOrThrow('txn-123', mockUser as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error when transaction is already completed', async () => {
      transactionRepository.findOne.mockResolvedValue({
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
      } as any);

      await expect(service.validateTransactionToExecuteExchangeOrThrow('txn-123', mockUser as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error when transaction is already failed', async () => {
      transactionRepository.findOne.mockResolvedValue({
        ...mockTransaction,
        status: TransactionStatus.FAILED,
      } as any);

      await expect(service.validateTransactionToExecuteExchangeOrThrow('txn-123', mockUser as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error when transaction is cancelled', async () => {
      transactionRepository.findOne.mockResolvedValue({
        ...mockTransaction,
        status: TransactionStatus.CANCELLED,
      } as any);

      await expect(service.validateTransactionToExecuteExchangeOrThrow('txn-123', mockUser as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error when transaction is not an exchange', async () => {
      transactionRepository.findOne.mockResolvedValue({
        ...mockTransaction,
        transaction_type: 'transfer',
      } as any);

      await expect(service.validateTransactionToExecuteExchangeOrThrow('txn-123', mockUser as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error when transaction is not for the user', async () => {
      transactionRepository.findOne.mockResolvedValue({
        ...mockTransaction,
        user_id: 'other-user',
      } as any);

      await expect(service.validateTransactionToExecuteExchangeOrThrow('txn-123', mockUser as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error when transaction status is not initiated', async () => {
      transactionRepository.findOne.mockResolvedValue({
        ...mockTransaction,
        status: TransactionStatus.PENDING,
      } as any);

      await expect(service.validateTransactionToExecuteExchangeOrThrow('txn-123', mockUser as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error when transaction has expired', async () => {
      transactionRepository.findOne.mockResolvedValue({
        ...mockTransaction,
        metadata: {
          ...mockTransaction.metadata,
          expires_at: DateTime.now().minus({ minutes: 10 }).toSQL(),
        },
      } as any);

      await expect(service.validateTransactionToExecuteExchangeOrThrow('txn-123', mockUser as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return transaction when all validations pass', async () => {
      transactionRepository.findOne.mockResolvedValue(mockTransaction as any);

      const result = await service.validateTransactionToExecuteExchangeOrThrow('txn-123', mockUser as any);

      expect(result).toEqual(mockTransaction);
    });
  });

  describe('getUserWalletAddressOrFail', () => {
    it('should throw error when user has no deposit address', async () => {
      depositAddressService.getDepositAddresses.mockResolvedValue([]);

      await expect(service.getUserWalletAddressOrFail(mockUser as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw error when default underlying currency not found in production', async () => {
      (EnvironmentService.isProduction as jest.Mock).mockReturnValueOnce(true);
      (EnvironmentService.getValue as jest.Mock).mockReturnValueOnce(null);
      depositAddressService.getDepositAddresses.mockResolvedValue([mockDepositAddress] as any);

      await expect(service.getUserWalletAddressOrFail(mockUser as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw error when user has no deposit address for default underlying currency', async () => {
      depositAddressService.getDepositAddresses.mockResolvedValue([{ ...mockDepositAddress, asset: 'BTC.BTC' }] as any);

      await expect(service.getUserWalletAddressOrFail(mockUser as any)).rejects.toThrow(BadRequestException);
    });

    it('should return wallet address info when found', async () => {
      depositAddressService.getDepositAddresses.mockResolvedValue([mockDepositAddress] as any);

      const result = await service.getUserWalletAddressOrFail(mockUser as any);

      expect(result).toEqual({
        address: mockDepositAddress.address,
        currency: 'USDC',
        network: 'ETH',
      });
    });

    it('should default network to ERC20 when not specified in asset in production', async () => {
      (EnvironmentService.isProduction as jest.Mock).mockReturnValueOnce(true);
      (EnvironmentService.getValue as jest.Mock).mockReturnValueOnce('USDC');
      depositAddressService.getDepositAddresses.mockResolvedValue([{ ...mockDepositAddress, asset: 'USDC' }] as any);

      const result = await service.getUserWalletAddressOrFail(mockUser as any);

      expect(result.network).toBe('ERC20');
    });
  });

  describe('getActiveDepositChannelOrThrow', () => {
    it('should throw error when no channels found', async () => {
      exchangeAdapter.getChannels.mockResolvedValue(null);
      exchangeAdapter.getBanks.mockResolvedValue([mockNetwork] as any);

      await expect(service.getActiveDepositChannelOrThrow('NGN', mockUser as any)).rejects.toThrow();
    });

    it('should throw error when no banks found', async () => {
      exchangeAdapter.getChannels.mockResolvedValue([mockChannel] as any);
      exchangeAdapter.getBanks.mockResolvedValue(null);

      await expect(service.getActiveDepositChannelOrThrow('NGN', mockUser as any)).rejects.toThrow();
    });

    it('should throw error when channels array is empty', async () => {
      exchangeAdapter.getChannels.mockResolvedValue([]);
      exchangeAdapter.getBanks.mockResolvedValue([mockNetwork] as any);

      await expect(service.getActiveDepositChannelOrThrow('NGN', mockUser as any)).rejects.toThrow();
    });

    it('should throw error when banks array is empty', async () => {
      exchangeAdapter.getChannels.mockResolvedValue([mockChannel] as any);
      exchangeAdapter.getBanks.mockResolvedValue([]);

      await expect(service.getActiveDepositChannelOrThrow('NGN', mockUser as any)).rejects.toThrow();
    });

    it('should return active channel and network', async () => {
      exchangeAdapter.getChannels.mockResolvedValue([mockChannel] as any);
      exchangeAdapter.getBanks.mockResolvedValue([mockNetwork] as any);

      const result = await service.getActiveDepositChannelOrThrow('NGN', mockUser as any);

      expect(result).toEqual({
        activeChannel: mockChannel,
        activeNetwork: mockNetwork,
      });
    });

    it('should find only active deposit channels', async () => {
      const inactiveChannel = { ...mockChannel, status: 'inactive' };
      const withdrawalChannel = { ...mockChannel, ref: 'channel-456', rampType: 'withdrawal' };
      exchangeAdapter.getChannels.mockResolvedValue([inactiveChannel, withdrawalChannel, mockChannel] as any);
      exchangeAdapter.getBanks.mockResolvedValue([mockNetwork] as any);

      const result = await service.getActiveDepositChannelOrThrow('NGN', mockUser as any);

      expect(result.activeChannel).toEqual(mockChannel);
    });
  });

  describe('getUserCountryAndProfileOrThrow', () => {
    it('should throw error when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.getUserCountryAndProfileOrThrow('user-123')).rejects.toThrow(BadRequestException);
    });

    it('should return user with profile and country', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as any);

      const result = await service.getUserCountryAndProfileOrThrow('user-123');

      expect(result).toEqual(mockUser);
      expect(userRepository.findOne).toHaveBeenCalledWith(
        { id: 'user-123' },
        {},
        { graphFetch: '[userProfile,country]' },
      );
    });
  });

  describe('generateLockKey', () => {
    it('should generate correct lock key format', () => {
      const result = service.generateLockKey('user-123', 'NGN', 'USD');

      expect(result).toBe('exchange:user-123:NGN-USD');
    });
  });

  describe('updateTransactionsWithFees', () => {
    it('should update parent transaction and fiat transaction with fees', async () => {
      transactionRepository.update.mockResolvedValue(mockTransaction as any);
      fiatWalletTransactionRepository.update.mockResolvedValue(mockTransaction.fiatWalletTransaction as any);

      await service.updateTransactionsWithFees(
        {
          ...mockTransaction,
          metadata: { ...mockTransaction.metadata, source_currency: 'NGN', destination_currency: 'USD' },
        } as any,
        mockTransaction.fiatWalletTransaction as any,
        100,
        0.1,
        10.5,
        9900,
        50,
      );

      expect(transactionRepository.update).toHaveBeenCalled();
      expect(fiatWalletTransactionRepository.update).toHaveBeenCalled();
    });
  });

  describe('createAllSourceTransactionsOrThrow', () => {
    beforeEach(() => {
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet as any);
      transactionService.create.mockResolvedValue(mockTransaction as any);
      fiatWalletTransactionService.create.mockResolvedValue(mockTransaction.fiatWalletTransaction as any);
      transactionRepository.findOne.mockResolvedValue(null);
    });

    it('should create parent transaction and fiat transaction', async () => {
      const result = await service.createAllSourceTransactionsOrThrow({
        user: mockUser as any,
        receiverUser: mockUser as any,
        amount: 10000,
        from: 'NGN',
        to: 'USD',
        activeChannelRef: 'channel-123',
        activeNetworkRef: 'network-123',
        transferType: 'deposit' as any,
        destinationWalletAddress: '0x123456789',
        rate: mockRate as any,
        transactionReference: 'txn-ref-123',
        providerId: 'provider-123',
        totalFee: 85,
        totalFeeUSD: 0.085,
        ngnWithdrawalFee: 50,
        amountToReceiveUSD: 10.5,
        amountToPayLocal: 9915,
      });

      expect(result.parentTransaction).toBeDefined();
      expect(result.fiatTransaction).toBeDefined();
      expect(transactionService.create).toHaveBeenCalled();
      expect(fiatWalletTransactionService.create).toHaveBeenCalled();
    });

    it('should return existing transaction if reference already exists (idempotency)', async () => {
      transactionRepository.findOne.mockResolvedValue(mockTransaction as any);
      fiatWalletTransactionRepository.findOne.mockResolvedValue(mockTransaction.fiatWalletTransaction as any);

      const result = await service.createAllSourceTransactionsOrThrow({
        user: mockUser as any,
        receiverUser: mockUser as any,
        amount: 10000,
        from: 'NGN',
        to: 'USD',
        transactionReference: 'existing-ref',
        providerId: 'provider-123',
        totalFee: 85,
        totalFeeUSD: 0.085,
        ngnWithdrawalFee: 50,
        amountToReceiveUSD: 10.5,
        amountToPayLocal: 9915,
      });

      expect(result.parentTransaction).toEqual(mockTransaction);
      expect(transactionService.create).not.toHaveBeenCalled();
    });

    it('should throw error when wallet not found', async () => {
      fiatWalletService.getUserWallet.mockRejectedValue(new Error('Wallet not found'));

      await expect(
        service.createAllSourceTransactionsOrThrow({
          user: mockUser as any,
          receiverUser: mockUser as any,
          amount: 10000,
          from: 'NGN',
          to: 'USD',
          transactionReference: 'txn-ref-123',
          providerId: 'provider-123',
          totalFee: 85,
          totalFeeUSD: 0.085,
          ngnWithdrawalFee: 50,
          amountToReceiveUSD: 10.5,
          amountToPayLocal: 9915,
        }),
      ).rejects.toThrow();
    });
  });

  describe('initializeNgToUSDExchange - error cleanup', () => {
    const payload = {
      from: 'NGN',
      to: 'USD',
      amount: 10000,
      rate_id: 'rate-123',
    };

    it('should remove transaction data from redis on error when data exists', async () => {
      const storedData = {
        transactionReference: 'test-ref-123',
        amount: 10000,
      };

      userTierService.getAssetLimits.mockResolvedValue({
        id: 'tier-config-123',
        tier_id: 'tier-123',
        country_id: 'country-1',
        minimum_transaction_amount: 1000,
        maximum_transaction_amount: 1000000,
      } as any);

      rateRepository.findOne.mockResolvedValue({ id: 'rate-123', buying_currency_code: 'USD', rate: 160000 } as any);
      userRepository.findOne.mockResolvedValue(mockUser as any);
      fiatWalletService.checkIfUserHasEnoughBalanceOrThrow.mockResolvedValue();
      exchangeAdapter.getChannels.mockRejectedValue(new Error('Network error'));

      ngToUsdExchangeEscrowService.getTransactionData.mockResolvedValue(storedData);
      ngToUsdExchangeEscrowService.removeTransactionData.mockResolvedValue(undefined);

      await expect(service.initializeNgToUSDExchange('user-123', payload)).rejects.toThrow();

      expect(ngToUsdExchangeEscrowService.getTransactionData).toHaveBeenCalled();
      expect(ngToUsdExchangeEscrowService.removeTransactionData).toHaveBeenCalled();
    });

    it('should not remove transaction data when none exists on error', async () => {
      userTierService.getAssetLimits.mockResolvedValue({
        id: 'tier-config-123',
        tier_id: 'tier-123',
        country_id: 'country-1',
        minimum_transaction_amount: 1000,
        maximum_transaction_amount: 1000000,
      } as any);

      rateRepository.findOne.mockResolvedValue({ id: 'rate-123', buying_currency_code: 'USD', rate: 160000 } as any);
      userRepository.findOne.mockResolvedValue(mockUser as any);
      fiatWalletService.checkIfUserHasEnoughBalanceOrThrow.mockResolvedValue();
      exchangeAdapter.getChannels.mockRejectedValue(new Error('Network error'));

      ngToUsdExchangeEscrowService.getTransactionData.mockResolvedValue(null);

      await expect(service.initializeNgToUSDExchange('user-123', payload)).rejects.toThrow();

      expect(ngToUsdExchangeEscrowService.getTransactionData).toHaveBeenCalled();
      expect(ngToUsdExchangeEscrowService.removeTransactionData).not.toHaveBeenCalled();
    });
  });

  describe('executeExchange - error handling', () => {
    it('should throw error when virtual account creation fails', async () => {
      const executePayload = {
        transaction_id: 'txn-ref-123',
      };

      const mockStoredTransactionData = {
        transactionReference: 'txn-ref-123',
        rate: { id: 'rate-123' },
      };

      ngToUsdExchangeEscrowService.getTransactionData.mockResolvedValue(mockStoredTransactionData);
      virtualAccountService.findOrCreateVirtualAccount.mockResolvedValue(null);
      transactionRepository.findOne.mockResolvedValue(null);
      fiatWalletTransactionRepository.findOne.mockResolvedValue(null);
      fiatWalletEscrowService.getEscrowAmount.mockResolvedValue(0);

      await expect(service.executeExchange(mockUser as any, executePayload as any)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw error when virtual account has no account number', async () => {
      const executePayload = {
        transaction_id: 'txn-ref-123',
      };

      const mockStoredTransactionData = {
        transactionReference: 'txn-ref-123',
        rate: { id: 'rate-123' },
      };

      const mockVirtualAccountWithoutNumber = {
        id: 'virtual-account-123',
        user_id: 'user-123',
        account_number: null,
        account_name: 'Test User',
      };

      ngToUsdExchangeEscrowService.getTransactionData.mockResolvedValue(mockStoredTransactionData);
      virtualAccountService.findOrCreateVirtualAccount.mockResolvedValue(mockVirtualAccountWithoutNumber as any);
      transactionRepository.findOne.mockResolvedValue(null);
      fiatWalletTransactionRepository.findOne.mockResolvedValue(null);
      fiatWalletEscrowService.getEscrowAmount.mockResolvedValue(0);

      await expect(service.executeExchange(mockUser as any, executePayload as any)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw error when virtual account has no account name', async () => {
      const executePayload = {
        transaction_id: 'txn-ref-123',
      };

      const mockStoredTransactionData = {
        transactionReference: 'txn-ref-123',
        rate: { id: 'rate-123' },
      };

      const mockVirtualAccountWithoutName = {
        id: 'virtual-account-123',
        user_id: 'user-123',
        account_number: '1234567890',
        account_name: null,
      };

      ngToUsdExchangeEscrowService.getTransactionData.mockResolvedValue(mockStoredTransactionData);
      virtualAccountService.findOrCreateVirtualAccount.mockResolvedValue(mockVirtualAccountWithoutName as any);
      transactionRepository.findOne.mockResolvedValue(null);
      fiatWalletTransactionRepository.findOne.mockResolvedValue(null);
      fiatWalletEscrowService.getEscrowAmount.mockResolvedValue(0);

      await expect(service.executeExchange(mockUser as any, executePayload as any)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('createPayInRequest - Nigerian retail customer BVN handling', () => {
    const mockNigerianUser = {
      id: 'user-123',
      username: 'nigerianuser',
      email: 'nigerian@example.com',
      first_name: 'Test',
      last_name: 'Nigerian',
      phone_number: '+2348012345678',
      country: {
        id: 'country-ng',
        code: 'NG',
        name: 'Nigeria',
      },
    };

    it('should add BVN for Nigerian retail customers when customerType is retail', async () => {
      userRepository.findOne.mockResolvedValue(mockNigerianUser as any);
      kycAdapter.getKycDetailsByUserId.mockResolvedValue({
        data: {
          idNumber: '22222222222',
          idDocument: { number: 'A12345678', type: 'PASSPORT' },
          country: 'NGA',
          additionalIdDocuments: [],
        },
      } as any);
      depositAddressService.getDepositAddresses.mockResolvedValue([{ address: '0x123', asset: 'USDC.ETH' }] as any);
      exchangeAdapter.createPayInRequest.mockResolvedValue({
        ref: 'payin-ref-123',
        feeLocal: 50,
        networkFeeLocal: 25,
        partnerFeeLocal: 10,
        feeUSD: 0.05,
        networkFeeUSD: 0.025,
        partnerFeeUSD: 0.01,
        receiverCryptoInfo: { cryptoAmount: 10.5 },
      } as any);

      await service.createPayInRequest({
        user: mockNigerianUser as any,
        parentTransactionId: 'txn-123',
        localAmount: 10000,
        activeChannelRef: 'channel-123',
        activeNetworkRef: 'network-123',
        fromCurrency: 'NGN',
      });

      expect(exchangeAdapter.createPayInRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          customerType: 'institution',
        }),
      );
    });
  });
});
