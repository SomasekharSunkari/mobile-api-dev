import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ExchangeAdapter } from '../../adapters/exchange/exchange.adapter';
import { SUPPORTED_CURRENCIES } from '../../currencies';
import { RateTransactionType } from '../../database';
import { EventEmitterService } from '../../services/eventEmitter/eventEmitter.service';
import { RateConfigRepository } from '../rateConfig/rateConfig.repository';
import { RateController } from './rate.controller';
import { RateRepository } from './rate.repository';
import { RateService } from './rate.service';

describe('RateController', () => {
  let controller: RateController;
  let rateService: jest.Mocked<RateService>;

  const mockRateService = {
    getRate: jest.fn(),
    getRateInNGN: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RateController],
      providers: [
        {
          provide: RateService,
          useValue: mockRateService,
        },
      ],
    }).compile();

    controller = module.get<RateController>(RateController);
    rateService = module.get(RateService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('getRate', () => {
    it('should return rate successfully with currency_code and amount', async () => {
      const mockRate = {
        id: 'rate-123',
        provider: 'yellowcard',
        buying_currency_code: 'NGN',
        selling_currency_code: 'USD',
        rate: 156800,
        provider_rate: 160000,
      };

      mockRateService.getRate.mockResolvedValue(mockRate as any);

      const result = await controller.getRate({
        currency_code: 'NGN',
        amount: 100,
      });

      expect(result).toMatchObject({
        message: 'Rate fetched successfully',
        data: mockRate,
        statusCode: 200,
      });
      expect(rateService.getRate).toHaveBeenCalledWith('NGN', 100, undefined);
    });

    it('should return rate successfully with currency_code, amount and type', async () => {
      const mockRate = {
        id: 'rate-123',
        provider: 'yellowcard',
        buying_currency_code: 'USD',
        selling_currency_code: 'NGN',
        rate: 168351,
        provider_rate: 165050,
      };

      mockRateService.getRate.mockResolvedValue(mockRate as any);

      const result = await controller.getRate({
        currency_code: 'NGN',
        amount: 100,
        type: RateTransactionType.SELL,
      });

      expect(result).toMatchObject({
        message: 'Rate fetched successfully',
        data: mockRate,
        statusCode: 200,
      });
      expect(rateService.getRate).toHaveBeenCalledWith('NGN', 100, RateTransactionType.SELL);
    });

    it('should return rate successfully with BUY type', async () => {
      const mockRate = {
        id: 'rate-123',
        provider: 'yellowcard',
        buying_currency_code: 'NGN',
        selling_currency_code: 'USD',
        rate: 156800,
        provider_rate: 160000,
      };

      mockRateService.getRate.mockResolvedValue(mockRate as any);

      const result = await controller.getRate({
        currency_code: 'NGN',
        amount: 100,
        type: RateTransactionType.BUY,
      });

      expect(result).toMatchObject({
        message: 'Rate fetched successfully',
        data: mockRate,
        statusCode: 200,
      });
      expect(rateService.getRate).toHaveBeenCalledWith('NGN', 100, RateTransactionType.BUY);
    });

    it('should handle service errors', async () => {
      mockRateService.getRate.mockRejectedValue(new Error('Rate service error'));

      await expect(
        controller.getRate({
          currency_code: 'NGN',
          amount: 100,
        }),
      ).rejects.toThrow('Rate service error');
    });

    it('should handle undefined amount', async () => {
      const mockRate = {
        id: 'rate-123',
        provider: 'yellowcard',
        rate: 156800,
      };

      mockRateService.getRate.mockResolvedValue(mockRate as any);

      const result = await controller.getRate({
        currency_code: 'NGN',
        amount: undefined,
      });

      expect(result).toMatchObject({
        message: 'Rate fetched successfully',
        data: mockRate,
        statusCode: 200,
      });
      expect(rateService.getRate).toHaveBeenCalledWith('NGN', undefined, undefined);
    });

    it('should return response with timestamp', async () => {
      const mockRate = {
        id: 'rate-123',
        rate: 156800,
      };

      mockRateService.getRate.mockResolvedValue(mockRate as any);

      const result = await controller.getRate({
        currency_code: 'NGN',
        amount: 100,
      });

      expect(result.timestamp).toBeDefined();
    });
  });

  describe('getRateV2', () => {
    it('should return rate successfully with currency_code and amount via GET', async () => {
      const mockRate = {
        id: 'rate-123',
        provider: 'yellowcard',
        buying_currency_code: 'NGN',
        selling_currency_code: 'USD',
        rate: 156800,
        provider_rate: 160000,
      };

      mockRateService.getRate.mockResolvedValue(mockRate as any);

      const result = await controller.getRateV2({
        currency_code: 'NGN',
        amount: 100,
      });

      expect(result).toMatchObject({
        message: 'Rate fetched successfully',
        data: mockRate,
        statusCode: 200,
      });
      expect(rateService.getRate).toHaveBeenCalledWith('NGN', 100, undefined);
    });

    it('should return rate successfully with currency_code, amount and type via GET', async () => {
      const mockRate = {
        id: 'rate-123',
        provider: 'yellowcard',
        buying_currency_code: 'USD',
        selling_currency_code: 'NGN',
        rate: 168351,
        provider_rate: 165050,
      };

      mockRateService.getRate.mockResolvedValue(mockRate as any);

      const result = await controller.getRateV2({
        currency_code: 'NGN',
        amount: 100,
        type: RateTransactionType.SELL,
      });

      expect(result).toMatchObject({
        message: 'Rate fetched successfully',
        data: mockRate,
        statusCode: 200,
      });
      expect(rateService.getRate).toHaveBeenCalledWith('NGN', 100, RateTransactionType.SELL);
    });

    it('should return rate successfully with BUY type via GET', async () => {
      const mockRate = {
        id: 'rate-123',
        provider: 'yellowcard',
        buying_currency_code: 'NGN',
        selling_currency_code: 'USD',
        rate: 156800,
        provider_rate: 160000,
      };

      mockRateService.getRate.mockResolvedValue(mockRate as any);

      const result = await controller.getRateV2({
        currency_code: 'NGN',
        amount: 100,
        type: RateTransactionType.BUY,
      });

      expect(result).toMatchObject({
        message: 'Rate fetched successfully',
        data: mockRate,
        statusCode: 200,
      });
      expect(rateService.getRate).toHaveBeenCalledWith('NGN', 100, RateTransactionType.BUY);
    });

    it('should handle service errors via GET', async () => {
      mockRateService.getRate.mockRejectedValue(new Error('Rate service error'));

      await expect(
        controller.getRateV2({
          currency_code: 'NGN',
          amount: 100,
        }),
      ).rejects.toThrow('Rate service error');
    });

    it('should handle undefined amount via GET', async () => {
      const mockRate = {
        id: 'rate-123',
        provider: 'yellowcard',
        rate: 156800,
      };

      mockRateService.getRate.mockResolvedValue(mockRate as any);

      const result = await controller.getRateV2({
        currency_code: 'NGN',
        amount: undefined,
      });

      expect(result).toMatchObject({
        message: 'Rate fetched successfully',
        data: mockRate,
        statusCode: 200,
      });
      expect(rateService.getRate).toHaveBeenCalledWith('NGN', undefined, undefined);
    });

    it('should return response with timestamp via GET', async () => {
      const mockRate = {
        id: 'rate-123',
        rate: 156800,
      };

      mockRateService.getRate.mockResolvedValue(mockRate as any);

      const result = await controller.getRateV2({
        currency_code: 'NGN',
        amount: 100,
      });

      expect(result.timestamp).toBeDefined();
    });
  });

  describe('getAllRates', () => {
    it('should return both buy and sell NGN rates successfully', async () => {
      const mockBuyRate = {
        id: 'buy-rate-123',
        provider: 'yellowcard',
        buying_currency_code: 'NGN',
        selling_currency_code: 'USD',
        rate: 156800,
      };

      const mockSellRate = {
        id: 'sell-rate-456',
        provider: 'yellowcard',
        buying_currency_code: 'USD',
        selling_currency_code: 'NGN',
        rate: 168351,
      };

      mockRateService.getRate.mockResolvedValueOnce(mockBuyRate as any).mockResolvedValueOnce(mockSellRate as any);

      const result = await controller.getAllRates();

      expect(result).toMatchObject({
        message: 'Rates fetched successfully',
        data: {
          buyNgnRate: mockBuyRate,
          sellNgnRate: mockSellRate,
        },
        statusCode: 200,
      });
    });

    it('should call getRate with correct parameters for BUY type', async () => {
      const mockBuyRate = { id: 'buy-rate-123', rate: 156800 };
      const mockSellRate = { id: 'sell-rate-456', rate: 168351 };

      mockRateService.getRate.mockResolvedValueOnce(mockBuyRate as any).mockResolvedValueOnce(mockSellRate as any);

      await controller.getAllRates();

      expect(rateService.getRate).toHaveBeenNthCalledWith(
        1,
        SUPPORTED_CURRENCIES.NGN.code,
        100,
        RateTransactionType.BUY,
      );
    });

    it('should call getRate with correct parameters for SELL type', async () => {
      const mockBuyRate = { id: 'buy-rate-123', rate: 156800 };
      const mockSellRate = { id: 'sell-rate-456', rate: 168351 };

      mockRateService.getRate.mockResolvedValueOnce(mockBuyRate as any).mockResolvedValueOnce(mockSellRate as any);

      await controller.getAllRates();

      expect(rateService.getRate).toHaveBeenNthCalledWith(
        2,
        SUPPORTED_CURRENCIES.NGN.code,
        100,
        RateTransactionType.SELL,
      );
    });

    it('should handle service error when fetching buy rate', async () => {
      mockRateService.getRate.mockRejectedValueOnce(new Error('Failed to fetch buy rate'));

      await expect(controller.getAllRates()).rejects.toThrow('Failed to fetch buy rate');
    });

    it('should handle service error when fetching sell rate', async () => {
      const mockBuyRate = { id: 'buy-rate-123', rate: 156800 };

      mockRateService.getRate
        .mockResolvedValueOnce(mockBuyRate as any)
        .mockRejectedValueOnce(new Error('Failed to fetch sell rate'));

      await expect(controller.getAllRates()).rejects.toThrow('Failed to fetch sell rate');
    });

    it('should return response with timestamp', async () => {
      const mockBuyRate = { id: 'buy-rate-123', rate: 156800 };
      const mockSellRate = { id: 'sell-rate-456', rate: 168351 };

      mockRateService.getRate.mockResolvedValueOnce(mockBuyRate as any).mockResolvedValueOnce(mockSellRate as any);

      const result = await controller.getAllRates();

      expect(result.timestamp).toBeDefined();
    });

    it('should call getRate exactly twice', async () => {
      const mockBuyRate = { id: 'buy-rate-123', rate: 156800 };
      const mockSellRate = { id: 'sell-rate-456', rate: 168351 };

      mockRateService.getRate.mockResolvedValueOnce(mockBuyRate as any).mockResolvedValueOnce(mockSellRate as any);

      await controller.getAllRates();

      expect(rateService.getRate).toHaveBeenCalledTimes(2);
    });
  });
});

