import { HttpStatus, InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WaasAdapter } from '../../adapters/waas/waas.adapter';
import { BankModel } from '../../database/models/bank';
import { AppLoggerService } from '../../services/logger/logger.service';
import { RedisCacheService } from '../../services/redis/redis-cache.service';
import { CountryRepository } from '../country/country.repository';
import { BankController } from './bank.controller';
import { BankRepository } from './bank.repository';
import { BankService } from './bank.service';
import { BankQueryDto } from './dtos/bankQuery.dto';
import { VerifyBankAccountDto } from './dtos/verifyBankAccount.dto';

const mockBank = {
  id: 'bank-1',
  name: 'Access Bank',
  code: '044',
  country_id: 'cma6yivgg0002w5micmvagf84',
  logo: 'https://example.com/logo.png',
  status: 'active',
  short_name: 'ACCESS',
} as BankModel;

const mockBanks = [
  mockBank,
  {
    id: 'bank-2',
    name: 'GTB Bank',
    code: '058',
    country_id: 'cma6yivgg0002w5micmvagf84',
    logo: 'https://example.com/gtb-logo.png',
    status: 'active',
    short_name: 'GTB',
  } as BankModel,
];

const mockVerifyBankAccountResponse = {
  accountName: 'John Doe',
  accountNumber: '1234567890',
  bankName: 'Access Bank',
  bankCode: '044',
  bvn: '12345678901',
};

