jest.mock('../../config/environment', () => ({
  EnvironmentService: {
    getValue: jest.fn(),
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

jest.mock('../../database/database.connection', () => ({
  KnexDB: {
    connection: jest.fn(() => ({
      raw: jest.fn(),
      destroy: jest.fn(),
    })),
  },
}));

import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ExchangeAdapter } from '../../adapters/exchange/exchange.adapter';
import { SUPPORTED_CURRENCIES } from '../../currencies';
import { PlatformServiceKey } from '../../database/models/platformStatus/platformStatus.interface';
import { EventEmitterEventsEnum } from '../../services/eventEmitter/eventEmitter.interface';
import { EventEmitterService } from '../../services/eventEmitter/eventEmitter.service';
import { RateConfigRepository } from '../rateConfig/rateConfig.repository';
import { RateRepository } from './rate.repository';
import { RateService } from './rate.service';

describe('RateService', () => {
  let service: RateService;
  let exchangeAdapter: jest.Mocked<ExchangeAdapter>;
  let rateRepository: jest.Mocked<RateRepository>;
  let rateConfigRepository: jest.Mocked<RateConfigRepository>;
  let eventEmitterService: jest.Mocked<EventEmitterService>;

  const mockExchangeRates = [
    {
      code: 'NGN',
      buy: 1650.5,
      sell: 1600,
      rateRef: 'rate-ref-123',
    },
  ];

  const mockRateConfig = {
    id: 'rate-config-1',
    provider: 'yellowcard',
    description: null,
    config: {
      fiat_exchange: {
        service_fee: { value: 0, currency: null, is_percentage: false },
        partner_fee: { value: 2, currency: null, is_percentage: true },
        disbursement_fee: { value: 0, currency: null, is_percentage: false },
        ngn_withdrawal_fee: { value: 0, is_percentage: false, cap: 0 },
      },
      is_active: true,
    },
    get isActive() {
      return this.config?.is_active ?? false;
    },
    get fiatExchange() {
      return this.config?.fiat_exchange;
    },
  };

  const mockExchangeRate = {
    id: 'exchange-rate-1',
    provider: 'yellowcard',
    buying_currency_code: 'NGN',
    selling_currency_code: 'USD',
    rate: 160000,
    provider_rate: 160000,
    provider_rate_ref: 'rate-ref-123',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateService,
        {
          provide: ExchangeAdapter,
          useValue: {
            getExchangeRates: jest.fn(),
            getProviderName: jest.fn().mockReturnValue('yellowcard'),
          },
        },
        {
          provide: RateRepository,
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: RateConfigRepository,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: EventEmitterService,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RateService>(RateService);
    exchangeAdapter = module.get<jest.Mocked<ExchangeAdapter>>(ExchangeAdapter);
    rateRepository = module.get<jest.Mocked<RateRepository>>(RateRepository);
    rateConfigRepository = module.get<jest.Mocked<RateConfigRepository>>(RateConfigRepository);
    eventEmitterService = module.get<jest.Mocked<EventEmitterService>>(EventEmitterService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('getRate', () => {
    it('should return existing exchange rate from database', async () => {
      rateConfigRepository.findOne.mockResolvedValue(mockRateConfig as any);
      exchangeAdapter.getExchangeRates.mockResolvedValue(mockExchangeRates as any);
      rateRepository.findOne.mockResolvedValue(mockExchangeRate as any);

      const result = await service.getRate('NGN', 100);

      // Result includes exchangeRate and rateConfig merged with rate remapped
      expect(result).toMatchObject({
        id: 'exchange-rate-1',
        provider: 'yellowcard',
        buying_currency_code: 'NGN',
        selling_currency_code: 'USD',
        partner_fee: 2,
        is_partner_fee_percentage: true,
        is_active: true,
        incrementedRate: 160000,
        rate: 160000,
      });
      expect(exchangeAdapter.getExchangeRates).toHaveBeenCalledWith({ currencyCode: 'NGN' });
      expect(rateRepository.findOne).toHaveBeenCalledWith({
        buying_currency_code: 'NGN',
        selling_currency_code: SUPPORTED_CURRENCIES.USD.code,
        provider: 'yellowcard',
        provider_rate: 160000,
        rate: 160000,
      });
    });

    it('should create new exchange rate if not found in database', async () => {
      const newExchangeRate = {
        id: 'exchange-rate-1',
        provider: 'yellowcard',
        buying_currency_code: 'NGN',
        selling_currency_code: 'USD',
        rate: 160000,
        provider_rate: 160000,
        provider_rate_ref: 'rate-ref-123',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };
      rateConfigRepository.findOne.mockResolvedValue(mockRateConfig as any);
      exchangeAdapter.getExchangeRates.mockResolvedValue(mockExchangeRates as any);
      rateRepository.findOne.mockResolvedValue(null);
      rateRepository.create.mockResolvedValue(newExchangeRate as any);

      const result = await service.getRate('NGN', 100);

      // Result includes exchangeRate and rateConfig merged with rate remapped
      expect(result).toMatchObject({
        id: 'exchange-rate-1',
        provider: 'yellowcard',
        buying_currency_code: 'NGN',
        selling_currency_code: 'USD',
        partner_fee: 2,
        is_partner_fee_percentage: true,
        is_active: true,
        incrementedRate: 160000,
        rate: 160000,
      });
      expect(rateRepository.create).toHaveBeenCalledWith({
        provider: 'yellowcard',
        buying_currency_code: 'NGN',
        selling_currency_code: SUPPORTED_CURRENCIES.USD.code,
        provider_rate: 160000,
        provider_rate_ref: 'rate-ref-123',
        rate: 160000,
      });
    });

    it('should throw BadRequestException if no rate found for currency', async () => {
      rateConfigRepository.findOne.mockResolvedValue(mockRateConfig as any);
      exchangeAdapter.getExchangeRates.mockResolvedValue(mockExchangeRates as any);

      await expect(service.getRate('USD', 100)).rejects.toThrow(BadRequestException);
      await expect(service.getRate('USD', 100)).rejects.toThrow('No exchange rate found for currency');
    });

    it('should throw BadRequestException if exchange rates array is empty', async () => {
      rateConfigRepository.findOne.mockResolvedValue(mockRateConfig as any);
      exchangeAdapter.getExchangeRates.mockResolvedValue([]);

      await expect(service.getRate('NGN', 100)).rejects.toThrow(BadRequestException);
      await expect(service.getRate('NGN', 100)).rejects.toThrow('No exchange rate found for currency');
    });

    it('should convert rate to smallest unit correctly', async () => {
      rateConfigRepository.findOne.mockResolvedValue(mockRateConfig as any);
      exchangeAdapter.getExchangeRates.mockResolvedValue(mockExchangeRates as any);
      rateRepository.findOne.mockResolvedValue(null);
      rateRepository.create.mockResolvedValue(mockExchangeRate as any);

      await service.getRate('NGN', 100);

      expect(rateRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          rate: 160000,
        }),
      );
    });

    it('should use correct provider name', async () => {
      rateConfigRepository.findOne.mockResolvedValue(mockRateConfig as any);
      exchangeAdapter.getExchangeRates.mockResolvedValue(mockExchangeRates as any);
      rateRepository.findOne.mockResolvedValue(null);
      rateRepository.create.mockResolvedValue(mockExchangeRate as any);

      await service.getRate('NGN', 100);

      expect(rateRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'yellowcard',
        }),
      );
    });

    it('should use NGN as buying currency and USD as selling currency for BUY type', async () => {
      rateConfigRepository.findOne.mockResolvedValue(mockRateConfig as any);
      exchangeAdapter.getExchangeRates.mockResolvedValue(mockExchangeRates as any);
      rateRepository.findOne.mockResolvedValue(null);
      rateRepository.create.mockResolvedValue(mockExchangeRate as any);

      await service.getRate('NGN', 100);

      expect(rateRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          buying_currency_code: 'NGN',
          selling_currency_code: SUPPORTED_CURRENCIES.USD.code,
        }),
      );
    });

    it('should handle different rate values for same currency', async () => {
      const differentRate = {
        code: 'NGN',
        buy: 1700.25,
        sell: 1650,
        rateRef: 'rate-ref-456',
      };
      rateConfigRepository.findOne.mockResolvedValue(mockRateConfig as any);
      exchangeAdapter.getExchangeRates.mockResolvedValue([differentRate] as any);
      rateRepository.findOne.mockResolvedValue(null);
      rateRepository.create.mockResolvedValue({
        ...mockExchangeRate,
        rate: 165000,
        provider_rate: 165000,
        provider_rate_ref: 'rate-ref-456',
      } as any);

      const result = await service.getRate('NGN', 100);

      expect(result.selling_currency_code).toBe('USD');
      expect(rateRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          buying_currency_code: 'NGN',
          selling_currency_code: 'USD',
          provider_rate: 165000,
          rate: 165000,
          provider_rate_ref: 'rate-ref-456',
        }),
      );
    });

    it('should store provider rate ref correctly', async () => {
      rateConfigRepository.findOne.mockResolvedValue(mockRateConfig as any);
      exchangeAdapter.getExchangeRates.mockResolvedValue(mockExchangeRates as any);
      rateRepository.findOne.mockResolvedValue(null);
      rateRepository.create.mockResolvedValue(mockExchangeRate as any);

      await service.getRate('NGN', 100);

      expect(rateRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          provider_rate_ref: 'rate-ref-123',
        }),
      );
    });

    it('should handle adapter errors gracefully', async () => {
      rateConfigRepository.findOne.mockResolvedValue(mockRateConfig as any);
      exchangeAdapter.getExchangeRates.mockRejectedValue(new Error('API Error'));

      await expect(service.getRate('NGN', 100)).rejects.toThrow('API Error');
      expect(rateRepository.findOne).not.toHaveBeenCalled();
      expect(rateRepository.create).not.toHaveBeenCalled();
    });

    it('should handle repository errors gracefully', async () => {
      rateConfigRepository.findOne.mockResolvedValue(mockRateConfig as any);
      exchangeAdapter.getExchangeRates.mockResolvedValue(mockExchangeRates as any);
      rateRepository.findOne.mockRejectedValue(new Error('Database Error'));

      await expect(service.getRate('NGN', 100)).rejects.toThrow('Database Error');
    });

    it('should use USD as buying currency and NGN as selling for SELL type', async () => {
      const RateTransactionType = { BUY: 'buy', SELL: 'sell' };
      rateConfigRepository.findOne.mockResolvedValue(mockRateConfig as any);
      exchangeAdapter.getExchangeRates.mockResolvedValue(mockExchangeRates as any);
      rateRepository.findOne.mockResolvedValue(null);
      rateRepository.create.mockResolvedValue({
        ...mockExchangeRate,
        buying_currency_code: 'USD',
        selling_currency_code: 'NGN',
        provider_rate: 165050,
        rate: 165050,
      } as any);

      await service.getRate('NGN', 100, RateTransactionType.SELL as any);

      expect(rateRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          buying_currency_code: SUPPORTED_CURRENCIES.USD.code,
          selling_currency_code: 'NGN',
          provider_rate: 165050,
          rate: 165050,
        }),
      );
    });

    it('should use buy rate for SELL transaction type', async () => {
      const RateTransactionType = { BUY: 'buy', SELL: 'sell' };
      rateConfigRepository.findOne.mockResolvedValue(mockRateConfig as any);
      exchangeAdapter.getExchangeRates.mockResolvedValue(mockExchangeRates as any);
      rateRepository.findOne.mockResolvedValue(null);
      rateRepository.create.mockResolvedValue({
        ...mockExchangeRate,
        buying_currency_code: 'USD',
        selling_currency_code: 'NGN',
        provider_rate: 165050,
        rate: 165050,
      } as any);

      await service.getRate('NGN', 100, RateTransactionType.SELL as any);

      expect(rateRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          provider_rate: 165050,
        }),
      );
    });

    it('should use sell rate for BUY transaction type', async () => {
      const RateTransactionType = { BUY: 'buy', SELL: 'sell' };
      rateConfigRepository.findOne.mockResolvedValue(mockRateConfig as any);
      exchangeAdapter.getExchangeRates.mockResolvedValue(mockExchangeRates as any);
      rateRepository.findOne.mockResolvedValue(null);
      rateRepository.create.mockResolvedValue(mockExchangeRate as any);

      await service.getRate('NGN', 100, RateTransactionType.BUY as any);

      expect(rateRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          provider_rate: 160000,
        }),
      );
    });

    it('should handle case-insensitive transaction type', async () => {
      const RateTransactionType = { BUY: 'BUY', SELL: 'SELL' };
      rateConfigRepository.findOne.mockResolvedValue(mockRateConfig as any);
      exchangeAdapter.getExchangeRates.mockResolvedValue(mockExchangeRates as any);
      rateRepository.findOne.mockResolvedValue(null);
      rateRepository.create.mockResolvedValue(mockExchangeRate as any);

      await service.getRate('NGN', 100, RateTransactionType.BUY as any);

      expect(rateRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          buying_currency_code: 'NGN',
          selling_currency_code: 'USD',
        }),
      );
    });

    it('should return existing rate instead of creating duplicate', async () => {
      const existingRate = {
        id: 'existing-rate-123',
        provider: 'yellowcard',
        buying_currency_code: 'NGN',
        selling_currency_code: 'USD',
        rate: 160000,
        provider_rate: 160000,
        provider_rate_ref: 'rate-ref-123',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };
      rateConfigRepository.findOne.mockResolvedValue(mockRateConfig as any);
      exchangeAdapter.getExchangeRates.mockResolvedValue(mockExchangeRates as any);
      rateRepository.findOne.mockResolvedValue(existingRate as any);

      const result = await service.getRate('NGN', 100);

      // Result includes exchangeRate and rateConfig merged with rate remapped
      expect(result).toMatchObject({
        id: 'existing-rate-123',
        provider: 'yellowcard',
        buying_currency_code: 'NGN',
        selling_currency_code: 'USD',
        partner_fee: 2,
        is_partner_fee_percentage: true,
        is_active: true,
        incrementedRate: 160000,
        rate: 160000,
      });
      expect(rateRepository.create).not.toHaveBeenCalled();
    });

    it('should handle multiple exchange rates in response', async () => {
      const multipleRates = [
        {
          code: 'NGN',
          buy: 1650.5,
          sell: 1600,
          rateRef: 'rate-ref-123',
        },
        {
          code: 'EUR',
          buy: 1.1,
          sell: 1.05,
          rateRef: 'rate-ref-456',
        },
      ];
      const newExchangeRate = {
        id: 'exchange-rate-1',
        provider: 'yellowcard',
        buying_currency_code: 'NGN',
        selling_currency_code: 'USD',
        rate: 160000,
        provider_rate: 160000,
        provider_rate_ref: 'rate-ref-123',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };
      rateConfigRepository.findOne.mockResolvedValue(mockRateConfig as any);
      exchangeAdapter.getExchangeRates.mockResolvedValue(multipleRates as any);
      rateRepository.findOne.mockResolvedValue(null);
      rateRepository.create.mockResolvedValue(newExchangeRate as any);

      const result = await service.getRate('NGN', 100);

      // Result includes exchangeRate and rateConfig merged with rate remapped
      expect(result).toMatchObject({
        id: 'exchange-rate-1',
        provider: 'yellowcard',
        buying_currency_code: 'NGN',
        selling_currency_code: 'USD',
        partner_fee: 2,
        is_partner_fee_percentage: true,
        is_active: true,
        incrementedRate: 160000,
        rate: 160000,
      });
      expect(rateRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          buying_currency_code: 'NGN',
          provider_rate: 160000,
          rate: 160000,
        }),
      );
    });

    it('should handle rates with decimal values correctly', async () => {
      const decimalRates = [
        {
          code: 'NGN',
          buy: 1650.75,
          sell: 1600.25,
          rateRef: 'rate-ref-decimal',
        },
      ];
      rateConfigRepository.findOne.mockResolvedValue(mockRateConfig as any);
      exchangeAdapter.getExchangeRates.mockResolvedValue(decimalRates as any);
      rateRepository.findOne.mockResolvedValue(null);
      rateRepository.create.mockResolvedValue({
        ...mockExchangeRate,
        provider_rate: 160025,
        rate: 160025,
      } as any);

      await service.getRate('NGN', 100);

      expect(rateRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          provider_rate: 160025,
          rate: 160025,
        }),
      );
    });

    it('should correctly match rate with all required fields', async () => {
      rateConfigRepository.findOne.mockResolvedValue(mockRateConfig as any);
      exchangeAdapter.getExchangeRates.mockResolvedValue(mockExchangeRates as any);
      rateRepository.findOne.mockResolvedValue(null);
      rateRepository.create.mockResolvedValue(mockExchangeRate as any);

      await service.getRate('NGN', 100);

      expect(rateRepository.findOne).toHaveBeenCalledWith({
        buying_currency_code: 'NGN',
        selling_currency_code: 'USD',
        provider: 'yellowcard',
        provider_rate: 160000,
        rate: 160000,
      });
    });

    it('should emit SERVICE_STATUS_SUCCESS event on successful rate retrieval', async () => {
      rateConfigRepository.findOne.mockResolvedValue(mockRateConfig as any);
      exchangeAdapter.getExchangeRates.mockResolvedValue(mockExchangeRates as any);
      rateRepository.findOne.mockResolvedValue(mockExchangeRate as any);

      await service.getRate('NGN', 100);

      expect(eventEmitterService.emit).toHaveBeenCalledWith(EventEmitterEventsEnum.SERVICE_STATUS_SUCCESS, {
        serviceKey: PlatformServiceKey.RATE_GENERATION,
      });
    });

    it('should emit SERVICE_STATUS_FAILURE event when exchange adapter throws error', async () => {
      const error = new Error('API Error');
      rateConfigRepository.findOne.mockResolvedValue(mockRateConfig as any);
      exchangeAdapter.getExchangeRates.mockRejectedValue(error);

      await expect(service.getRate('NGN', 100)).rejects.toThrow('API Error');

      expect(eventEmitterService.emit).toHaveBeenCalledWith(EventEmitterEventsEnum.SERVICE_STATUS_FAILURE, {
        serviceKey: PlatformServiceKey.RATE_GENERATION,
        reason: 'API Error',
      });
    });

    it('should not emit SERVICE_STATUS_SUCCESS when exchange adapter fails', async () => {
      rateConfigRepository.findOne.mockResolvedValue(mockRateConfig as any);
      exchangeAdapter.getExchangeRates.mockRejectedValue(new Error('API Error'));

      await expect(service.getRate('NGN', 100)).rejects.toThrow();

      expect(eventEmitterService.emit).not.toHaveBeenCalledWith(
        EventEmitterEventsEnum.SERVICE_STATUS_SUCCESS,
        expect.anything(),
      );
    });

    it('should store rate equal to provider rate', async () => {
      const providerSellRate = 1600;
      const expectedProviderRateInSmallestUnit = 160000;

      rateConfigRepository.findOne.mockResolvedValue(mockRateConfig as any);
      exchangeAdapter.getExchangeRates.mockResolvedValue([
        { code: 'NGN', buy: 1650.5, sell: providerSellRate, rateRef: 'rate-ref-123' },
      ] as any);
      rateRepository.findOne.mockResolvedValue(null);
      rateRepository.create.mockResolvedValue({
        ...mockExchangeRate,
        provider_rate: expectedProviderRateInSmallestUnit,
        rate: expectedProviderRateInSmallestUnit,
      } as any);

      await service.getRate('NGN', 100);

      expect(rateRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          provider_rate: expectedProviderRateInSmallestUnit,
          rate: expectedProviderRateInSmallestUnit,
        }),
      );
    });

    it('should store provider_rate and rate with same values', async () => {
      rateConfigRepository.findOne.mockResolvedValue(mockRateConfig as any);
      exchangeAdapter.getExchangeRates.mockResolvedValue(mockExchangeRates as any);
      rateRepository.findOne.mockResolvedValue(null);
      rateRepository.create.mockResolvedValue(mockExchangeRate as any);

      await service.getRate('NGN', 100);

      const createCall = rateRepository.create.mock.calls[0][0];
      expect(createCall.provider_rate).toBeDefined();
      expect(createCall.rate).toBeDefined();
      expect(createCall.rate).toEqual(createCall.provider_rate);
    });

    it('should emit success event even when returning existing rate', async () => {
      rateConfigRepository.findOne.mockResolvedValue(mockRateConfig as any);
      exchangeAdapter.getExchangeRates.mockResolvedValue(mockExchangeRates as any);
      rateRepository.findOne.mockResolvedValue(mockExchangeRate as any);

      await service.getRate('NGN', 100);

      expect(eventEmitterService.emit).toHaveBeenCalledWith(EventEmitterEventsEnum.SERVICE_STATUS_SUCCESS, {
        serviceKey: PlatformServiceKey.RATE_GENERATION,
      });
      expect(rateRepository.create).not.toHaveBeenCalled();
    });

    it('should use provider_rate in findOne query to match existing rates', async () => {
      rateConfigRepository.findOne.mockResolvedValue(mockRateConfig as any);
      exchangeAdapter.getExchangeRates.mockResolvedValue(mockExchangeRates as any);
      rateRepository.findOne.mockResolvedValue(mockExchangeRate as any);

      await service.getRate('NGN', 100);

      expect(rateRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          provider_rate: expect.any(Number),
          rate: expect.any(Number),
        }),
      );
    });

    it('should store rate equal to provider rate for different provider rates', async () => {
      const testCases = [
        { sell: 1500, expectedProviderRate: 150000 },
        { sell: 2000, expectedProviderRate: 200000 },
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();
        rateConfigRepository.findOne.mockResolvedValue(mockRateConfig as any);
        exchangeAdapter.getExchangeRates.mockResolvedValue([
          { code: 'NGN', buy: 1700, sell: testCase.sell, rateRef: 'rate-ref-test' },
        ] as any);
        rateRepository.findOne.mockResolvedValue(null);
        rateRepository.create.mockResolvedValue({
          ...mockExchangeRate,
          provider_rate: testCase.expectedProviderRate,
          rate: testCase.expectedProviderRate,
        } as any);

        await service.getRate('NGN', 100);

        expect(rateRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            provider_rate: testCase.expectedProviderRate,
            rate: testCase.expectedProviderRate,
          }),
        );
      }
    });

    it('should use buy rate for SELL type', async () => {
      const RateTransactionType = { BUY: 'buy', SELL: 'sell' };
      const providerBuyRate = 1650.5;
      const expectedProviderRate = 165050;

      rateConfigRepository.findOne.mockResolvedValue(mockRateConfig as any);
      exchangeAdapter.getExchangeRates.mockResolvedValue([
        { code: 'NGN', buy: providerBuyRate, sell: 1600, rateRef: 'rate-ref-123' },
      ] as any);
      rateRepository.findOne.mockResolvedValue(null);
      rateRepository.create.mockResolvedValue({
        ...mockExchangeRate,
        buying_currency_code: 'USD',
        selling_currency_code: 'NGN',
        provider_rate: expectedProviderRate,
        rate: expectedProviderRate,
      } as any);

      await service.getRate('NGN', 100, RateTransactionType.SELL as any);

      expect(rateRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          provider_rate: expectedProviderRate,
          rate: expectedProviderRate,
        }),
      );
    });
  });

  describe('getRateInNGN', () => {
    it('should calculate rate correctly with fees', () => {
      const amount = 100;
      const ngnProviderRate = 1650;
      const usdProviderNetworkFee = 1.5;
      const usdProviderWithdrawalFee = 0.5;

      const result = service.getRateInNGN(amount, ngnProviderRate, usdProviderNetworkFee, usdProviderWithdrawalFee);

      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(ngnProviderRate);
    });

    it('should calculate rate with zero fees', () => {
      const amount = 100;
      const ngnProviderRate = 1650;
      const usdProviderNetworkFee = 0;
      const usdProviderWithdrawalFee = 0;

      const result = service.getRateInNGN(amount, ngnProviderRate, usdProviderNetworkFee, usdProviderWithdrawalFee);

      expect(result).toBe(ngnProviderRate);
    });

    it('should deduct fees from amount before conversion', () => {
      const amount = 100;
      const ngnProviderRate = 1650;
      const usdProviderNetworkFee = 1;
      const usdProviderWithdrawalFee = 1;

      const result = service.getRateInNGN(amount, ngnProviderRate, usdProviderNetworkFee, usdProviderWithdrawalFee);

      expect(result).toBeLessThanOrEqual(ngnProviderRate);
      expect(result).toBeGreaterThan(0);
    });

    it('should handle small amounts', () => {
      const amount = 1;
      const ngnProviderRate = 1650;
      const usdProviderNetworkFee = 0.1;
      const usdProviderWithdrawalFee = 0.1;

      const result = service.getRateInNGN(amount, ngnProviderRate, usdProviderNetworkFee, usdProviderWithdrawalFee);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(ngnProviderRate);
    });

    it('should handle large amounts', () => {
      const amount = 10000;
      const ngnProviderRate = 1650;
      const usdProviderNetworkFee = 1.5;
      const usdProviderWithdrawalFee = 0.5;

      const result = service.getRateInNGN(amount, ngnProviderRate, usdProviderNetworkFee, usdProviderWithdrawalFee);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(ngnProviderRate);
    });

    it('should return maximum of calculated rates', () => {
      const amount = 100;
      const ngnProviderRate = 1650;
      const usdProviderNetworkFee = 1;
      const usdProviderWithdrawalFee = 1;

      const result = service.getRateInNGN(amount, ngnProviderRate, usdProviderNetworkFee, usdProviderWithdrawalFee);

      expect(result).toBeGreaterThan(0);
    });

    it('should handle high fee percentage', () => {
      const amount = 100;
      const ngnProviderRate = 1650;
      const usdProviderNetworkFee = 5;
      const usdProviderWithdrawalFee = 5;

      const result = service.getRateInNGN(amount, ngnProviderRate, usdProviderNetworkFee, usdProviderWithdrawalFee);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(ngnProviderRate);
    });

    it('should handle low fee percentage', () => {
      const amount = 100;
      const ngnProviderRate = 1650;
      const usdProviderNetworkFee = 0.01;
      const usdProviderWithdrawalFee = 0.01;

      const result = service.getRateInNGN(amount, ngnProviderRate, usdProviderNetworkFee, usdProviderWithdrawalFee);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(ngnProviderRate);
      expect(result).toBeCloseTo(ngnProviderRate, 0);
    });

    it('should calculate consistent rate for same inputs', () => {
      const amount = 100;
      const ngnProviderRate = 1650;
      const usdProviderNetworkFee = 1.5;
      const usdProviderWithdrawalFee = 0.5;

      const result1 = service.getRateInNGN(amount, ngnProviderRate, usdProviderNetworkFee, usdProviderWithdrawalFee);
      const result2 = service.getRateInNGN(amount, ngnProviderRate, usdProviderNetworkFee, usdProviderWithdrawalFee);

      expect(result1).toBe(result2);
    });

    it('should properly combine network and withdrawal fees', () => {
      const amount = 100;
      const ngnProviderRate = 1650;
      const usdProviderNetworkFee = 1;
      const usdProviderWithdrawalFee = 1;

      const result = service.getRateInNGN(amount, ngnProviderRate, usdProviderNetworkFee, usdProviderWithdrawalFee);

      expect(result).toBeLessThanOrEqual(ngnProviderRate);
    });

    it('should handle decimal amounts correctly', () => {
      const amount = 99.99;
      const ngnProviderRate = 1650.5;
      const usdProviderNetworkFee = 1.25;
      const usdProviderWithdrawalFee = 0.75;

      const result = service.getRateInNGN(amount, ngnProviderRate, usdProviderNetworkFee, usdProviderWithdrawalFee);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(ngnProviderRate);
    });

    it('should handle different provider rates', () => {
      const amount = 100;
      const lowRate = 1500;
      const highRate = 1800;
      const usdProviderNetworkFee = 1;
      const usdProviderWithdrawalFee = 1;

      const resultLow = service.getRateInNGN(amount, lowRate, usdProviderNetworkFee, usdProviderWithdrawalFee);
      const resultHigh = service.getRateInNGN(amount, highRate, usdProviderNetworkFee, usdProviderWithdrawalFee);

      expect(resultLow).toBeLessThan(resultHigh);
    });

    it('should ensure rate is positive', () => {
      const amount = 10;
      const ngnProviderRate = 1650;
      const usdProviderNetworkFee = 0.5;
      const usdProviderWithdrawalFee = 0.5;

      const result = service.getRateInNGN(amount, ngnProviderRate, usdProviderNetworkFee, usdProviderWithdrawalFee);

      expect(result).toBeGreaterThan(0);
    });

    it('should handle edge case with minimal amount after fees', () => {
      const amount = 2.1;
      const ngnProviderRate = 1650;
      const usdProviderNetworkFee = 1;
      const usdProviderWithdrawalFee = 1;

      const result = service.getRateInNGN(amount, ngnProviderRate, usdProviderNetworkFee, usdProviderWithdrawalFee);

      expect(result).toBeGreaterThan(0);
    });
  });
});