describe('RateService', () => {
  let service: RateService;

  const mockExchangeAdapter = {
    getExchangeRates: jest.fn(),
    getProviderName: jest.fn(),
  };

  const mockRateRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
  };

  const mockRateConfigRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateService,
        {
          provide: ExchangeAdapter,
          useValue: mockExchangeAdapter,
        },
        {
          provide: RateRepository,
          useValue: mockRateRepository,
        },
        {
          provide: RateConfigRepository,
          useValue: mockRateConfigRepository,
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
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRateInNGN', () => {
    it('should calculate the correct rate with standard fees', () => {
      const amount = 100;
      const ngnProviderRate = 1500;
      const usdProviderNetworkFee = 2;
      const usdProviderWithdrawalFee = 1;

      const rate = service.getRateInNGN(amount, ngnProviderRate, usdProviderNetworkFee, usdProviderWithdrawalFee);

      // Total fee = 2 + 1 = 3
      // Fee percentage = 3/100 = 0.03
      // Second rate = (1 - 0.03) * 1500 = 0.97 * 1500 = 1455
      // Converted amount = 100 - 3 = 97
      // NGN amount = 97 * 1500 = 145500
      // First rate = 145500/100 = 1455
      // Final rate should be max(1455, 1455) = 1455
      expect(rate).toBe(1455);
    });

    it('should calculate the correct rate with zero fees', () => {
      const amount = 100;
      const ngnProviderRate = 1500;
      const usdProviderNetworkFee = 0;
      const usdProviderWithdrawalFee = 0;

      const rate = service.getRateInNGN(amount, ngnProviderRate, usdProviderNetworkFee, usdProviderWithdrawalFee);

      // With zero fees, the rate should equal the provider rate
      expect(rate).toBe(1500);
    });

    it('should calculate the correct rate with high fees', () => {
      const amount = 100;
      const ngnProviderRate = 1500;
      const usdProviderNetworkFee = 5;
      const usdProviderWithdrawalFee = 5;

      const rate = service.getRateInNGN(amount, ngnProviderRate, usdProviderNetworkFee, usdProviderWithdrawalFee);

      // Total fee = 5 + 5 = 10
      // Fee percentage = 10/100 = 0.1
      // Second rate = (1 - 0.1) * 1500 = 0.9 * 1500 = 1350
      // Converted amount = 100 - 10 = 90
      // NGN amount = 90 * 1500 = 135000
      // First rate = 135000/100 = 1350
      // Final rate should be max(1350, 1350) = 1350
      expect(rate).toBe(1350);
    });

    it('should calculate the correct rate with small amount', () => {
      const amount = 10;
      const ngnProviderRate = 1500;
      const usdProviderNetworkFee = 0.5;
      const usdProviderWithdrawalFee = 0.5;

      const rate = service.getRateInNGN(amount, ngnProviderRate, usdProviderNetworkFee, usdProviderWithdrawalFee);

      // Total fee = 0.5 + 0.5 = 1
      // Fee percentage = 1/10 = 0.1
      // Second rate = (1 - 0.1) * 1500 = 0.9 * 1500 = 1350
      // Converted amount = 10 - 1 = 9
      // NGN amount = 9 * 1500 = 13500
      // First rate = 13500/10 = 1350
      // Final rate should be max(1350, 1350) = 1350
      expect(rate).toBe(1350);
    });

    it('should calculate the correct rate with large amount', () => {
      const amount = 10000;
      const ngnProviderRate = 1500;
      const usdProviderNetworkFee = 2;
      const usdProviderWithdrawalFee = 1;

      const rate = service.getRateInNGN(amount, ngnProviderRate, usdProviderNetworkFee, usdProviderWithdrawalFee);

      // Total fee = 2 + 1 = 3
      // Fee percentage = 3/10000 = 0.0003
      // Second rate = (1 - 0.0003) * 1500 = 0.9997 * 1500 = 1499.55
      // Converted amount = 10000 - 3 = 9997
      // NGN amount = 9997 * 1500 = 14995500
      // First rate = 14995500/10000 = 1499.55
      // Final rate should be max(1499.55, 1499.55) = 1499.55
      expect(rate).toBe(1499.55);
    });

    it('should calculate the correct rate with different NGN provider rate', () => {
      const amount = 100;
      const ngnProviderRate = 1600;
      const usdProviderNetworkFee = 2;
      const usdProviderWithdrawalFee = 1;

      const rate = service.getRateInNGN(amount, ngnProviderRate, usdProviderNetworkFee, usdProviderWithdrawalFee);

      // Total fee = 2 + 1 = 3
      // Fee percentage = 3/100 = 0.03
      // Second rate = (1 - 0.03) * 1600 = 0.97 * 1600 = 1552
      // Converted amount = 100 - 3 = 97
      // NGN amount = 97 * 1600 = 155200
      // First rate = 155200/100 = 1552
      // Final rate should be max(1552, 1552) = 1552
      expect(rate).toBe(1552);
    });

    it('should handle decimal fees correctly', () => {
      const amount = 100;
      const ngnProviderRate = 1500;
      const usdProviderNetworkFee = 1.5;
      const usdProviderWithdrawalFee = 0.75;

      const rate = service.getRateInNGN(amount, ngnProviderRate, usdProviderNetworkFee, usdProviderWithdrawalFee);

      // Total fee = 1.5 + 0.75 = 2.25
      // Fee percentage = 2.25/100 = 0.0225
      // Second rate = (1 - 0.0225) * 1500 = 0.9775 * 1500 = 1466.25
      // Converted amount = 100 - 2.25 = 97.75
      // NGN amount = 97.75 * 1500 = 146625
      // First rate = 146625/100 = 1466.25
      // Final rate should be max(1466.25, 1466.25) = 1466.25
      expect(rate).toBe(1466.25);
    });

    it('should return the better rate when rates differ', () => {
      const amount = 50;
      const ngnProviderRate = 1500;
      const usdProviderNetworkFee = 1;
      const usdProviderWithdrawalFee = 1;

      const rate = service.getRateInNGN(amount, ngnProviderRate, usdProviderNetworkFee, usdProviderWithdrawalFee);

      // Total fee = 1 + 1 = 2
      // Fee percentage = 2/50 = 0.04
      // Second rate = (1 - 0.04) * 1500 = 0.96 * 1500 = 1440
      // Converted amount = 50 - 2 = 48
      // NGN amount = 48 * 1500 = 72000
      // First rate = 72000/50 = 1440
      // Final rate should be max(1440, 1440) = 1440
      expect(rate).toBe(1440);
    });
  });

  describe('getRate', () => {
    it('should throw error when rate config is not found', async () => {
      mockRateConfigRepository.findOne.mockResolvedValue(null);
      mockExchangeAdapter.getProviderName.mockReturnValue('yellowcard');

      await expect(service.getRate('NGN', 100)).rejects.toThrow(BadRequestException);
      expect(mockRateConfigRepository.findOne).toHaveBeenCalledWith({
        provider: 'yellowcard',
      });
    });

    it('should throw error when exchange rates request fails', async () => {
      mockRateConfigRepository.findOne.mockResolvedValue({
        id: 'config-123',
        provider: 'yellowcard',
        isActive: true,
      });
      mockExchangeAdapter.getProviderName.mockReturnValue('yellowcard');
      mockExchangeAdapter.getExchangeRates.mockRejectedValue(new Error('Provider error'));

      await expect(service.getRate('NGN', 100)).rejects.toThrow('Provider error');
    });

    it('should throw error when no rate found for currency', async () => {
      mockRateConfigRepository.findOne.mockResolvedValue({
        id: 'config-123',
        provider: 'yellowcard',
        isActive: true,
      });
      mockExchangeAdapter.getProviderName.mockReturnValue('yellowcard');
      mockExchangeAdapter.getExchangeRates.mockResolvedValue([
        { code: 'GHS', buy: 1500, sell: 1400, rateRef: 'ref-123' },
      ]);

      await expect(service.getRate('NGN', 100)).rejects.toThrow('No exchange rate found for currency');
    });

    it('should return existing rate from repository when found', async () => {
      const existingRate = {
        id: 'rate-123',
        provider: 'yellowcard',
        buying_currency_code: 'NGN',
        selling_currency_code: 'USD',
        rate: 156800,
        provider_rate: 156800,
      };

      const rateConfig = {
        id: 'config-123',
        provider: 'yellowcard',
        isActive: true,
      };

      mockRateConfigRepository.findOne.mockResolvedValue(rateConfig);
      mockExchangeAdapter.getProviderName.mockReturnValue('yellowcard');
      mockExchangeAdapter.getExchangeRates.mockResolvedValue([
        { code: 'NGN', buy: 1600, sell: 1568, rateRef: 'ref-123' },
      ]);
      mockRateRepository.findOne.mockResolvedValue(existingRate);

      const result = await service.getRate('NGN', 100, RateTransactionType.BUY);

      // Result includes exchangeRate and rateConfig merged with rate remapped
      expect(result).toMatchObject({
        id: 'rate-123',
        provider: 'yellowcard',
        buying_currency_code: 'NGN',
        selling_currency_code: 'USD',
        is_active: true,
        incrementedRate: 156800,
        rate: 156800,
      });
      expect(mockRateRepository.create).not.toHaveBeenCalled();
    });

    it('should create new rate when not found in repository', async () => {
      const newRate = {
        id: 'rate-456',
        provider: 'yellowcard',
        buying_currency_code: 'NGN',
        selling_currency_code: 'USD',
        rate: 156800,
        provider_rate: 156800,
      };

      const rateConfig = {
        id: 'config-123',
        provider: 'yellowcard',
        isActive: true,
      };

      mockRateConfigRepository.findOne.mockResolvedValue(rateConfig);
      mockExchangeAdapter.getProviderName.mockReturnValue('yellowcard');
      mockExchangeAdapter.getExchangeRates.mockResolvedValue([
        { code: 'NGN', buy: 1600, sell: 1568, rateRef: 'ref-123' },
      ]);
      mockRateRepository.findOne.mockResolvedValue(null);
      mockRateRepository.create.mockResolvedValue(newRate);

      const result = await service.getRate('NGN', 100, RateTransactionType.BUY);

      // Result includes newRate and rateConfig merged with rate remapped
      expect(result).toMatchObject({
        id: 'rate-456',
        provider: 'yellowcard',
        buying_currency_code: 'NGN',
        selling_currency_code: 'USD',
        is_active: true,
        incrementedRate: 156800,
        rate: 156800,
      });
      expect(mockRateRepository.create).toHaveBeenCalled();
    });

    it('should use sell rate for BUY type', async () => {
      const newRate = {
        id: 'rate-456',
        provider: 'yellowcard',
        buying_currency_code: 'NGN',
        selling_currency_code: 'USD',
        rate: 156800,
        provider_rate: 156800,
      };

      mockRateConfigRepository.findOne.mockResolvedValue({
        id: 'config-123',
        provider: 'yellowcard',
        isActive: true,
      });
      mockExchangeAdapter.getProviderName.mockReturnValue('yellowcard');
      mockExchangeAdapter.getExchangeRates.mockResolvedValue([
        { code: 'NGN', buy: 1600, sell: 1568, rateRef: 'ref-123' },
      ]);
      mockRateRepository.findOne.mockResolvedValue(null);
      mockRateRepository.create.mockResolvedValue(newRate);

      await service.getRate('NGN', 100, RateTransactionType.BUY);

      // For BUY type, should use sell rate (1568) converted to smallest unit
      expect(mockRateRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          buying_currency_code: 'NGN',
          selling_currency_code: 'USD',
          provider_rate: 156800, // 1568 * 100 (smallest unit)
        }),
      );
    });

    it('should use buy rate for SELL type', async () => {
      const newRate = {
        id: 'rate-456',
        provider: 'yellowcard',
        buying_currency_code: 'USD',
        selling_currency_code: 'NGN',
        rate: 160000,
        provider_rate: 160000,
      };

      mockRateConfigRepository.findOne.mockResolvedValue({
        id: 'config-123',
        provider: 'yellowcard',
        isActive: true,
      });
      mockExchangeAdapter.getProviderName.mockReturnValue('yellowcard');
      mockExchangeAdapter.getExchangeRates.mockResolvedValue([
        { code: 'NGN', buy: 1600, sell: 1568, rateRef: 'ref-123' },
      ]);
      mockRateRepository.findOne.mockResolvedValue(null);
      mockRateRepository.create.mockResolvedValue(newRate);

      await service.getRate('NGN', 100, RateTransactionType.SELL);

      // For SELL type, should use buy rate (1600) converted to smallest unit
      expect(mockRateRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          buying_currency_code: 'USD',
          selling_currency_code: 'NGN',
          provider_rate: 160000, // 1600 * 100 (smallest unit)
        }),
      );
    });

    it('should store provider rate reference', async () => {
      const newRate = {
        id: 'rate-456',
        provider: 'yellowcard',
        buying_currency_code: 'NGN',
        selling_currency_code: 'USD',
        rate: 156800,
        provider_rate: 156800,
        provider_rate_ref: 'ref-123',
      };

      mockRateConfigRepository.findOne.mockResolvedValue({
        id: 'config-123',
        provider: 'yellowcard',
        isActive: true,
      });
      mockExchangeAdapter.getProviderName.mockReturnValue('yellowcard');
      mockExchangeAdapter.getExchangeRates.mockResolvedValue([
        { code: 'NGN', buy: 1600, sell: 1568, rateRef: 'ref-123' },
      ]);
      mockRateRepository.findOne.mockResolvedValue(null);
      mockRateRepository.create.mockResolvedValue(newRate);

      await service.getRate('NGN', 100, RateTransactionType.BUY);

      expect(mockRateRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          provider_rate_ref: 'ref-123',
        }),
      );
    });

    it('should default to BUY type when type is not provided', async () => {
      const newRate = {
        id: 'rate-456',
        provider: 'yellowcard',
        buying_currency_code: 'NGN',
        selling_currency_code: 'USD',
        rate: 156800,
        provider_rate: 156800,
      };

      mockRateConfigRepository.findOne.mockResolvedValue({
        id: 'config-123',
        provider: 'yellowcard',
        isActive: true,
      });
      mockExchangeAdapter.getProviderName.mockReturnValue('yellowcard');
      mockExchangeAdapter.getExchangeRates.mockResolvedValue([
        { code: 'NGN', buy: 1600, sell: 1568, rateRef: 'ref-123' },
      ]);
      mockRateRepository.findOne.mockResolvedValue(null);
      mockRateRepository.create.mockResolvedValue(newRate);

      await service.getRate('NGN', 100);

      // Should default to BUY type (use sell rate, buying NGN)
      expect(mockRateRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          buying_currency_code: 'NGN',
          selling_currency_code: 'USD',
        }),
      );
    });

    it('should remove sensitive fields from response', async () => {
      const existingRate = {
        id: 'rate-123',
        provider: 'yellowcard',
        buying_currency_code: 'NGN',
        selling_currency_code: 'USD',
        rate: 156800,
        provider_rate: 156800,
        provider_rate_ref: 'ref-123',
        expires_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      };

      mockRateConfigRepository.findOne.mockResolvedValue({
        id: 'config-123',
        provider: 'yellowcard',
        isActive: true,
      });
      mockExchangeAdapter.getProviderName.mockReturnValue('yellowcard');
      mockExchangeAdapter.getExchangeRates.mockResolvedValue([
        { code: 'NGN', buy: 1600, sell: 1568, rateRef: 'ref-123' },
      ]);
      mockRateRepository.findOne.mockResolvedValue(existingRate);

      const result = await service.getRate('NGN', 100, RateTransactionType.BUY);

      // Sensitive fields should be removed
      expect(result.provider_rate).toBeUndefined();
      expect(result.provider_rate_ref).toBeUndefined();
      expect(result.expires_at).toBeUndefined();
      expect(result.created_at).toBeUndefined();
      expect(result.updated_at).toBeUndefined();
      expect(result.deleted_at).toBeUndefined();
    });

    it('should return incrementedRate and rate correctly', async () => {
      const existingRate = {
        id: 'rate-123',
        provider: 'yellowcard',
        buying_currency_code: 'NGN',
        selling_currency_code: 'USD',
        rate: 156800,
        provider_rate: 156800,
      };

      mockRateConfigRepository.findOne.mockResolvedValue({
        id: 'config-123',
        provider: 'yellowcard',
        isActive: true,
      });
      mockExchangeAdapter.getProviderName.mockReturnValue('yellowcard');
      mockExchangeAdapter.getExchangeRates.mockResolvedValue([
        { code: 'NGN', buy: 1600, sell: 1568, rateRef: 'ref-123' },
      ]);
      mockRateRepository.findOne.mockResolvedValue(existingRate);

      const result = await service.getRate('NGN', 100, RateTransactionType.BUY);

      // incrementedRate is the stored rate, rate is the provider_rate
      expect(result.incrementedRate).toBe(156800);
      expect(result.rate).toBe(156800);
    });
  });

  describe('validateRateOrThrow', () => {
    it('should throw error when rate is not found', async () => {
      mockRateRepository.findOne.mockResolvedValue(null);

      await expect(service.validateRateOrThrow('rate-123', 100, RateTransactionType.BUY)).rejects.toThrow(
        'Rate not found',
      );
    });

    it('should throw error when rate is zero or negative', async () => {
      mockRateRepository.findOne.mockResolvedValue({
        id: 'rate-123',
        rate: 0,
        provider: 'yellowcard',
      });

      await expect(service.validateRateOrThrow('rate-123', 100, RateTransactionType.BUY)).rejects.toThrow(
        'Invalid exchange rate',
      );
    });

    it('should throw error when provider is missing', async () => {
      mockRateRepository.findOne.mockResolvedValue({
        id: 'rate-123',
        rate: 156800,
        provider: null,
      });

      await expect(service.validateRateOrThrow('rate-123', 100, RateTransactionType.BUY)).rejects.toThrow(
        'Exchange rate provider is missing',
      );
    });

    it('should throw error when rate does not match current provider rate', async () => {
      const storedRate = {
        id: 'rate-123',
        rate: 156800,
        provider: 'yellowcard',
        buying_currency_code: 'NGN',
        selling_currency_code: 'USD',
      };

      mockRateRepository.findOne.mockResolvedValueOnce(storedRate);
      mockRateConfigRepository.findOne.mockResolvedValue({
        id: 'config-123',
        provider: 'yellowcard',
        isActive: true,
      });
      mockExchangeAdapter.getProviderName.mockReturnValue('yellowcard');
      mockExchangeAdapter.getExchangeRates.mockResolvedValue([
        { code: 'NGN', buy: 1700, sell: 1650, rateRef: 'ref-123' },
      ]);
      // Return null for the new rate lookup to trigger create
      mockRateRepository.findOne.mockResolvedValueOnce(null);
      mockRateRepository.create.mockResolvedValue({
        ...storedRate,
        rate: 165000, // Different rate
        provider_rate: 165000,
      });

      await expect(service.validateRateOrThrow('rate-123', 100, RateTransactionType.BUY)).rejects.toThrow(
        'Exchange rate mismatch',
      );
    });

    it('should return rate when validation passes', async () => {
      const storedRate = {
        id: 'rate-123',
        rate: 156800,
        provider: 'yellowcard',
        provider_rate: 156800,
        buying_currency_code: 'NGN',
        selling_currency_code: 'USD',
      };

      mockRateRepository.findOne.mockResolvedValue(storedRate);
      mockRateConfigRepository.findOne.mockResolvedValue({
        id: 'config-123',
        provider: 'yellowcard',
        isActive: true,
      });
      mockExchangeAdapter.getProviderName.mockReturnValue('yellowcard');
      mockExchangeAdapter.getExchangeRates.mockResolvedValue([
        { code: 'NGN', buy: 1600, sell: 1568, rateRef: 'ref-123' },
      ]);

      const result = await service.validateRateOrThrow('rate-123', 100, RateTransactionType.BUY);

      expect(result).toEqual(storedRate);
    });

    it('should use buying_currency_code for BUY type validation', async () => {
      const storedRate = {
        id: 'rate-123',
        rate: 156800,
        provider: 'yellowcard',
        provider_rate: 156800,
        buying_currency_code: 'NGN',
        selling_currency_code: 'USD',
      };

      mockRateRepository.findOne.mockResolvedValue(storedRate);
      mockRateConfigRepository.findOne.mockResolvedValue({
        id: 'config-123',
        provider: 'yellowcard',
        isActive: true,
      });
      mockExchangeAdapter.getProviderName.mockReturnValue('yellowcard');
      mockExchangeAdapter.getExchangeRates.mockResolvedValue([
        { code: 'NGN', buy: 1600, sell: 1568, rateRef: 'ref-123' },
      ]);

      await service.validateRateOrThrow('rate-123', 100, RateTransactionType.BUY);

      expect(mockExchangeAdapter.getExchangeRates).toHaveBeenCalledWith({ currencyCode: 'NGN' });
    });

    it('should use selling_currency_code for SELL type validation', async () => {
      const storedRate = {
        id: 'rate-123',
        rate: 160000,
        provider: 'yellowcard',
        provider_rate: 160000,
        buying_currency_code: 'USD',
        selling_currency_code: 'NGN',
      };

      mockRateRepository.findOne.mockResolvedValue(storedRate);
      mockRateConfigRepository.findOne.mockResolvedValue({
        id: 'config-123',
        provider: 'yellowcard',
        isActive: true,
      });
      mockExchangeAdapter.getProviderName.mockReturnValue('yellowcard');
      mockExchangeAdapter.getExchangeRates.mockResolvedValue([
        { code: 'NGN', buy: 1600, sell: 1568, rateRef: 'ref-123' },
      ]);

      await service.validateRateOrThrow('rate-123', 100, RateTransactionType.SELL);

      expect(mockExchangeAdapter.getExchangeRates).toHaveBeenCalledWith({ currencyCode: 'NGN' });
    });
  });
});