describe('BankService', () => {
  let service: BankService;

  const mockBankRepository = {
    query: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockResolvedValue(mockBanks),
    })),
  };

  const mockWaasAdapterBankList = [
    {
      bankRef: 'bank-1',
      bankName: 'Access Bank',
      nibssBankCode: '044',
    },
    {
      bankRef: 'bank-2',
      bankName: 'GTB Bank',
      nibssBankCode: '058',
    },
  ];

  const mockWaasAdapter = {
    verifyBankAccount: jest.fn(),
    getBankList: jest.fn(),
  };

  const mockCountryRepository = {
    findOne: jest.fn().mockResolvedValue({
      id: 'cma6yivgg0002w5micmvagf84',
      code: 'NG',
      name: 'Nigeria',
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockCountryRepository.findOne.mockResolvedValue({
      id: 'cma6yivgg0002w5micmvagf84',
      code: 'NG',
      name: 'Nigeria',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BankService,
        { provide: BankRepository, useValue: mockBankRepository },
        { provide: WaasAdapter, useValue: mockWaasAdapter },
        { provide: CountryRepository, useValue: mockCountryRepository },
      ],
    }).compile();

    service = module.get<BankService>(BankService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all banks from WAAS adapter', async () => {
      const query: BankQueryDto = { countryCode: 'NG' };
      mockWaasAdapter.getBankList.mockResolvedValue(mockWaasAdapterBankList);

      const result = await service.findAll(query);

      expect(mockCountryRepository.findOne).toHaveBeenCalledWith({ code: 'NG' });
      expect(mockWaasAdapter.getBankList).toHaveBeenCalledWith({
        country: 'NG',
      });
      expect(result).toEqual([
        {
          id: 'bank-1',
          name: 'Access Bank',
          code: '044',
          country_id: 'cma6yivgg0002w5micmvagf84',
          logo: '',
          status: 'active',
          short_name: 'Access Bank',
        },
        {
          id: 'bank-2',
          name: 'GTB Bank',
          code: '058',
          country_id: 'cma6yivgg0002w5micmvagf84',
          logo: '',
          status: 'active',
          short_name: 'GTB Bank',
        },
      ]);
    });

    it('should sort banks alphabetically by name', async () => {
      const query: BankQueryDto = { countryCode: 'NG' };
      const unsortedBanks = [
        {
          bankRef: 'bank-3',
          bankName: 'Zenith Bank',
          nibssBankCode: '057',
        },
        {
          bankRef: 'bank-1',
          bankName: 'Access Bank',
          nibssBankCode: '044',
        },
      ];
      mockWaasAdapter.getBankList.mockResolvedValue(unsortedBanks);

      const result = await service.findAll(query);

      expect(result[0].name).toBe('Access Bank');
      expect(result[1].name).toBe('Zenith Bank');
    });

    it('should convert country code to uppercase', async () => {
      const query: BankQueryDto = { countryCode: 'ng' };
      mockWaasAdapter.getBankList.mockResolvedValue(mockWaasAdapterBankList);

      await service.findAll(query);

      expect(mockCountryRepository.findOne).toHaveBeenCalledWith({ code: 'NG' });
      expect(mockWaasAdapter.getBankList).toHaveBeenCalledWith({
        country: 'NG',
      });
    });

    it('should throw InternalServerErrorException when country is not found', async () => {
      const query: BankQueryDto = { countryCode: 'XX' };
      mockCountryRepository.findOne.mockResolvedValue(null);

      await expect(service.findAll(query)).rejects.toThrow(InternalServerErrorException);
      await expect(service.findAll(query)).rejects.toThrow('Country not found');
    });

    it('should throw InternalServerErrorException when WAAS adapter fails', async () => {
      const query: BankQueryDto = { countryCode: 'NG' };
      const error = new Error('WAAS service unavailable');
      mockWaasAdapter.getBankList.mockRejectedValue(error);

      await expect(service.findAll(query)).rejects.toThrow(InternalServerErrorException);
      await expect(service.findAll(query)).rejects.toThrow('WAAS service unavailable');
    });

    it('should map WAAS adapter response correctly to IBank format', async () => {
      const query: BankQueryDto = { countryCode: 'NG' };
      const waasResponse = [
        {
          bankRef: 'test-bank-ref',
          bankName: 'Test Bank',
          nibssBankCode: '999',
        },
      ];
      mockWaasAdapter.getBankList.mockResolvedValue(waasResponse);

      const result = await service.findAll(query);

      expect(result).toEqual([
        {
          id: 'test-bank-ref',
          name: 'Test Bank',
          code: '999',
          country_id: 'cma6yivgg0002w5micmvagf84',
          logo: '',
          status: 'active',
          short_name: 'Test Bank',
        },
      ]);
    });
  });

  describe('verifyBankAccount', () => {
    const verifyPayload: VerifyBankAccountDto = {
      account_number: '1234567890',
      bank_ref: 'gtbank-uuid',
      country_code: 'NG',
    };

    it('should verify bank account successfully for NG country', async () => {
      mockWaasAdapter.verifyBankAccount.mockResolvedValue(mockVerifyBankAccountResponse);

      const result = await service.verifyBankAccount(verifyPayload);

      expect(mockCountryRepository.findOne).toHaveBeenCalledWith({ code: 'NG' });
      expect(mockWaasAdapter.verifyBankAccount).toHaveBeenCalledWith({
        accountNumber: '1234567890',
        bankRef: 'gtbank-uuid',
        amount: '1',
      });
      expect(result).toEqual(mockVerifyBankAccountResponse);
    });

    it('should convert country code to uppercase before validation', async () => {
      const lowerCasePayload: VerifyBankAccountDto = {
        account_number: '1234567890',
        bank_ref: 'gtbank-uuid',
        country_code: 'ng',
      };
      mockWaasAdapter.verifyBankAccount.mockResolvedValue(mockVerifyBankAccountResponse);

      await service.verifyBankAccount(lowerCasePayload);

      expect(mockCountryRepository.findOne).toHaveBeenCalledWith({ code: 'NG' });
    });

    it('should throw InternalServerErrorException when country is not found', async () => {
      mockCountryRepository.findOne.mockResolvedValue(null);

      await expect(service.verifyBankAccount(verifyPayload)).rejects.toThrow(InternalServerErrorException);
      await expect(service.verifyBankAccount(verifyPayload)).rejects.toThrow('Account Number is invalid');
    });

    it('should throw InternalServerErrorException for unsupported countries', async () => {
      const unsupportedCountryPayload: VerifyBankAccountDto = {
        account_number: '1234567890',
        bank_ref: 'gtbank-uuid',
        country_code: 'US',
      };
      mockCountryRepository.findOne.mockResolvedValue({
        id: 'country-us',
        code: 'US',
        name: 'United States',
      });

      await expect(service.verifyBankAccount(unsupportedCountryPayload)).rejects.toThrow(InternalServerErrorException);
      await expect(service.verifyBankAccount(unsupportedCountryPayload)).rejects.toThrow('Account Number is invalid');
    });

    it('should throw InternalServerErrorException when WAAS adapter fails', async () => {
      const error = new Error('External service unavailable');
      mockWaasAdapter.verifyBankAccount.mockRejectedValue(error);

      await expect(service.verifyBankAccount(verifyPayload)).rejects.toThrow(InternalServerErrorException);
      await expect(service.verifyBankAccount(verifyPayload)).rejects.toThrow('Account Number is invalid');
    });

    it('should map payload correctly to WAAS adapter format', async () => {
      mockWaasAdapter.verifyBankAccount.mockResolvedValue(mockVerifyBankAccountResponse);

      await service.verifyBankAccount(verifyPayload);

      expect(mockWaasAdapter.verifyBankAccount).toHaveBeenCalledWith({
        accountNumber: verifyPayload.account_number,
        bankRef: verifyPayload.bank_ref,
        amount: '1',
      });
    });
  });
});

