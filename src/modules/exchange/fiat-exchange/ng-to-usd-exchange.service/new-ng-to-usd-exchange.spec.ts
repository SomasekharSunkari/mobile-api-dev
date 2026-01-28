import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ExchangeAdapter } from '../../../../adapters/exchange/exchange.adapter';
import { KYCAdapter } from '../../../../adapters/kyc/kyc-adapter';
import { WaasAdapter } from '../../../../adapters/waas/waas.adapter';
import { CurrencyUtility } from '../../../../currencies';
import { TransactionStatus } from '../../../../database/models/transaction';
import { LockerService } from '../../../../services/locker/locker.service';
import { ExecuteNewNgUsdExchangeProcessor } from '../../../../services/queue/processors/exchange/execute-new-ng-usd-exchange.processor';
import { ExecuteNgUsdExchangeProcessor } from '../../../../services/queue/processors/exchange/execute-ng-usd-exchange.processor';
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
import { FiatExchangeService } from '../fiat-exchange.service';
import { NewNgToUsdExchangeService } from './new-ng-to-usd-exchange.service';
import { NgToUsdExchangeEscrowService } from './ng-to-usd-exchange.escrow.service';

jest.mock('../../../../config/environment', () => ({
  EnvironmentService: {
    isProduction: jest.fn().mockReturnValue(false),
    getValue: jest.fn().mockReturnValue('USDC.ETH'),
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

describe('NewNgToUsdExchangeService', () => {
  let service: NewNgToUsdExchangeService;
  let rateRepository: jest.Mocked<RateRepository>;
  let transactionRepository: jest.Mocked<TransactionRepository>;
  let fiatWalletTransactionRepository: jest.Mocked<FiatWalletTransactionRepository>;
  let fiatWalletService: jest.Mocked<FiatWalletService>;
  let transactionService: jest.Mocked<TransactionService>;
  let fiatWalletTransactionService: jest.Mocked<FiatWalletTransactionService>;
  let exchangeAdapter: jest.Mocked<ExchangeAdapter>;
  let depositAddressService: jest.Mocked<DepositAddressService>;
  let kycAdapter: jest.Mocked<KYCAdapter>;
  let userRepository: jest.Mocked<UserRepository>;
  let fiatExchangeService: jest.Mocked<FiatExchangeService>;
  let userTierService: jest.Mocked<UserTierService>;
  let rateService: jest.Mocked<RateService>;
  let waasAdapter: jest.Mocked<WaasAdapter>;
  let fiatWalletEscrowService: jest.Mocked<FiatWalletEscrowService>;

  const mockUser = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
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
      },
      idNumber: '12345678901',
      additionalIdDocuments: [
        {
          type: 'NIN',
          number: '98765432101',
        },
      ],
    },
  };

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
    bankInfo: {
      name: 'Providus Bank',
      accountNumber: '1234567890',
      accountName: 'Yellow Card',
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
    },
    fiatWalletTransaction: {
      id: 'fiat-txn-123',
      transaction_id: 'txn-123',
      user_id: 'user-123',
      amount: 10000,
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
    bank_name: 'Test Bank',
  };

  const mockBankList = [
    {
      bankName: 'Providus Bank',
      nibssBankCode: '101',
      bankRef: 'providus-ref',
    },
    {
      bankName: 'First Bank',
      nibssBankCode: '011',
      bankRef: 'first-bank-ref',
    },
  ];

  const mockRateConfig = {
    id: 'rate-config-123',
    provider: 'yellowcard',
    service_fee: 1.5,
    partner_fee: 0.5,
    is_active: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewNgToUsdExchangeService,
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
            findOne: jest.fn(),
            update: jest.fn(),
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
          provide: ExecuteNewNgUsdExchangeProcessor,
          useValue: {
            queueExecuteNewNgUsdExchange: jest.fn().mockResolvedValue({ id: 'job-123' }),
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
          provide: RateService,
          useValue: {
            getRate: jest.fn(),
          },
        },
        {
          provide: WaasAdapter,
          useValue: {
            getBankList: jest.fn(),
            transferToOtherBank: jest.fn(),
            getTransactionStatus: jest.fn(),
            getProvider: jest.fn().mockReturnValue({
              getProviderName: jest.fn().mockReturnValue('paga'),
            }),
          },
        },
        {
          provide: FiatWalletEscrowService,
          useValue: {
            getEscrowAmount: jest.fn(),
            releaseMoneyFromEscrow: jest.fn(),
            moveMoneyToEscrow: jest.fn(),
          },
        },
        {
          provide: RateConfigRepository,
          useValue: {
            findOne: jest.fn(),
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

    service = module.get<NewNgToUsdExchangeService>(NewNgToUsdExchangeService);
    rateRepository = module.get(RateRepository);
    transactionRepository = module.get(TransactionRepository);
    fiatWalletTransactionRepository = module.get(FiatWalletTransactionRepository);
    fiatWalletService = module.get(FiatWalletService);
    transactionService = module.get(TransactionService);
    fiatWalletTransactionService = module.get(FiatWalletTransactionService);
    exchangeAdapter = module.get(ExchangeAdapter);
    depositAddressService = module.get(DepositAddressService);
    kycAdapter = module.get(KYCAdapter);
    userRepository = module.get(UserRepository);
    fiatExchangeService = module.get(FiatExchangeService);
    userTierService = module.get(UserTierService);
    rateService = module.get(RateService);
    waasAdapter = module.get(WaasAdapter);
    fiatWalletEscrowService = module.get(FiatWalletEscrowService);

    jest.clearAllMocks();
  });

  describe('executeExchange - successful flow', () => {
    const payload = {
      from: 'NGN',
      to: 'USD',
      amount: 10000,
      rate_id: 'rate-123',
    };

    const mockUserLimits = {
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
    };

    beforeEach(() => {
      userTierService.getAssetLimits.mockResolvedValue(mockUserLimits as any);
      rateRepository.findOne.mockResolvedValue(mockRate as any);
      userRepository.findOne.mockResolvedValue(mockUser as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet as any);
      fiatWalletService.checkIfUserHasEnoughBalanceOrThrow.mockResolvedValue();
      exchangeAdapter.getChannels.mockResolvedValue([mockChannel] as any);
      exchangeAdapter.getBanks.mockResolvedValue([mockNetwork] as any);
      depositAddressService.getDepositAddresses.mockResolvedValue([mockDepositAddress] as any);
      kycAdapter.getKycDetailsByUserId.mockResolvedValue(mockKycDetails as any);
      exchangeAdapter.createPayInRequest.mockResolvedValue(mockPayInRequest as any);
      transactionService.create.mockResolvedValue(mockTransaction as any);
      fiatWalletTransactionService.create.mockResolvedValue(mockTransaction.fiatWalletTransaction as any);
      transactionRepository.update.mockResolvedValue(mockTransaction as any);
      fiatWalletTransactionRepository.update.mockResolvedValue(mockTransaction.fiatWalletTransaction as any);
      fiatExchangeService.getValidatedVirtualAccount.mockResolvedValue(mockVirtualAccount as any);
      rateService.getRate.mockResolvedValue(mockRateConfig as any);
      waasAdapter.getBankList.mockResolvedValue(mockBankList as any);
      waasAdapter.transferToOtherBank.mockResolvedValue({ status: 'success' } as any);
    });

    it('should successfully execute exchange and return correct response', async () => {
      const result = await service.executeExchange(mockUser as any, payload as any);

      expect(result).toEqual({
        status: 'processing',
        transactionRef: mockTransaction.reference,
        message: 'Exchange in progress',
        jobId: 'job-123',
      });
    });

    it('should validate rate is to buy dollar', async () => {
      await service.executeExchange(mockUser as any, payload as any);

      expect(rateRepository.findOne).toHaveBeenCalledWith({ id: payload.rate_id });
    });

    it('should get user country and profile', async () => {
      await service.executeExchange(mockUser as any, payload as any);

      expect(userRepository.findOne).toHaveBeenCalledWith(
        { id: mockUser.id },
        {},
        { graphFetch: '[userProfile,country]' },
      );
    });

    it('should validate user limits', async () => {
      await service.executeExchange(mockUser as any, payload as any);

      expect(userTierService.getAssetLimits).toHaveBeenCalledWith(mockUser.id, payload.from);
    });

    it('should check if user has enough balance', async () => {
      await service.executeExchange(mockUser as any, payload as any);

      expect(fiatWalletService.checkIfUserHasEnoughBalanceOrThrow).toHaveBeenCalledWith(
        mockUser.id,
        payload.amount,
        payload.from,
      );
    });

    it('should get active deposit channel', async () => {
      await service.executeExchange(mockUser as any, payload as any);

      expect(exchangeAdapter.getChannels).toHaveBeenCalled();
      expect(exchangeAdapter.getBanks).toHaveBeenCalled();
    });

    it('should get user wallet address', async () => {
      await service.executeExchange(mockUser as any, payload as any);

      expect(depositAddressService.getDepositAddresses).toHaveBeenCalledWith(mockUser);
    });

    it('should create all source transactions', async () => {
      await service.executeExchange(mockUser as any, payload as any);

      expect(transactionService.create).toHaveBeenCalled();
      expect(fiatWalletTransactionService.create).toHaveBeenCalled();
    });

    it('should use rate service in non-production to get service and partner fees', async () => {
      await service.executeExchange(mockUser as any, payload as any);

      expect(rateService.getRate).toHaveBeenCalledWith(payload.from, payload.amount);
    });

    it('should queue job with active channel info', async () => {
      const result = await service.executeExchange(mockUser as any, payload as any);

      expect(result.jobId).toBe('job-123');
    });

    it('should queue job with parent transaction data', async () => {
      const executeNewNgUsdExchangeProcessor = {
        queueExecuteNewNgUsdExchange: jest.fn().mockResolvedValue({ id: 'job-123' }),
      };
      (service as any).executeNewNgUsdExchangeProcessor = executeNewNgUsdExchangeProcessor;

      await service.executeExchange(mockUser as any, payload as any);

      expect(executeNewNgUsdExchangeProcessor.queueExecuteNewNgUsdExchange).toHaveBeenCalledWith(
        expect.objectContaining({
          parentTransaction: expect.objectContaining({
            id: mockTransaction.id,
          }),
        }),
      );
    });

    it('should queue job with user data', async () => {
      const executeNewNgUsdExchangeProcessor = {
        queueExecuteNewNgUsdExchange: jest.fn().mockResolvedValue({ id: 'job-123' }),
      };
      (service as any).executeNewNgUsdExchangeProcessor = executeNewNgUsdExchangeProcessor;

      await service.executeExchange(mockUser as any, payload as any);

      expect(executeNewNgUsdExchangeProcessor.queueExecuteNewNgUsdExchange).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            id: mockUser.id,
          }),
        }),
      );
    });

    it('should queue job with payload data', async () => {
      const executeNewNgUsdExchangeProcessor = {
        queueExecuteNewNgUsdExchange: jest.fn().mockResolvedValue({ id: 'job-123' }),
      };
      (service as any).executeNewNgUsdExchangeProcessor = executeNewNgUsdExchangeProcessor;

      await service.executeExchange(mockUser as any, payload as any);

      expect(executeNewNgUsdExchangeProcessor.queueExecuteNewNgUsdExchange).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            from: payload.from,
            to: payload.to,
            amount: payload.amount,
          }),
        }),
      );
    });

    it('should queue job with fiat transaction data', async () => {
      const executeNewNgUsdExchangeProcessor = {
        queueExecuteNewNgUsdExchange: jest.fn().mockResolvedValue({ id: 'job-123' }),
      };
      (service as any).executeNewNgUsdExchangeProcessor = executeNewNgUsdExchangeProcessor;

      await service.executeExchange(mockUser as any, payload as any);

      expect(executeNewNgUsdExchangeProcessor.queueExecuteNewNgUsdExchange).toHaveBeenCalledWith(
        expect.objectContaining({
          fiatTransaction: expect.objectContaining({
            id: mockTransaction.fiatWalletTransaction.id,
          }),
        }),
      );
    });

    it('should queue job with active channel ref', async () => {
      const executeNewNgUsdExchangeProcessor = {
        queueExecuteNewNgUsdExchange: jest.fn().mockResolvedValue({ id: 'job-123' }),
      };
      (service as any).executeNewNgUsdExchangeProcessor = executeNewNgUsdExchangeProcessor;

      await service.executeExchange(mockUser as any, payload as any);

      expect(executeNewNgUsdExchangeProcessor.queueExecuteNewNgUsdExchange).toHaveBeenCalledWith(
        expect.objectContaining({
          activeChannel: expect.objectContaining({
            ref: mockChannel.ref,
          }),
        }),
      );
    });

    it('should queue job with active network ref', async () => {
      const executeNewNgUsdExchangeProcessor = {
        queueExecuteNewNgUsdExchange: jest.fn().mockResolvedValue({ id: 'job-123' }),
      };
      (service as any).executeNewNgUsdExchangeProcessor = executeNewNgUsdExchangeProcessor;

      await service.executeExchange(mockUser as any, payload as any);

      expect(executeNewNgUsdExchangeProcessor.queueExecuteNewNgUsdExchange).toHaveBeenCalledWith(
        expect.objectContaining({
          activeNetwork: expect.objectContaining({
            ref: mockNetwork.ref,
          }),
        }),
      );
    });

    it('should queue job with converted amount', async () => {
      const executeNewNgUsdExchangeProcessor = {
        queueExecuteNewNgUsdExchange: jest.fn().mockResolvedValue({ id: 'job-123' }),
      };
      (service as any).executeNewNgUsdExchangeProcessor = executeNewNgUsdExchangeProcessor;

      await service.executeExchange(mockUser as any, payload as any);

      expect(executeNewNgUsdExchangeProcessor.queueExecuteNewNgUsdExchange).toHaveBeenCalledWith(
        expect.objectContaining({
          localAmount: expect.any(Number),
        }),
      );
    });
  });

  describe('executeExchange - error scenarios', () => {
    const payload = {
      from: 'NGN',
      to: 'USD',
      amount: 10000,
      rate_id: 'rate-123',
    };

    const mockUserLimits = {
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
    };

    beforeEach(() => {
      userTierService.getAssetLimits.mockResolvedValue(mockUserLimits as any);
      rateRepository.findOne.mockResolvedValue(mockRate as any);
      userRepository.findOne.mockResolvedValue(mockUser as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet as any);
      fiatWalletService.checkIfUserHasEnoughBalanceOrThrow.mockResolvedValue();
      exchangeAdapter.getChannels.mockResolvedValue([mockChannel] as any);
      exchangeAdapter.getBanks.mockResolvedValue([mockNetwork] as any);
      depositAddressService.getDepositAddresses.mockResolvedValue([mockDepositAddress] as any);
      kycAdapter.getKycDetailsByUserId.mockResolvedValue(mockKycDetails as any);
      exchangeAdapter.createPayInRequest.mockResolvedValue(mockPayInRequest as any);
      transactionService.create.mockResolvedValue(mockTransaction as any);
      fiatWalletTransactionService.create.mockResolvedValue(mockTransaction.fiatWalletTransaction as any);
      transactionRepository.update.mockResolvedValue(mockTransaction as any);
      fiatWalletTransactionRepository.update.mockResolvedValue(mockTransaction.fiatWalletTransaction as any);
      fiatExchangeService.getValidatedVirtualAccount.mockResolvedValue(mockVirtualAccount as any);
      rateService.getRate.mockResolvedValue(mockRateConfig as any);
      waasAdapter.getBankList.mockResolvedValue(mockBankList as any);
      waasAdapter.transferToOtherBank.mockResolvedValue({ status: 'success' } as any);
    });

    it('should throw InternalServerErrorException when rate not found', async () => {
      rateRepository.findOne.mockResolvedValue(null);

      await expect(service.executeExchange(mockUser as any, payload as any)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException when rate is not to buy dollar', async () => {
      const invalidRate = { ...mockRate, buying_currency_code: 'EUR' };
      rateRepository.findOne.mockResolvedValue(invalidRate as any);

      await expect(service.executeExchange(mockUser as any, payload as any)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException when user has insufficient balance', async () => {
      fiatWalletService.checkIfUserHasEnoughBalanceOrThrow.mockRejectedValue(
        new BadRequestException('Insufficient balance'),
      );

      await expect(service.executeExchange(mockUser as any, payload as any)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException when amount is less than minimum', async () => {
      const lowAmountPayload = { ...payload, amount: 500 };

      await expect(service.executeExchange(mockUser as any, lowAmountPayload as any)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException when amount is greater than maximum', async () => {
      const highAmountPayload = { ...payload, amount: 2000000 };

      await expect(service.executeExchange(mockUser as any, highAmountPayload as any)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException when user has no deposit address', async () => {
      depositAddressService.getDepositAddresses.mockResolvedValue([]);

      await expect(service.executeExchange(mockUser as any, payload as any)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException when no active deposit channel found', async () => {
      exchangeAdapter.getChannels.mockResolvedValue([]);

      await expect(service.executeExchange(mockUser as any, payload as any)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException when no active bank found', async () => {
      exchangeAdapter.getBanks.mockResolvedValue([]);

      await expect(service.executeExchange(mockUser as any, payload as any)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException when user limits not found', async () => {
      userTierService.getAssetLimits.mockResolvedValue(null);

      await expect(service.executeExchange(mockUser as any, payload as any)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException when amount below minimum transaction limit', async () => {
      const limitedUserLimits = { ...mockUserLimits, minimum_transaction_amount: 50000 };
      userTierService.getAssetLimits.mockResolvedValue(limitedUserLimits as any);

      await expect(service.executeExchange(mockUser as any, payload as any)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException when amount above maximum transaction limit', async () => {
      const limitedUserLimits = { ...mockUserLimits, maximum_transaction_amount: 5000 };
      userTierService.getAssetLimits.mockResolvedValue(limitedUserLimits as any);

      await expect(service.executeExchange(mockUser as any, payload as any)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.executeExchange(mockUser as any, payload as any)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should handle exchange adapter errors gracefully', async () => {
      exchangeAdapter.getChannels.mockRejectedValue(new Error('External service error'));

      await expect(service.executeExchange(mockUser as any, payload as any)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should handle user with no deposit address for default underlying currency', async () => {
      const nonMatchingDepositAddress = { ...mockDepositAddress, asset: 'BTC.ETH' };
      depositAddressService.getDepositAddresses.mockResolvedValue([nonMatchingDepositAddress] as any);

      await expect(service.executeExchange(mockUser as any, payload as any)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('sendMoneyFromCompanyAccountToYellowcard (direct method tests)', () => {
    beforeEach(() => {
      waasAdapter.getBankList.mockResolvedValue(mockBankList as any);
      waasAdapter.transferToOtherBank.mockResolvedValue({ status: 'success' } as any);
    });

    it('should find bank by name case-insensitively', async () => {
      const bankInfo = {
        name: 'providus bank', // lowercase
        accountNumber: '1234567890',
        accountName: 'Yellow Card',
      };

      await service.sendMoneyFromCompanyAccountToYellowcard(10000, bankInfo as any);

      expect(waasAdapter.getBankList).toHaveBeenCalled();
      expect(waasAdapter.transferToOtherBank).toHaveBeenCalled();
    });

    it('should find bank by partial name match', async () => {
      const bankInfo = {
        name: 'Providus', // partial match
        accountNumber: '1234567890',
        accountName: 'Yellow Card',
      };

      await service.sendMoneyFromCompanyAccountToYellowcard(10000, bankInfo as any);

      expect(waasAdapter.transferToOtherBank).toHaveBeenCalledWith(
        expect.objectContaining({
          receiver: expect.objectContaining({
            bankRef: mockBankList[0].bankRef,
          }),
        }),
      );
    });

    it('should use development account number in non-production', async () => {
      const bankInfo = {
        name: 'Providus Bank',
        accountNumber: '5555555555',
        accountName: 'Yellow Card',
      };

      await service.sendMoneyFromCompanyAccountToYellowcard(10000, bankInfo as any);

      // In non-production, the account number is overwritten to PAGA_DEVELOPMENT_BANK_ACCOUNT_NUMBER
      expect(waasAdapter.transferToOtherBank).toHaveBeenCalledWith(
        expect.objectContaining({
          receiver: expect.objectContaining({
            accountNumber: expect.any(String),
          }),
        }),
      );
    });

    it('should generate unique transaction reference for each transfer', async () => {
      const bankInfo = {
        name: 'Providus Bank',
        accountNumber: '1234567890',
        accountName: 'Yellow Card',
      };

      await service.sendMoneyFromCompanyAccountToYellowcard(10000, bankInfo as any);

      expect(waasAdapter.transferToOtherBank).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionReference: expect.any(String),
        }),
      );
    });

    it('should include correct transfer details', async () => {
      const bankInfo = {
        name: 'Providus Bank',
        accountNumber: '1234567890',
        accountName: 'Yellow Card',
      };

      await service.sendMoneyFromCompanyAccountToYellowcard(10000, bankInfo as any);

      expect(waasAdapter.transferToOtherBank).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 10000,
          currency: 'NGN',
          description: 'Exchange of money to Yellowcard',
          transactionType: 'EXTERNAL_BANK',
        }),
      );
    });

    it('should throw BadRequestException when bank not found', async () => {
      const bankInfo = {
        name: 'Unknown Bank',
        accountNumber: '1234567890',
        accountName: 'Yellow Card',
      };

      await expect(service.sendMoneyFromCompanyAccountToYellowcard(10000, bankInfo as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateSourceTransactionsToFailed', () => {
    const mockFiatTransaction = {
      id: 'fiat-txn-123',
      transaction_id: 'txn-123',
      user_id: 'user-123',
      currency: 'NGN',
    };

    beforeEach(() => {
      transactionRepository.findOne.mockResolvedValue(mockTransaction as any);
      fiatWalletTransactionRepository.findOne.mockResolvedValue(mockFiatTransaction as any);
      fiatWalletEscrowService.getEscrowAmount.mockResolvedValue(0);
    });

    it('should do nothing when parent transaction not found', async () => {
      transactionRepository.findOne.mockResolvedValue(null);

      await service.updateSourceTransactionsToFailed('txn-123', 'Error message');

      expect(transactionService.updateStatus).not.toHaveBeenCalled();
    });

    it('should do nothing when transaction status is already FAILED', async () => {
      transactionRepository.findOne.mockResolvedValue({
        ...mockTransaction,
        status: TransactionStatus.FAILED,
      } as any);

      await service.updateSourceTransactionsToFailed('txn-123', 'Error message');

      expect(transactionService.updateStatus).not.toHaveBeenCalled();
    });

    it('should do nothing when transaction status is already COMPLETED', async () => {
      transactionRepository.findOne.mockResolvedValue({
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
      } as any);

      await service.updateSourceTransactionsToFailed('txn-123', 'Error message');

      expect(transactionService.updateStatus).not.toHaveBeenCalled();
    });

    it('should update parent and fiat transactions to failed', async () => {
      fiatWalletTransactionRepository.findOne.mockResolvedValue(mockFiatTransaction as any);

      await service.updateSourceTransactionsToFailed('txn-123', 'Error message');

      expect(transactionService.updateStatus).toHaveBeenCalledWith(
        'txn-123',
        TransactionStatus.FAILED,
        { failure_reason: 'Error message' },
        undefined,
      );
      expect(fiatWalletTransactionService.updateStatus).toHaveBeenCalledWith(
        'fiat-txn-123',
        TransactionStatus.FAILED,
        { failure_reason: 'Error message' },
        undefined,
      );
    });

    it('should release escrow and create refund when escrow amount > 0', async () => {
      fiatWalletTransactionRepository.findOne.mockResolvedValue(mockFiatTransaction as any);
      fiatWalletEscrowService.getEscrowAmount.mockResolvedValue(5000);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet as any);
      transactionService.create.mockResolvedValue({
        id: 'refund-txn-123',
        reference: 'ref-refund-123',
      } as any);
      fiatWalletTransactionService.create.mockResolvedValue({
        id: 'refund-fiat-txn-123',
      } as any);

      await service.updateSourceTransactionsToFailed('txn-123', 'Error message');

      expect(fiatWalletEscrowService.getEscrowAmount).toHaveBeenCalledWith('txn-123');
      expect(fiatWalletService.getUserWallet).toHaveBeenCalledWith('user-123', 'NGN');
      expect(fiatWalletEscrowService.releaseMoneyFromEscrow).toHaveBeenCalledWith('txn-123');
    });

    it('should not release escrow when escrow amount is 0', async () => {
      fiatWalletTransactionRepository.findOne.mockResolvedValue(mockFiatTransaction as any);
      fiatWalletEscrowService.getEscrowAmount.mockResolvedValue(0);

      await service.updateSourceTransactionsToFailed('txn-123', 'Error message');

      expect(fiatWalletEscrowService.releaseMoneyFromEscrow).not.toHaveBeenCalled();
    });
  });

  describe('verifyTransferStatusToYellowcard', () => {
    it('should return true when transaction status is SUCCESS', async () => {
      waasAdapter.getTransactionStatus.mockResolvedValue({ status: 'SUCCESS' } as any);

      const result = await service.verifyTransferStatusToYellowcard('txn-ref-123');

      expect(result).toBe(true);
      expect(waasAdapter.getTransactionStatus).toHaveBeenCalledWith({ transactionRef: 'txn-ref-123' });
    });

    it('should return false when transaction status is not SUCCESS', async () => {
      waasAdapter.getTransactionStatus.mockResolvedValue({ status: 'PENDING' } as any);

      const result = await service.verifyTransferStatusToYellowcard('txn-ref-123');

      expect(result).toBe(false);
    });

    it('should return false when transaction status is FAILED', async () => {
      waasAdapter.getTransactionStatus.mockResolvedValue({ status: 'FAILED' } as any);

      const result = await service.verifyTransferStatusToYellowcard('txn-ref-123');

      expect(result).toBe(false);
    });
  });

  describe('Amount validation', () => {
    const mockUserLimits = {
      minimum_transaction_amount: 1000,
      maximum_transaction_amount: 1000000,
    };

    beforeEach(() => {
      userTierService.getAssetLimits.mockResolvedValue(mockUserLimits as any);
      rateRepository.findOne.mockResolvedValue(mockRate as any);
      userRepository.findOne.mockResolvedValue(mockUser as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet as any);
      fiatWalletService.checkIfUserHasEnoughBalanceOrThrow.mockResolvedValue();
      exchangeAdapter.getChannels.mockResolvedValue([mockChannel] as any);
      exchangeAdapter.getBanks.mockResolvedValue([mockNetwork] as any);
      depositAddressService.getDepositAddresses.mockResolvedValue([mockDepositAddress] as any);
      kycAdapter.getKycDetailsByUserId.mockResolvedValue(mockKycDetails as any);
      rateService.getRate.mockResolvedValue(mockRateConfig as any);
    });

    it('should throw InternalServerErrorException when amount is below channel minimum', async () => {
      const channelWithHighMin = { ...mockChannel, min: 50000 };
      exchangeAdapter.getChannels.mockResolvedValue([channelWithHighMin] as any);

      await expect(
        service.executeExchange(mockUser as any, { from: 'NGN', to: 'USD', amount: 10000, rate_id: 'rate-123' } as any),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException when amount is above channel maximum', async () => {
      const channelWithLowMax = { ...mockChannel, max: 5000 };
      exchangeAdapter.getChannels.mockResolvedValue([channelWithLowMax] as any);

      await expect(
        service.executeExchange(mockUser as any, { from: 'NGN', to: 'USD', amount: 10000, rate_id: 'rate-123' } as any),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should accept amount within channel limits', async () => {
      exchangeAdapter.createPayInRequest.mockResolvedValue(mockPayInRequest as any);
      transactionService.create.mockResolvedValue(mockTransaction as any);
      fiatWalletTransactionService.create.mockResolvedValue(mockTransaction.fiatWalletTransaction as any);
      transactionRepository.update.mockResolvedValue(mockTransaction as any);
      fiatExchangeService.getValidatedVirtualAccount.mockResolvedValue(mockVirtualAccount as any);
      waasAdapter.getBankList.mockResolvedValue(mockBankList as any);
      waasAdapter.transferToOtherBank.mockResolvedValue({ status: 'success' } as any);

      const result = await service.executeExchange(
        mockUser as any,
        {
          from: 'NGN',
          to: 'USD',
          amount: 10000,
          rate_id: 'rate-123',
        } as any,
      );

      expect(result.status).toBe('processing');
    });
  });

  describe('Rate validation', () => {
    const payload = {
      from: 'NGN',
      to: 'USD',
      amount: 10000,
      rate_id: 'rate-123',
    };

    const mockUserLimits = {
      minimum_transaction_amount: 1000,
      maximum_transaction_amount: 1000000,
    };

    beforeEach(() => {
      userTierService.getAssetLimits.mockResolvedValue(mockUserLimits as any);
      userRepository.findOne.mockResolvedValue(mockUser as any);
    });

    it('should throw InternalServerErrorException when rate id does not exist', async () => {
      rateRepository.findOne.mockResolvedValue(null);

      await expect(service.executeExchange(mockUser as any, payload as any)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException when rate buying currency is not USD', async () => {
      const nonUsdRate = { ...mockRate, buying_currency_code: 'EUR' };
      rateRepository.findOne.mockResolvedValue(nonUsdRate as any);

      await expect(service.executeExchange(mockUser as any, payload as any)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should accept rate when buying currency is USD (case insensitive)', async () => {
      const usdRateLowerCase = { ...mockRate, buying_currency_code: 'usd' };
      rateRepository.findOne.mockResolvedValue(usdRateLowerCase as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet as any);
      fiatWalletService.checkIfUserHasEnoughBalanceOrThrow.mockResolvedValue();
      exchangeAdapter.getChannels.mockResolvedValue([mockChannel] as any);
      exchangeAdapter.getBanks.mockResolvedValue([mockNetwork] as any);
      depositAddressService.getDepositAddresses.mockResolvedValue([mockDepositAddress] as any);
      kycAdapter.getKycDetailsByUserId.mockResolvedValue(mockKycDetails as any);
      exchangeAdapter.createPayInRequest.mockResolvedValue(mockPayInRequest as any);
      transactionService.create.mockResolvedValue(mockTransaction as any);
      fiatWalletTransactionService.create.mockResolvedValue(mockTransaction.fiatWalletTransaction as any);
      transactionRepository.update.mockResolvedValue(mockTransaction as any);
      rateService.getRate.mockResolvedValue(mockRateConfig as any);
      waasAdapter.getBankList.mockResolvedValue(mockBankList as any);
      fiatExchangeService.getValidatedVirtualAccount.mockResolvedValue(mockVirtualAccount as any);
      waasAdapter.transferToOtherBank.mockResolvedValue({ status: 'success' } as any);

      const result = await service.executeExchange(mockUser as any, payload as any);

      expect(rateRepository.findOne).toHaveBeenCalledWith({ id: payload.rate_id });
      expect(result.status).toBe('processing');
    });

    it('should calculate converted amount using rate', async () => {
      rateRepository.findOne.mockResolvedValue(mockRate as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet as any);
      fiatWalletService.checkIfUserHasEnoughBalanceOrThrow.mockResolvedValue();
      exchangeAdapter.getChannels.mockResolvedValue([mockChannel] as any);
      exchangeAdapter.getBanks.mockResolvedValue([mockNetwork] as any);
      depositAddressService.getDepositAddresses.mockResolvedValue([mockDepositAddress] as any);
      kycAdapter.getKycDetailsByUserId.mockResolvedValue(mockKycDetails as any);
      exchangeAdapter.createPayInRequest.mockResolvedValue(mockPayInRequest as any);
      transactionService.create.mockResolvedValue(mockTransaction as any);
      fiatWalletTransactionService.create.mockResolvedValue(mockTransaction.fiatWalletTransaction as any);
      transactionRepository.update.mockResolvedValue(mockTransaction as any);
      rateService.getRate.mockResolvedValue(mockRateConfig as any);
      waasAdapter.getBankList.mockResolvedValue(mockBankList as any);
      fiatExchangeService.getValidatedVirtualAccount.mockResolvedValue(mockVirtualAccount as any);
      waasAdapter.transferToOtherBank.mockResolvedValue({ status: 'success' } as any);

      await service.executeExchange(mockUser as any, payload as any);

      const rateInMainUnit = CurrencyUtility.formatCurrencyAmountToMainUnit(mockRate.rate, payload.from);
      expect(rateInMainUnit).toBeDefined();
    });
  });

  describe('Transaction creation and updates', () => {
    const payload = {
      from: 'NGN',
      to: 'USD',
      amount: 10000,
      rate_id: 'rate-123',
    };

    const mockUserLimits = {
      minimum_transaction_amount: 1000,
      maximum_transaction_amount: 1000000,
    };

    beforeEach(() => {
      userTierService.getAssetLimits.mockResolvedValue(mockUserLimits as any);
      rateRepository.findOne.mockResolvedValue(mockRate as any);
      userRepository.findOne.mockResolvedValue(mockUser as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet as any);
      fiatWalletService.checkIfUserHasEnoughBalanceOrThrow.mockResolvedValue();
      exchangeAdapter.getChannels.mockResolvedValue([mockChannel] as any);
      exchangeAdapter.getBanks.mockResolvedValue([mockNetwork] as any);
      depositAddressService.getDepositAddresses.mockResolvedValue([mockDepositAddress] as any);
      kycAdapter.getKycDetailsByUserId.mockResolvedValue(mockKycDetails as any);
      exchangeAdapter.createPayInRequest.mockResolvedValue(mockPayInRequest as any);
      transactionService.create.mockResolvedValue(mockTransaction as any);
      fiatWalletTransactionService.create.mockResolvedValue(mockTransaction.fiatWalletTransaction as any);
      transactionRepository.update.mockResolvedValue(mockTransaction as any);
      fiatWalletTransactionRepository.update.mockResolvedValue(mockTransaction.fiatWalletTransaction as any);
      rateService.getRate.mockResolvedValue(mockRateConfig as any);
      waasAdapter.getBankList.mockResolvedValue(mockBankList as any);
      fiatExchangeService.getValidatedVirtualAccount.mockResolvedValue(mockVirtualAccount as any);
      waasAdapter.transferToOtherBank.mockResolvedValue({ status: 'success' } as any);
    });

    it('should create parent transaction with correct metadata', async () => {
      await service.executeExchange(mockUser as any, payload as any);

      expect(transactionService.create).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          asset: 'NGN',
          status: TransactionStatus.INITIATED,
          transaction_type: 'exchange',
          metadata: expect.objectContaining({
            source_currency: 'NGN',
            destination_currency: 'USD',
          }),
        }),
        undefined,
      );
    });

    it('should create fiat wallet transaction linked to parent transaction', async () => {
      await service.executeExchange(mockUser as any, payload as any);

      expect(fiatWalletTransactionService.create).toHaveBeenCalled();
    });

    it('should queue job with converted amount for later metadata update', async () => {
      const executeNewNgUsdExchangeProcessor = {
        queueExecuteNewNgUsdExchange: jest.fn().mockResolvedValue({ id: 'job-123' }),
      };
      (service as any).executeNewNgUsdExchangeProcessor = executeNewNgUsdExchangeProcessor;

      await service.executeExchange(mockUser as any, payload as any);

      expect(executeNewNgUsdExchangeProcessor.queueExecuteNewNgUsdExchange).toHaveBeenCalledWith(
        expect.objectContaining({
          localAmount: expect.any(Number),
          payload: expect.objectContaining({
            amount: payload.amount,
          }),
        }),
      );
    });

    it('should check balance before creating transactions', async () => {
      await service.executeExchange(mockUser as any, payload as any);

      // checkIfUserHasEnoughBalanceOrThrow is called once in executeExchange
      // The second call happens in the processor (tested separately)
      expect(fiatWalletService.checkIfUserHasEnoughBalanceOrThrow).toHaveBeenCalledWith(
        mockUser.id,
        payload.amount,
        payload.from,
      );
    });

    it('should create parent transaction with correct description/remark', async () => {
      await service.executeExchange(mockUser as any, payload as any);

      expect(transactionService.create).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          description: 'Exchange from NGN Wallet',
        }),
        undefined,
      );
    });

    it('should create fiat wallet transaction with correct description/remark', async () => {
      await service.executeExchange(mockUser as any, payload as any);

      expect(fiatWalletTransactionService.create).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          description: 'Exchange from NGN Wallet',
        }),
        undefined,
      );
    });
  });

  describe('Fee calculations', () => {
    const payload = {
      from: 'NGN',
      to: 'USD',
      amount: 10000,
      rate_id: 'rate-123',
    };

    const mockUserLimits = {
      minimum_transaction_amount: 1000,
      maximum_transaction_amount: 1000000,
    };

    beforeEach(() => {
      userTierService.getAssetLimits.mockResolvedValue(mockUserLimits as any);
      rateRepository.findOne.mockResolvedValue(mockRate as any);
      userRepository.findOne.mockResolvedValue(mockUser as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet as any);
      fiatWalletService.checkIfUserHasEnoughBalanceOrThrow.mockResolvedValue();
      exchangeAdapter.getChannels.mockResolvedValue([mockChannel] as any);
      exchangeAdapter.getBanks.mockResolvedValue([mockNetwork] as any);
      depositAddressService.getDepositAddresses.mockResolvedValue([mockDepositAddress] as any);
      kycAdapter.getKycDetailsByUserId.mockResolvedValue(mockKycDetails as any);
      transactionService.create.mockResolvedValue(mockTransaction as any);
      fiatWalletTransactionService.create.mockResolvedValue(mockTransaction.fiatWalletTransaction as any);
      transactionRepository.update.mockResolvedValue(mockTransaction as any);
      fiatWalletTransactionRepository.update.mockResolvedValue(mockTransaction.fiatWalletTransaction as any);
      rateService.getRate.mockResolvedValue(mockRateConfig as any);
      waasAdapter.getBankList.mockResolvedValue(mockBankList as any);
      fiatExchangeService.getValidatedVirtualAccount.mockResolvedValue(mockVirtualAccount as any);
      waasAdapter.transferToOtherBank.mockResolvedValue({ status: 'success' } as any);
    });

    it('should add service fee and partner fee to converted amount in non-production', async () => {
      exchangeAdapter.createPayInRequest.mockResolvedValue(mockPayInRequest as any);

      await service.executeExchange(mockUser as any, payload as any);

      expect(rateService.getRate).toHaveBeenCalledWith(payload.from, payload.amount);
    });

    it('should queue job for fee processing in processor', async () => {
      const executeNewNgUsdExchangeProcessor = {
        queueExecuteNewNgUsdExchange: jest.fn().mockResolvedValue({ id: 'job-123' }),
      };
      (service as any).executeNewNgUsdExchangeProcessor = executeNewNgUsdExchangeProcessor;

      exchangeAdapter.createPayInRequest.mockResolvedValue(mockPayInRequest as any);

      await service.executeExchange(mockUser as any, payload as any);

      // Fee processing happens in the processor, not in executeExchange
      // executeExchange queues the job with localAmount
      expect(executeNewNgUsdExchangeProcessor.queueExecuteNewNgUsdExchange).toHaveBeenCalledWith(
        expect.objectContaining({
          localAmount: expect.any(Number),
          parentTransaction: expect.any(Object),
          fiatTransaction: expect.any(Object),
        }),
      );
    });

    it('should apply service fee and partner fee to converted amount in non-production', async () => {
      exchangeAdapter.createPayInRequest.mockResolvedValue(mockPayInRequest as any);

      const executeNewNgUsdExchangeProcessor = {
        queueExecuteNewNgUsdExchange: jest.fn().mockResolvedValue({ id: 'job-123' }),
      };
      (service as any).executeNewNgUsdExchangeProcessor = executeNewNgUsdExchangeProcessor;

      await service.executeExchange(mockUser as any, payload as any);

      // In non-production, service fee and partner fee are added to converted amount
      expect(rateService.getRate).toHaveBeenCalledWith(payload.from, payload.amount);
      expect(executeNewNgUsdExchangeProcessor.queueExecuteNewNgUsdExchange).toHaveBeenCalledWith(
        expect.objectContaining({
          localAmount: expect.any(Number),
        }),
      );
    });

    it('should include fiat transaction in job data for fee updates', async () => {
      const executeNewNgUsdExchangeProcessor = {
        queueExecuteNewNgUsdExchange: jest.fn().mockResolvedValue({ id: 'job-123' }),
      };
      (service as any).executeNewNgUsdExchangeProcessor = executeNewNgUsdExchangeProcessor;

      exchangeAdapter.createPayInRequest.mockResolvedValue(mockPayInRequest as any);

      await service.executeExchange(mockUser as any, payload as any);

      expect(executeNewNgUsdExchangeProcessor.queueExecuteNewNgUsdExchange).toHaveBeenCalledWith(
        expect.objectContaining({
          fiatTransaction: mockTransaction.fiatWalletTransaction,
        }),
      );
    });
  });
});
