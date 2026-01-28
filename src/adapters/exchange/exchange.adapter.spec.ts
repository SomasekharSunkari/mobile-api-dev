import { Test, TestingModule } from '@nestjs/testing';
import { ExchangeConfigProvider } from '../../config/exchange.config';
import { ExchangeAdapter } from './exchange.adapter';
import { ExchangeChannelType, ExchangeCreatePayOutRequestPayload } from './exchange.interface';
import { YellowCardAdapter } from './yellowcard/yellowcard.adapter';

// Mock the ExchangeConfigProvider globally
jest.mock('../../config/exchange.config', () => ({
  ExchangeConfigProvider: jest.fn().mockImplementation(() => ({
    getConfig: jest.fn().mockReturnValue({ default_exchange_provider: 'yellowcard' }),
  })),
}));

describe('ExchangeAdapter', () => {
  let adapter: ExchangeAdapter;
  let yellowCardAdapter: YellowCardAdapter;

  const mockYellowCardAdapter = {
    getChannels: jest.fn(),
    getBanks: jest.fn(),
    getExchangeRates: jest.fn(),
    validateBankAccount: jest.fn(),
    getCryptoChannels: jest.fn(),
    createPayOutRequest: jest.fn(),
    getProviderName: jest.fn(),
    getProvider: jest.fn(),
  };

  beforeEach(async () => {
    (ExchangeConfigProvider as jest.Mock).mockImplementation(() => ({
      getConfig: jest.fn().mockReturnValue({ default_exchange_provider: 'yellowcard' }),
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExchangeAdapter,
        {
          provide: YellowCardAdapter,
          useValue: mockYellowCardAdapter,
        },
      ],
    }).compile();

    adapter = module.get<ExchangeAdapter>(ExchangeAdapter);
    yellowCardAdapter = module.get<YellowCardAdapter>(YellowCardAdapter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProviderName', () => {
    it('should return provider name from config', () => {
      const result = adapter.getProviderName();
      expect(result).toBe('yellowcard');
    });
  });

  describe('getProvider', () => {
    it('should return yellowCardAdapter when provider is yellowcard', () => {
      const result = adapter.getProvider();
      expect(result).toBe(yellowCardAdapter);
    });

    it('should throw error when provider is not found', () => {
      (ExchangeConfigProvider as jest.Mock).mockImplementation(() => ({
        getConfig: jest.fn().mockReturnValue({ default_exchange_provider: 'unknown_provider' }),
      }));

      const newAdapter = new ExchangeAdapter();
      expect(() => newAdapter.getProvider()).toThrow('Provider not found');
    });
  });

  describe('getChannels', () => {
    const mockPayload = { countryCode: 'NG' };
    const mockResponse = { status: 200, message: 'OK', data: [] };

    it('should successfully get channels', async () => {
      mockYellowCardAdapter.getChannels.mockResolvedValue(mockResponse);

      const result = await adapter.getChannels(mockPayload);

      expect(result).toEqual(mockResponse);
      expect(mockYellowCardAdapter.getChannels).toHaveBeenCalledWith(mockPayload);
    });
  });

  describe('getBanks', () => {
    const mockPayload = { countryCode: 'NG' };
    const mockResponse = { status: 200, message: 'OK', data: [] };

    it('should successfully get banks', async () => {
      mockYellowCardAdapter.getBanks.mockResolvedValue(mockResponse);

      const result = await adapter.getBanks(mockPayload);

      expect(result).toEqual(mockResponse);
      expect(mockYellowCardAdapter.getBanks).toHaveBeenCalledWith(mockPayload);
    });
  });

  describe('getExchangeRates', () => {
    const mockPayload = { currencyCode: 'USD' };
    const mockResponse = { status: 200, message: 'OK', data: [] };

    it('should successfully get exchange rates', async () => {
      mockYellowCardAdapter.getExchangeRates.mockResolvedValue(mockResponse);

      const result = await adapter.getExchangeRates(mockPayload);

      expect(result).toEqual(mockResponse);
      expect(mockYellowCardAdapter.getExchangeRates).toHaveBeenCalledWith(mockPayload);
    });
  });

  describe('validateBankAccount', () => {
    const mockPayload = { bankRef: 'bank_123', accountNumber: '1234567890' };
    const mockResponse = { status: 200, message: 'OK', data: {} };

    it('should successfully validate bank account', async () => {
      mockYellowCardAdapter.validateBankAccount.mockResolvedValue(mockResponse);

      const result = await adapter.validateBankAccount(mockPayload);

      expect(result).toEqual(mockResponse);
      expect(mockYellowCardAdapter.validateBankAccount).toHaveBeenCalledWith(mockPayload);
    });
  });

  describe('getCryptoChannels', () => {
    const mockResponse = { status: 200, message: 'OK', data: [] };

    it('should successfully get crypto channels', async () => {
      mockYellowCardAdapter.getCryptoChannels.mockResolvedValue(mockResponse);

      const result = await adapter.getCryptoChannels();

      expect(result).toEqual(mockResponse);
      expect(mockYellowCardAdapter.getCryptoChannels).toHaveBeenCalled();
    });
  });

  describe('createPayOutRequest', () => {
    const mockPayload: ExchangeCreatePayOutRequestPayload = {
      channelRef: 'channel_123',
      transactionRef: 'tx_123',
      cryptoInfo: {
        cryptoAmount: 100,
        cryptoCurrency: 'BTC',
        cryptoNetwork: 'BTC',
      },
      narration: 'test',
      sender: {
        fullName: 'John Doe',
        countryCode: 'NG',
        phoneNumber: '+123',
        address: 'test',
        dob: '1990-01-01',
        email: 'test@test.com',
        idNumber: '123',
        idType: 'NIN',
      },
      destination: {
        accountNumber: '123',
        transferType: ExchangeChannelType.BANK,
        accountName: 'Jane',
        bankRef: 'bank_123',
      },
      userId: 'user_123',
    };
    const mockResponse = { status: 200, message: 'OK', data: {} };

    it('should successfully create pay out request', async () => {
      mockYellowCardAdapter.createPayOutRequest.mockResolvedValue(mockResponse);

      const result = await adapter.createPayOutRequest(mockPayload);

      expect(result).toEqual(mockResponse);
      expect(mockYellowCardAdapter.createPayOutRequest).toHaveBeenCalledWith(mockPayload);
    });
  });
});
