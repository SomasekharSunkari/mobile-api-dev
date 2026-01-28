import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ExchangeAdapter } from '../../adapters/exchange/exchange.adapter';
import { KYCAdapter } from '../../adapters/kyc/kyc-adapter';
import { WaasAdapter } from '../../adapters/waas/waas.adapter';
import { ExistInConstraint } from '../../decorators/ExistsIn';
import { LockerService } from '../../services/locker/locker.service';
import { RegionalAccessGuard } from '../auth/guard';
import { AccountDeactivationGuard } from '../auth/guard/accountDeactivationGuard/accountDeactivation.guard';
import { TransactionPinGuard } from '../auth/guard/transactionPinGuard/transactionPin.guard';
import { KycVerificationRepository } from '../auth/kycVerification/kycVerification.repository';
import { UserRepository } from '../auth/user/user.repository';
import { UserService } from '../auth/user/user.service';
import { SystemUsersBeneficiaryService } from '../beneficiaries/systemUsersBeneficiary';
import { DepositAddressService } from '../depositAddress/depositAddress.service';
import { FiatWalletService } from '../fiatWallet';
import { FiatWalletTransactionRepository } from '../fiatWalletTransactions/fiatWalletTransactions.repository';
import { FiatWalletTransactionService } from '../fiatWalletTransactions/fiatWalletTransactions.service';
import { RateTransactionService } from '../rateTransaction/rateTransaction.service';
import { TransactionRepository } from '../transaction/transaction.repository';
import { TransactionService } from '../transaction/transaction.service';
import { VirtualAccountService } from '../virtualAccount';
import { ExchangeFiatWalletDto } from './dto/exchange-fiat-wallet.dto';
import { InitiateExchangeDto } from './dto/initiateExchange.dto';
import { OnRampNGToUSDDto } from './dto/onRampNGtoUSD.dto';
import { OnRampUsdToNgDto } from './dto/onRampUsdToNg.dto';
import { ExchangeRetryService } from './exchange-retry.service';
import { ExchangeController } from './exchange.controller';
import { ExchangeModule } from './exchange.module';
import { FiatExchangeService } from './fiat-exchange/fiat-exchange.service';
import { NewNgToUsdExchangeService } from './fiat-exchange/ng-to-usd-exchange.service/new-ng-to-usd-exchange.service';
import { NgToUsdExchangeService } from './fiat-exchange/ng-to-usd-exchange.service/ng-to-usd-exchange.service';

// Mock ExistInConstraint to avoid database connections in unit tests
jest.spyOn(ExistInConstraint.prototype, 'validate').mockResolvedValue(true);

describe('ExchangeService', () => {
  beforeEach(async () => {
    await Test.createTestingModule({
      providers: [
        {
          provide: ExchangeAdapter,
          useValue: {},
        },
        {
          provide: FiatWalletService,
          useValue: {},
        },
        {
          provide: UserRepository,
          useValue: {},
        },
        {
          provide: KYCAdapter,
          useValue: {},
        },
        {
          provide: KycVerificationRepository,
          useValue: {},
        },
        {
          provide: VirtualAccountService,
          useValue: {},
        },
        {
          provide: LockerService,
          useValue: {},
        },
        {
          provide: TransactionService,
          useValue: {},
        },
        {
          provide: TransactionRepository,
          useValue: {},
        },
        {
          provide: UserService,
          useValue: {},
        },
        {
          provide: RateTransactionService,
          useValue: {},
        },
        {
          provide: FiatWalletTransactionService,
          useValue: {},
        },
        {
          provide: FiatWalletTransactionRepository,
          useValue: {},
        },
        {
          provide: WaasAdapter,
          useValue: {},
        },
        {
          provide: DepositAddressService,
          useValue: {},
        },
        {
          provide: SystemUsersBeneficiaryService,
          useValue: {},
        },
      ],
    }).compile();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should compile the test module', () => {
    expect(true).toBe(true);
  });
});