describe('BankController', () => {
  let controller: BankController;

  const mockBankService = {
    findAll: jest.fn(),
    verifyBankAccount: jest.fn(),
  };

  const mockWaasAdapter = {
    verifyBankAccount: jest.fn(),
  };

  const mockAppLoggerService = {
    logInfo: jest.fn(),
    logError: jest.fn(),
    logUserAction: jest.fn(),
    setContext: jest.fn(),
    createChild: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };

  const mockRedisCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BankController],
      providers: [
        { provide: BankService, useValue: mockBankService },
        { provide: WaasAdapter, useValue: mockWaasAdapter },
        { provide: AppLoggerService, useValue: mockAppLoggerService },
        { provide: RedisCacheService, useValue: mockRedisCacheService },
      ],
    }).compile();

    controller = module.get<BankController>(BankController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return Nigerian banks with success response', async () => {
      const query: BankQueryDto = {};
      mockBankService.findAll.mockResolvedValue(mockBanks);

      const result = await controller.findAll(query);

      expect(mockBankService.findAll).toHaveBeenCalledWith(query);
      expect(result).toMatchObject({
        message: 'Banks fetched successfully',
        data: mockBanks,
        statusCode: HttpStatus.OK,
      });
    });

    it('should pass query parameters to service', async () => {
      const query: BankQueryDto = { name: 'Access' };
      mockBankService.findAll.mockResolvedValue([mockBank]);

      const result = await controller.findAll(query);

      expect(mockBankService.findAll).toHaveBeenCalledWith(query);
      expect(result).toMatchObject({
        message: 'Banks fetched successfully',
        data: [mockBank],
        statusCode: HttpStatus.OK,
      });
    });

    it('should handle empty query parameters', async () => {
      const query: BankQueryDto = {};
      mockBankService.findAll.mockResolvedValue(mockBanks);

      const result = await controller.findAll(query);

      expect(mockBankService.findAll).toHaveBeenCalledWith(query);
      expect(result).toMatchObject({
        message: 'Banks fetched successfully',
        data: mockBanks,
        statusCode: HttpStatus.OK,
      });
    });

    it('should handle service errors', async () => {
      const query: BankQueryDto = {};
      const error = new InternalServerErrorException('Service error');
      mockBankService.findAll.mockRejectedValue(error);

      await expect(controller.findAll(query)).rejects.toThrow(InternalServerErrorException);
      await expect(controller.findAll(query)).rejects.toThrow('Service error');
    });
  });

  describe('verifyBankAccount', () => {
    const verifyPayload: VerifyBankAccountDto = {
      account_number: '1234567890',
      bank_ref: 'gtbank-uuid',
      country_code: 'NG',
    };

    it('should verify bank account and return success response', async () => {
      mockBankService.verifyBankAccount.mockResolvedValue(mockVerifyBankAccountResponse);

      const result = await controller.verifyBankAccount(verifyPayload);

      expect(mockBankService.verifyBankAccount).toHaveBeenCalledWith(verifyPayload);
      expect(result).toMatchObject({
        message: 'Bank account verified successfully',
        data: mockVerifyBankAccountResponse,
        statusCode: HttpStatus.OK,
      });
    });

    it('should pass verification payload to service', async () => {
      const customPayload: VerifyBankAccountDto = {
        account_number: '9876543210',
        bank_ref: 'gtbank-uuid',
        country_code: 'NG',
      };
      const customResponse = {
        ...mockVerifyBankAccountResponse,
        accountNumber: '9876543210',
        bankRef: 'gtbank-uuid',
      };
      mockBankService.verifyBankAccount.mockResolvedValue(customResponse);

      const result = await controller.verifyBankAccount(customPayload);

      expect(mockBankService.verifyBankAccount).toHaveBeenCalledWith(customPayload);
      expect(result).toMatchObject({
        message: 'Bank account verified successfully',
        data: customResponse,
        statusCode: HttpStatus.OK,
      });
    });

    it('should handle service errors during verification', async () => {
      const error = new InternalServerErrorException('Verification failed');
      mockBankService.verifyBankAccount.mockRejectedValue(error);

      await expect(controller.verifyBankAccount(verifyPayload)).rejects.toThrow(InternalServerErrorException);
      await expect(controller.verifyBankAccount(verifyPayload)).rejects.toThrow('Verification failed');
    });

    it('should handle invalid account details', async () => {
      const invalidPayload: VerifyBankAccountDto = {
        account_number: 'invalid',
        bank_ref: 'invalid',
        country_code: 'NG',
      };
      const error = new InternalServerErrorException('Invalid account details');
      mockBankService.verifyBankAccount.mockRejectedValue(error);

      await expect(controller.verifyBankAccount(invalidPayload)).rejects.toThrow(InternalServerErrorException);
      await expect(controller.verifyBankAccount(invalidPayload)).rejects.toThrow('Invalid account details');
    });
  });
});