describe('ExchangeController', () => {
  let controller: ExchangeController;
  let fiatExchangeService: any;
  let ngToUsdExchangeService: any;
  let exchangeRetryService: any;

  const mockFiatExchangeService = {
    exchange: jest.fn(),
  };

  const mockNgToUsdExchangeService = {
    initializeNgToUSDExchange: jest.fn(),
    executeExchange: jest.fn(),
  };

  const mockExchangeRetryService = {
    retryExchange: jest.fn(),
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    first_name: 'Test',
    last_name: 'User',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExchangeController],
      providers: [
        {
          provide: FiatExchangeService,
          useValue: mockFiatExchangeService,
        },
        {
          provide: NgToUsdExchangeService,
          useValue: mockNgToUsdExchangeService,
        },
        {
          provide: ExchangeRetryService,
          useValue: mockExchangeRetryService,
        },
      ],
    })
      .overrideGuard(TransactionPinGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(AccountDeactivationGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RegionalAccessGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<ExchangeController>(ExchangeController);
    fiatExchangeService = module.get<FiatExchangeService>(FiatExchangeService);
    ngToUsdExchangeService = module.get<NgToUsdExchangeService>(NgToUsdExchangeService);
    exchangeRetryService = module.get<ExchangeRetryService>(ExchangeRetryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('initiateExchange', () => {
    it('should successfully initiate NGN to USD exchange', async () => {
      const initiateDto = {
        from: 'NGN',
        to: 'USD',
        amount: 100000,
        rate_id: 'rate-123',
      };

      const mockResponse = {
        status: 'initiated',
        transactionRef: 'tx-123',
        message: 'Exchange initiated successfully',
      };

      mockNgToUsdExchangeService.initializeNgToUSDExchange.mockResolvedValue(mockResponse);

      const result = await controller.initiateExchange(mockUser as any, initiateDto as any);

      expect(ngToUsdExchangeService.initializeNgToUSDExchange).toHaveBeenCalledWith(mockUser.id, initiateDto);
      expect(result).toEqual({
        message: 'Exchange initiated successfully',
        data: mockResponse,
        statusCode: 200,
        timestamp: expect.any(String),
      });
    });

    it('should successfully initiate exchange with lowercase currencies', async () => {
      const initiateDto = {
        from: 'ngn',
        to: 'usd',
        amount: 100000,
        rate_id: 'rate-123',
      };

      const mockResponse = {
        status: 'initiated',
        transactionRef: 'tx-456',
        message: 'Exchange initiated successfully',
      };

      mockNgToUsdExchangeService.initializeNgToUSDExchange.mockResolvedValue(mockResponse);

      const result = await controller.initiateExchange(mockUser as any, initiateDto as any);

      expect(ngToUsdExchangeService.initializeNgToUSDExchange).toHaveBeenCalledWith(mockUser.id, initiateDto);
      expect(result).toEqual({
        message: 'Exchange initiated successfully',
        data: mockResponse,
        statusCode: 200,
        timestamp: expect.any(String),
      });
    });

    it('should handle service errors during exchange initiation', async () => {
      const initiateDto = {
        from: 'NGN',
        to: 'USD',
        amount: 100000,
        rate_id: 'rate-123',
      };

      const error = new Error('Invalid rate');
      mockNgToUsdExchangeService.initializeNgToUSDExchange.mockRejectedValue(error);

      await expect(controller.initiateExchange(mockUser as any, initiateDto as any)).rejects.toThrow(error);
      expect(ngToUsdExchangeService.initializeNgToUSDExchange).toHaveBeenCalledWith(mockUser.id, initiateDto);
    });
  });

  describe('exchangeFiatWallet', () => {
    it('should successfully exchange USD to NGN', async () => {
      const exchangeDto = {
        from: 'USD',
        to: 'NGN',
        amount: 100,
        rate_id: 'rate-123',
      };

      const mockResponse = {
        status: 'processing',
        transactionRef: 'tx-123',
        message: 'Exchange transaction initiated successfully',
        jobId: 'job-123',
      };

      mockFiatExchangeService.exchange.mockResolvedValue(mockResponse);

      const result = await controller.exchangeFiatWallet(mockUser as any, exchangeDto as any);

      expect(fiatExchangeService.exchange).toHaveBeenCalledWith(mockUser, exchangeDto);
      expect(result).toEqual({
        message: 'Fiat wallet exchanged successfully',
        data: mockResponse,
        statusCode: 200,
        timestamp: expect.any(String),
      });
    });

    it('should successfully exchange NGN to USD', async () => {
      const exchangeDto = {
        from: 'NGN',
        to: 'USD',
        amount: 75000,
        rate_id: 'rate-123',
      };

      const mockResponse = {
        status: 'processing',
        transactionRef: 'tx-456',
        message: 'Exchange transaction initiated successfully',
        jobId: 'job-456',
      };

      mockFiatExchangeService.exchange.mockResolvedValue(mockResponse);

      const result = await controller.exchangeFiatWallet(mockUser as any, exchangeDto as any);

      expect(fiatExchangeService.exchange).toHaveBeenCalledWith(mockUser, exchangeDto);
      expect(result).toEqual({
        message: 'Fiat wallet exchanged successfully',
        data: mockResponse,
        statusCode: 200,
        timestamp: expect.any(String),
      });
    });

    it('should successfully exchange with lowercase currencies', async () => {
      const exchangeDto = {
        from: 'ngn',
        to: 'usd',
        amount: 75000,
        rate_id: 'rate-123',
      };

      const mockResponse = {
        status: 'processing',
        transactionRef: 'tx-789',
        message: 'Exchange transaction initiated successfully',
        jobId: 'job-789',
      };

      mockFiatExchangeService.exchange.mockResolvedValue(mockResponse);

      const result = await controller.exchangeFiatWallet(mockUser as any, exchangeDto as any);

      expect(fiatExchangeService.exchange).toHaveBeenCalledWith(mockUser, exchangeDto);
      expect(result).toEqual({
        message: 'Fiat wallet exchanged successfully',
        data: mockResponse,
        statusCode: 200,
        timestamp: expect.any(String),
      });
    });

    it('should handle service errors during fiat wallet exchange', async () => {
      const exchangeDto = {
        from: 'USD',
        to: 'NGN',
        amount: 75000,
        rate_id: 'rate-123',
      };

      const error = new Error('Invalid exchange rate');
      mockFiatExchangeService.exchange.mockRejectedValue(error);

      await expect(controller.exchangeFiatWallet(mockUser as any, exchangeDto as any)).rejects.toThrow(error);
      expect(fiatExchangeService.exchange).toHaveBeenCalledWith(mockUser, exchangeDto);
    });

    it('should use transformResponse for consistent API response format', async () => {
      const exchangeDto = {
        from: 'USD',
        to: 'NGN',
        amount: 100,
        rate_id: 'rate-789',
      };

      const mockResponse = {
        status: 'processing',
        transactionRef: 'tx-789',
        message: 'Exchange transaction initiated successfully',
        jobId: 'job-789',
      };

      mockFiatExchangeService.exchange.mockResolvedValue(mockResponse);

      const result = await controller.exchangeFiatWallet(mockUser as any, exchangeDto as any);

      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('statusCode');
      expect(result).toHaveProperty('timestamp');
      expect(result.data).toEqual(mockResponse);
    });

    it('should allow USD to NGN exchange without throwing error', async () => {
      const exchangeDto = {
        from: 'USD',
        to: 'NGN',
        amount: 100,
        rate_id: 'rate-123',
      };

      const mockResponse = {
        status: 'processing',
        transactionRef: 'tx-123',
        message: 'Exchange transaction initiated successfully',
        jobId: 'job-123',
      };

      mockFiatExchangeService.exchange.mockResolvedValue(mockResponse);

      await expect(controller.exchangeFiatWallet(mockUser as any, exchangeDto as any)).resolves.not.toThrow();
    });

    it('should allow NGN to NGN exchange without throwing error', async () => {
      const exchangeDto = {
        from: 'NGN',
        to: 'NGN',
        amount: 100,
        rate_id: 'rate-123',
      };

      const mockResponse = {
        status: 'processing',
        transactionRef: 'tx-123',
        message: 'Exchange transaction initiated successfully',
        jobId: 'job-123',
      };

      mockFiatExchangeService.exchange.mockResolvedValue(mockResponse);

      await expect(controller.exchangeFiatWallet(mockUser as any, exchangeDto as any)).resolves.not.toThrow();
    });
  });

  describe('BaseController integration', () => {
    it('should extend BaseController and have transformResponse method', () => {
      expect(controller).toBeInstanceOf(ExchangeController);
      expect(typeof controller['transformResponse']).toBe('function');
    });
  });

  describe('retryExchange', () => {
    const mockRetryResponse = {
      message: 'Exchange retry initiated successfully',
      parent_transaction_id: 'parent-tx-123',
      new_account_number: '9876543210',
      new_sequence_ref: 'new-sequence-ref-789',
    };

    it('should successfully retry exchange transaction', async () => {
      mockExchangeRetryService.retryExchange.mockResolvedValue(mockRetryResponse);

      const result = await controller.retryExchange('parent-tx-123');

      expect(exchangeRetryService.retryExchange).toHaveBeenCalledWith('parent-tx-123');
      expect(result).toEqual({
        message: 'Exchange retry initiated successfully',
        data: mockRetryResponse,
        statusCode: 200,
        timestamp: expect.any(String),
      });
    });

    it('should handle service errors during exchange retry', async () => {
      const error = new Error('Parent transaction not found');
      mockExchangeRetryService.retryExchange.mockRejectedValue(error);

      await expect(controller.retryExchange('non-existent-tx')).rejects.toThrow(error);
      expect(exchangeRetryService.retryExchange).toHaveBeenCalledWith('non-existent-tx');
    });

    it('should use transformResponse for consistent API response format', async () => {
      mockExchangeRetryService.retryExchange.mockResolvedValue(mockRetryResponse);

      const result = await controller.retryExchange('parent-tx-123');

      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('statusCode');
      expect(result).toHaveProperty('timestamp');
      expect(result.data).toEqual(mockRetryResponse);
    });
  });
});

describe('ExchangeModule', () => {
  it('should be defined', () => {
    expect(ExchangeModule).toBeDefined();
  });

  it('should be a valid NestJS module class', () => {
    const module = new ExchangeModule();
    expect(module).toBeInstanceOf(ExchangeModule);
  });

  it('should have correct module metadata', () => {
    const metadata = Reflect.getMetadata('imports', ExchangeModule);
    expect(metadata).toBeDefined();
    expect(Array.isArray(metadata)).toBe(true);
  });

  it('should have controllers metadata', () => {
    const controllers = Reflect.getMetadata('controllers', ExchangeModule);
    expect(controllers).toBeDefined();
    expect(Array.isArray(controllers)).toBe(true);
    expect(controllers).toContain(ExchangeController);
  });

  it('should have providers metadata', () => {
    const providers = Reflect.getMetadata('providers', ExchangeModule);
    expect(providers).toBeDefined();
    expect(Array.isArray(providers)).toBe(true);
    expect(providers).toContain(FiatExchangeService);
    expect(providers).toContain(NgToUsdExchangeService);
    expect(providers).toContain(NewNgToUsdExchangeService);
    expect(providers).toContain(ExchangeRetryService);
  });
});

describe('InitiateExchangeDto', () => {
  it('should validate a valid DTO', async () => {
    const dto = plainToInstance(InitiateExchangeDto, {
      from: 'NGN',
      to: 'USD',
      amount: 100.5,
      rate_id: 'rate-123',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail when from is not NGN', async () => {
    const dto = plainToInstance(InitiateExchangeDto, {
      from: 'USD',
      to: 'USD',
      amount: 100,
      rate_id: 'rate-123',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'from')).toBe(true);
  });

  it('should fail when to is not USD', async () => {
    const dto = plainToInstance(InitiateExchangeDto, {
      from: 'NGN',
      to: 'NGN',
      amount: 100,
      rate_id: 'rate-123',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'to')).toBe(true);
  });

  it('should fail when from is empty', async () => {
    const dto = plainToInstance(InitiateExchangeDto, {
      from: '',
      to: 'USD',
      amount: 100,
      rate_id: 'rate-123',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'from')).toBe(true);
  });

  it('should fail when to is empty', async () => {
    const dto = plainToInstance(InitiateExchangeDto, {
      from: 'NGN',
      to: '',
      amount: 100,
      rate_id: 'rate-123',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'to')).toBe(true);
  });

  it('should fail when amount is less than 0.01', async () => {
    const dto = plainToInstance(InitiateExchangeDto, {
      from: 'NGN',
      to: 'USD',
      amount: 0.001,
      rate_id: 'rate-123',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'amount')).toBe(true);
  });

  it('should fail when amount has more than 2 decimal places', async () => {
    const dto = plainToInstance(InitiateExchangeDto, {
      from: 'NGN',
      to: 'USD',
      amount: 100.123,
      rate_id: 'rate-123',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'amount')).toBe(true);
  });

  it('should fail when rate_id is empty', async () => {
    const dto = plainToInstance(InitiateExchangeDto, {
      from: 'NGN',
      to: 'USD',
      amount: 100,
      rate_id: '',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'rate_id')).toBe(true);
  });

  it('should fail when rate_id is missing', async () => {
    const dto = plainToInstance(InitiateExchangeDto, {
      from: 'NGN',
      to: 'USD',
      amount: 100,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'rate_id')).toBe(true);
  });

  it('should transform string amount to number', async () => {
    const dto = plainToInstance(InitiateExchangeDto, {
      from: 'NGN',
      to: 'USD',
      amount: '100.50',
      rate_id: 'rate-123',
    });

    expect(typeof dto.amount).toBe('number');
    expect(dto.amount).toBe(100.5);
  });
});

describe('OnRampNGToUSDDto', () => {
  it('should validate a valid DTO', async () => {
    const dto = plainToInstance(OnRampNGToUSDDto, {
      amount: 1000.5,
      receiver_username: 'john_doe',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should validate with optional system_user_beneficiary_id', async () => {
    const dto = plainToInstance(OnRampNGToUSDDto, {
      amount: 1000.5,
      receiver_username: 'john_doe',
      system_user_beneficiary_id: '1234567890',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail when amount is less than 0.01', async () => {
    const dto = plainToInstance(OnRampNGToUSDDto, {
      amount: 0.001,
      receiver_username: 'john_doe',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'amount')).toBe(true);
  });

  it('should fail when amount has more than 2 decimal places', async () => {
    const dto = plainToInstance(OnRampNGToUSDDto, {
      amount: 100.123,
      receiver_username: 'john_doe',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'amount')).toBe(true);
  });

  it('should fail when amount is empty', async () => {
    const dto = plainToInstance(OnRampNGToUSDDto, {
      receiver_username: 'john_doe',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'amount')).toBe(true);
  });

  it('should transform string amount to number', async () => {
    const dto = plainToInstance(OnRampNGToUSDDto, {
      amount: '500.25',
      receiver_username: 'john_doe',
    });

    expect(typeof dto.amount).toBe('number');
    expect(dto.amount).toBe(500.25);
  });

  it('should validate with receiver_username set', () => {
    const dto = plainToInstance(OnRampNGToUSDDto, {
      amount: 100,
      receiver_username: 'test_user',
    });

    expect(dto.receiver_username).toBe('test_user');
  });

  it('should fail when system_user_beneficiary_id is not a string', async () => {
    const dto = plainToInstance(OnRampNGToUSDDto, {
      amount: 100,
      receiver_username: 'john_doe',
      system_user_beneficiary_id: 12345,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'system_user_beneficiary_id')).toBe(true);
  });
});

describe('OnRampUsdToNgDto', () => {
  it('should validate a valid DTO', async () => {
    const dto = plainToInstance(OnRampUsdToNgDto, {
      amount: 100.5,
      transaction_id: '123e4567-e89b-12d3-a456-426614174000',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail when amount is less than 0.01', async () => {
    const dto = plainToInstance(OnRampUsdToNgDto, {
      amount: 0.001,
      transaction_id: '123e4567-e89b-12d3-a456-426614174000',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'amount')).toBe(true);
  });

  it('should fail when amount has more than 2 decimal places', async () => {
    const dto = plainToInstance(OnRampUsdToNgDto, {
      amount: 100.123,
      transaction_id: '123e4567-e89b-12d3-a456-426614174000',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'amount')).toBe(true);
  });

  it('should fail when amount is empty', async () => {
    const dto = plainToInstance(OnRampUsdToNgDto, {
      transaction_id: '123e4567-e89b-12d3-a456-426614174000',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'amount')).toBe(true);
  });

  it('should fail when transaction_id is empty', async () => {
    const dto = plainToInstance(OnRampUsdToNgDto, {
      amount: 100,
      transaction_id: '',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'transaction_id')).toBe(true);
  });

  it('should fail when transaction_id is missing', async () => {
    const dto = plainToInstance(OnRampUsdToNgDto, {
      amount: 100,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'transaction_id')).toBe(true);
  });

  it('should transform string amount to number', async () => {
    const dto = plainToInstance(OnRampUsdToNgDto, {
      amount: '250.75',
      transaction_id: '123e4567-e89b-12d3-a456-426614174000',
    });

    expect(typeof dto.amount).toBe('number');
    expect(dto.amount).toBe(250.75);
  });
});

describe('ExchangeFiatWalletDto', () => {
  it('should validate a valid DTO with USD to NGN', async () => {
    const dto = plainToInstance(ExchangeFiatWalletDto, {
      from: 'USD',
      to: 'NGN',
      amount: 100.5,
      rate_id: 'rate-123',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should validate a valid DTO with NGN to USD', async () => {
    const dto = plainToInstance(ExchangeFiatWalletDto, {
      from: 'NGN',
      to: 'USD',
      amount: 75000,
      rate_id: 'rate-456',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should validate with optional transaction_id', async () => {
    const dto = plainToInstance(ExchangeFiatWalletDto, {
      from: 'USD',
      to: 'NGN',
      amount: 100,
      rate_id: 'rate-123',
      transaction_id: 'tx-123',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail when from is not USD or NGN', async () => {
    const dto = plainToInstance(ExchangeFiatWalletDto, {
      from: 'EUR',
      to: 'NGN',
      amount: 100,
      rate_id: 'rate-123',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'from')).toBe(true);
  });

  it('should fail when to is not USD or NGN', async () => {
    const dto = plainToInstance(ExchangeFiatWalletDto, {
      from: 'USD',
      to: 'EUR',
      amount: 100,
      rate_id: 'rate-123',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'to')).toBe(true);
  });

  it('should fail when from is empty', async () => {
    const dto = plainToInstance(ExchangeFiatWalletDto, {
      from: '',
      to: 'NGN',
      amount: 100,
      rate_id: 'rate-123',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'from')).toBe(true);
  });

  it('should fail when to is empty', async () => {
    const dto = plainToInstance(ExchangeFiatWalletDto, {
      from: 'USD',
      to: '',
      amount: 100,
      rate_id: 'rate-123',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'to')).toBe(true);
  });

  it('should fail when amount is less than 0.01', async () => {
    const dto = plainToInstance(ExchangeFiatWalletDto, {
      from: 'USD',
      to: 'NGN',
      amount: 0.001,
      rate_id: 'rate-123',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'amount')).toBe(true);
  });

  it('should fail when amount has more than 2 decimal places', async () => {
    const dto = plainToInstance(ExchangeFiatWalletDto, {
      from: 'USD',
      to: 'NGN',
      amount: 100.123,
      rate_id: 'rate-123',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'amount')).toBe(true);
  });

  it('should fail when amount is empty', async () => {
    const dto = plainToInstance(ExchangeFiatWalletDto, {
      from: 'USD',
      to: 'NGN',
      rate_id: 'rate-123',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'amount')).toBe(true);
  });

  it('should fail when rate_id is empty', async () => {
    const dto = plainToInstance(ExchangeFiatWalletDto, {
      from: 'USD',
      to: 'NGN',
      amount: 100,
      rate_id: '',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'rate_id')).toBe(true);
  });

  it('should fail when rate_id is missing', async () => {
    const dto = plainToInstance(ExchangeFiatWalletDto, {
      from: 'USD',
      to: 'NGN',
      amount: 100,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'rate_id')).toBe(true);
  });

  it('should transform string amount to number', async () => {
    const dto = plainToInstance(ExchangeFiatWalletDto, {
      from: 'USD',
      to: 'NGN',
      amount: '150.25',
      rate_id: 'rate-123',
    });

    expect(typeof dto.amount).toBe('number');
    expect(dto.amount).toBe(150.25);
  });

  it('should allow transaction_id to be undefined', async () => {
    const dto = plainToInstance(ExchangeFiatWalletDto, {
      from: 'USD',
      to: 'NGN',
      amount: 100,
      rate_id: 'rate-123',
    });

    expect(dto.transaction_id).toBeUndefined();
  });

  it('should accept transaction_id as string', async () => {
    const dto = plainToInstance(ExchangeFiatWalletDto, {
      from: 'USD',
      to: 'NGN',
      amount: 100,
      rate_id: 'rate-123',
      transaction_id: 'transaction-abc-123',
    });

    expect(dto.transaction_id).toBe('transaction-abc-123');
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});
