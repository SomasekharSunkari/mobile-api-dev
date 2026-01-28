import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import axios, { AxiosResponse } from 'axios';
import { YellowCardConfigProvider } from '../../../config/yellowcard.config';
import { ExchangeChannelType, ExchangeCreatePayOutRequestPayload } from '../exchange.interface';
import { YellowCardAdapter } from './yellowcard.adapter';

describe('YellowCardAdapter', () => {
  let adapter: YellowCardAdapter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: YellowCardAdapter,
          useFactory: () => {
            const config = new YellowCardConfigProvider().getConfig();
            const adapter = new YellowCardAdapter(axios, config);
            // Mock the HTTP methods from the parent class
            jest.spyOn(adapter, 'get').mockImplementation(jest.fn());
            jest.spyOn(adapter, 'post').mockImplementation(jest.fn());
            jest.spyOn(adapter, 'delete').mockImplementation(jest.fn());
            return adapter;
          },
        },
      ],
    }).compile();

    adapter = module.get<YellowCardAdapter>(YellowCardAdapter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProviderName', () => {
    it('should return yellowcard', () => {
      expect(adapter.getProviderName()).toBe('yellowcard');
    });
  });

  describe('getExchangeRates', () => {
    const mockPayload = {
      currencyCode: 'USD',
    };

    const mockRates = [
      {
        buy: 1.25,
        sell: 1.2,
        locale: 'en-US',
        rateId: 'rate_123',
        code: 'USD',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ];

    const mockResponse: AxiosResponse = {
      data: {
        rates: mockRates,
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should successfully get exchange rates', async () => {
      (adapter.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await adapter.getExchangeRates(mockPayload);

      expect(result).toEqual(
        mockRates.map((rate) => ({
          buy: rate.buy,
          sell: rate.sell,
          locale: rate.locale,
          rateRef: rate.rateId,
          code: rate.code,
          updatedAt: rate.updatedAt,
        })),
      );
      expect(adapter.get).toHaveBeenCalledWith('/business/rates', {
        params: {
          currency: mockPayload.currencyCode,
        },
        validateStatus: expect.any(Function),
      });
    });

    it('should handle error when getting exchange rates', async () => {
      const error = new Error('Failed to get exchange rates');
      (adapter.get as jest.Mock).mockRejectedValue(error);

      await expect(adapter.getExchangeRates(mockPayload)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getChannels', () => {
    const mockPayload = {
      countryCode: 'NG',
    };

    const mockChannels = [
      {
        id: 'channel_123',
        max: 1000000,
        currency: 'NGN',
        countryCurrency: 'NGN',
        status: 'active',
        feeLocal: 100,
        vendorId: 'vendor_123',
        country: 'NG',
        min: 1000,
        channelType: 'bank',
        rampType: 'on',
        apiStatus: 'active',
        settlementType: 'instant',
        estimatedSettlementTime: 300,
        feeUSD: 0.25,
      },
    ];

    const mockResponse: AxiosResponse = {
      data: {
        channels: mockChannels,
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should successfully get channels', async () => {
      (adapter.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await adapter.getChannels(mockPayload);

      expect(result).toEqual(
        mockChannels.map((channel) => ({
          ref: channel.id,
          max: channel.max,
          currency: channel.currency,
          localCurrency: channel.countryCurrency,
          status: channel.status,
          localFee: channel.feeLocal,
          vendorRef: channel.vendorId,
          countryCode: channel.country,
          min: channel.min,
          type: channel.channelType,
          rampType: channel.rampType,
          settlementType: channel.settlementType,
          settlementTime: channel.estimatedSettlementTime,
          feeUSD: channel.feeUSD,
        })),
      );
      expect(adapter.get).toHaveBeenCalledWith('/business/channels', {
        params: {
          country: mockPayload.countryCode,
        },
      });
    });

    it('should handle error when getting channels', async () => {
      const error = new Error('Failed to get channels');
      (adapter.get as jest.Mock).mockRejectedValue(error);

      await expect(adapter.getChannels(mockPayload)).rejects.toThrow(BadRequestException);
    });

    it('should handle empty channels response', async () => {
      const emptyResponse: AxiosResponse = {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      (adapter.get as jest.Mock).mockResolvedValue(emptyResponse);

      const result = await adapter.getChannels(mockPayload);

      expect(result).toEqual([]);
    });
  });

  describe('getBanks', () => {
    const mockPayload = {
      countryCode: 'NG',
    };

    const mockNetworks = [
      {
        id: '5f1af11b-305f-4420-8fce-65ed2725a409',
        name: 'Access Bank',
        code: '044',
        country: 'NG',
        status: 'active',
        accountNumberType: 'bank',
        countryAccountNumberType: 'NGBANK',
        channelIds: ['fe8f4989-3bf6-41ca-9621-ffe2bc127569', 'af944f0c-ba70-47c7-86dc-1bad5a6ab4e4'],
        createdAt: undefined,
        updatedAt: '2023-06-08T15:18:44.135Z',
      },
    ];

    const mockResponse: AxiosResponse = {
      data: {
        networks: mockNetworks,
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should successfully get banks', async () => {
      (adapter.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await adapter.getBanks(mockPayload);

      expect(result).toEqual(
        mockNetworks.map((network) => ({
          ref: network.id,
          name: network.name,
          code: network.code,
          countryCode: network.country,
          status: network.status,
          accountNumberType: network.accountNumberType,
          countryAccountNumberType: network.countryAccountNumberType,
          channelRefs: network.channelIds,
          createdAt: network.createdAt,
          updatedAt: network.updatedAt,
        })),
      );
      expect(adapter.get).toHaveBeenCalledWith('/business/networks', {
        params: {
          country: mockPayload.countryCode,
        },
      });
    });

    it('should handle error when getting banks', async () => {
      const error = new Error('Failed to get banks');
      (adapter.get as jest.Mock).mockRejectedValue(error);

      await expect(adapter.getBanks(mockPayload)).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateBankAccount', () => {
    const mockPayload = {
      bankRef: '5f1af11b-305f-4420-8fce-65ed2725a409',
      accountNumber: '1234567890',
    };

    const mockResponse: AxiosResponse = {
      data: {
        accountNumber: '1234567890',
        accountName: 'Ken Adams',
        accountBank: 'Access Bank',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should successfully validate bank account', async () => {
      (adapter.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await adapter.validateBankAccount(mockPayload);

      expect(result).toEqual({
        accountNumber: mockResponse.data.accountNumber,
        accountName: mockResponse.data.accountName,
        bankName: mockResponse.data.accountBank,
      });
      expect(adapter.post).toHaveBeenCalledWith('/business/details/bank', {
        networkId: mockPayload.bankRef,
        accountNumber: mockPayload.accountNumber,
      });
    });

    it('should handle error when validating bank account', async () => {
      const error = {
        message: 'Invalid account number',
        response: {
          data: {
            message: 'Invalid account number',
          },
        },
      };
      (adapter.post as jest.Mock).mockRejectedValue(error);

      await expect(adapter.validateBankAccount(mockPayload)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getCryptoChannels', () => {
    const mockCryptoChannels = [
      {
        code: 'BTC',
        id: 'bitcoin',
        name: 'Bitcoin',
        enabled: false,
        networks: {
          bitcoin: {
            chainCurrencyId: 'BTC',
            addressRegex: '^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^[(bc1q)|(bc1p)][0-9A-Za-z]{37,62}$',
            requiresMemo: false,
            explorerUrl: 'https://blockstream.info/tx/__TX_HASH__',
            name: 'Bitcoin',
            enabled: true,
            network: 'BTC',
            nativeAsset: 'BTC',
          },
        },
        buyMinLocal: { TZS: 145000 },
        buyMaxLocal: {},
        sellMinLocal: { TZS: 145000, XAF: 4000, ZAR: 100, ZMW: 200 },
        sellMaxLocal: { XAF: 200000, ZAR: 5000, ZMW: 10000 },
        defaultNetwork: 'BTC',
      },
    ];

    const mockResponse: AxiosResponse = {
      data: {
        channels: mockCryptoChannels,
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should successfully get crypto channels', async () => {
      (adapter.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await adapter.getCryptoChannels();

      expect(result).toEqual(
        mockCryptoChannels.map((channel) => ({
          code: channel.code,
          ref: channel.id,
          name: channel.name,
          enabled: channel.enabled,
          networks: [
            {
              chainCurrencyRef: 'BTC',
              addressRegex: '^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^[(bc1q)|(bc1p)][0-9A-Za-z]{37,62}$',
              requiresMemo: false,
              explorerUrl: 'https://blockstream.info/tx/__TX_HASH__',
              name: 'Bitcoin',
              isEnabled: true,
              network: 'BTC',
              nativeAsset: 'BTC',
            },
          ],
          minLocalBuy: channel.buyMinLocal,
          maxLocalBuy: channel.buyMaxLocal,
          minLocalSell: channel.sellMinLocal,
          maxLocalSell: channel.sellMaxLocal,
          defaultNetwork: channel.defaultNetwork,
        })),
      );
      expect(adapter.get).toHaveBeenCalledWith('/business/channels/crypto');
    });

    it('should handle error when getting crypto channels', async () => {
      const error = new Error('Failed to get crypto channels');
      (adapter.get as jest.Mock).mockRejectedValue(error);

      await expect(adapter.getCryptoChannels()).rejects.toThrow(BadRequestException);
    });

    it('should handle empty networks', async () => {
      const channelWithEmptyNetworks = {
        ...mockCryptoChannels[0],
        networks: null,
      };

      const mockResponseWithEmptyNetworks: AxiosResponse = {
        data: {
          channels: [channelWithEmptyNetworks],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      (adapter.get as jest.Mock).mockResolvedValue(mockResponseWithEmptyNetworks);

      const result = await adapter.getCryptoChannels();

      expect(result[0].networks).toEqual([]);
    });
  });

  describe('createPayOutRequest', () => {
    const mockPayload: ExchangeCreatePayOutRequestPayload = {
      channelRef: 'fe8f4989-3bf6-41ca-9621-ffe2bc127569',
      transactionRef: 'tx_1234567890',
      cryptoInfo: {
        cryptoAmount: 100.5,
        cryptoCurrency: 'BTC',
        cryptoNetwork: 'BTC',
      },
      narration: 'entertainment',
      sender: {
        fullName: 'John Doe',
        countryCode: 'NG',
        phoneNumber: '+2341234567890',
        address: '123 Lagos Street, Lagos',
        dob: '1990-05-15',
        email: 'john.doe@example.com',
        idNumber: '12345678901',
        idType: 'NIN',
        additionalIdType: 'PASSPORT',
        additionalIdNumber: 'A12345678',
      },
      destination: {
        accountNumber: '1234567890',
        transferType: ExchangeChannelType.BANK,
        accountName: 'Jane Smith',
        bankRef: '5f1af11b-305f-4420-8fce-65ed2725a409',
      },
      userId: 'cust_987654321',
    };

    const mockResponse: AxiosResponse = {
      data: {
        id: 'payment_123',
        channelRef: 'fe8f4989-3bf6-41ca-9621-ffe2bc127569',
        status: 'pending',
        amount: 100.5,
        currency: 'NGN',
        sequenceRef: 'tx_1234567890',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should successfully create pay out request', async () => {
      (adapter.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await adapter.createPayOutRequest(mockPayload);

      expect(result).toEqual({
        ref: mockResponse.data.id,
        providerRef: mockResponse.data.id,
        status: mockResponse.data.status,
        amount: mockResponse.data.amount,
        currency: mockResponse.data.currency,
        channelRef: undefined,
        sequenceRef: undefined,
        country: undefined,
        reason: undefined,
        convertedAmount: undefined,
        rate: undefined,
        sender: undefined,
        destination: undefined,
        userId: undefined,
        createdAt: undefined,
        updatedAt: undefined,
        expiresAt: undefined,
        cryptoInfo: {
          cryptoAmount: undefined,
          cryptoCurrency: undefined,
          cryptoNetwork: undefined,
          expiresAt: undefined,
          rate: undefined,
          walletAddress: undefined,
        },
      });
      expect(adapter.post).toHaveBeenCalledWith('/business/payments', {
        channelId: mockPayload.channelRef,
        customerUID: mockPayload.userId,
        reason: mockPayload.narration,
        sequenceId: mockPayload.transactionRef,
        sender: {
          name: mockPayload.sender.fullName,
          address: mockPayload.sender.address,
          country: mockPayload.sender.countryCode,
          email: mockPayload.sender.email,
          dob: mockPayload.sender.dob,
          idNumber: mockPayload.sender.idNumber,
          idType: mockPayload.sender.idType,
          additionalIdNumber: mockPayload.sender.additionalIdNumber,
          additionalIdType: mockPayload.sender.additionalIdType,
          phone: mockPayload.sender.phoneNumber,
        },
        destination: {
          accountName: mockPayload.destination.accountName,
          accountNumber: mockPayload.destination.accountNumber,
          accountType: mockPayload.destination.transferType,
          networkId: mockPayload.destination.bankRef,
        },
        forceAccept: true,
        directSettlement: true,
        settlementInfo: {
          cryptoAmount: mockPayload.cryptoInfo.cryptoAmount,
          cryptoCurrency: mockPayload.cryptoInfo.cryptoCurrency,
          cryptoNetwork: mockPayload.cryptoInfo.cryptoNetwork,
        },
      });
    });

    it('should handle error when creating pay out request', async () => {
      const error = {
        message: 'Payment failed',
        response: {
          data: {
            message: 'Payment failed',
          },
        },
      };
      (adapter.post as jest.Mock).mockRejectedValue(error);

      await expect(adapter.createPayOutRequest(mockPayload)).rejects.toThrow(BadRequestException);
    });

    it('should handle error without response data when creating pay out request', async () => {
      const error = {
        message: 'Network error',
      };
      (adapter.post as jest.Mock).mockRejectedValue(error);

      await expect(adapter.createPayOutRequest(mockPayload)).rejects.toThrow(BadRequestException);
    });
  });

  describe('acceptPayOutRequest', () => {
    const mockPayload = {
      paymentRef: 'payment_123',
    };

    const mockResponse: AxiosResponse = {
      data: {
        id: 'payment_123',
        status: 'accepted',
        amount: 100.5,
        currency: 'NGN',
        channelId: 'channel_123',
        sequenceId: 'tx_1234567890',
        country: 'NG',
        reason: 'entertainment',
        convertedAmount: 100.5,
        rate: 1.0,
        sender: {
          name: 'John Doe',
          country: 'NG',
          phone: '+2341234567890',
          address: '123 Lagos Street, Lagos',
          dob: '1990-05-15',
          email: 'john.doe@example.com',
          idNumber: '12345678901',
          idType: 'NIN',
        },
        destination: {
          accountName: 'Jane Smith',
          accountNumber: '1234567890',
          accountType: 'bank',
          networkId: '5f1af11b-305f-4420-8fce-65ed2725a409',
        },
        customerUID: 'cust_987654321',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        expiresAt: '2024-01-02T00:00:00Z',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should successfully accept pay out request', async () => {
      (adapter.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await adapter.acceptPayOutRequest(mockPayload);

      expect(result).toEqual({
        ref: mockResponse.data.id,
        providerRef: mockResponse.data.id,
        status: mockResponse.data.status,
        amount: mockResponse.data.amount,
        currency: mockResponse.data.currency,
        channelRef: mockResponse.data.channelId,
        sequenceRef: mockResponse.data.sequenceId,
        country: mockResponse.data.country,
        reason: mockResponse.data.reason,
        convertedAmount: mockResponse.data.convertedAmount,
        rate: mockResponse.data.rate,
        sender: mockResponse.data.sender,
        destination: mockResponse.data.destination,
        userId: mockResponse.data.customerUID,
        createdAt: mockResponse.data.createdAt,
        updatedAt: mockResponse.data.updatedAt,
        expiresAt: mockResponse.data.expiresAt,
        cryptoInfo: {
          walletAddress: mockResponse.data.settlementInfo?.walletAddress,
          cryptoAmount: mockResponse.data.settlementInfo?.cryptoAmount,
          cryptoCurrency: mockResponse.data.settlementInfo?.cryptoCurrency,
          cryptoNetwork: mockResponse.data.settlementInfo?.cryptoNetwork,
          rate: mockResponse.data.settlementInfo?.cryptoUSDRate,
          expiresAt: mockResponse.data.settlementInfo?.expiresAt,
        },
      });
      expect(adapter.post).toHaveBeenCalledWith(`/business/payments/${mockPayload.paymentRef}/accept`);
    });

    it('should handle error when accepting pay out request', async () => {
      const error = {
        message: 'Payment not found',
        response: {
          data: {
            message: 'Payment not found',
          },
        },
      };
      (adapter.post as jest.Mock).mockRejectedValue(error);

      await expect(adapter.acceptPayOutRequest(mockPayload)).rejects.toThrow(BadRequestException);
    });
  });

  describe('rejectPayOutRequest', () => {
    const mockPayload = {
      paymentRef: 'payment_123',
      reason: 'Invalid account details',
    };

    const mockResponse: AxiosResponse = {
      data: {
        id: 'payment_123',
        status: 'rejected',
        amount: 100.5,
        currency: 'NGN',
        channelId: 'channel_123',
        sequenceId: 'tx_1234567890',
        country: 'NG',
        reason: 'entertainment',
        convertedAmount: 100.5,
        rate: 1.0,
        sender: {
          name: 'John Doe',
          country: 'NG',
          phone: '+2341234567890',
          address: '123 Lagos Street, Lagos',
          dob: '1990-05-15',
          email: 'john.doe@example.com',
          idNumber: '12345678901',
          idType: 'NIN',
        },
        destination: {
          accountName: 'Jane Smith',
          accountNumber: '1234567890',
          accountType: 'bank',
          networkId: '5f1af11b-305f-4420-8fce-65ed2725a409',
        },
        customerUID: 'cust_987654321',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        expiresAt: '2024-01-02T00:00:00Z',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should successfully reject pay out request', async () => {
      (adapter.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await adapter.rejectPayOutRequest(mockPayload);

      expect(result).toEqual({
        ref: mockResponse.data.id,
        providerRef: mockResponse.data.id,
        status: mockResponse.data.status,
        amount: mockResponse.data.amount,
        currency: mockResponse.data.currency,
        channelRef: mockResponse.data.channelId,
        sequenceRef: mockResponse.data.sequenceId,
        country: mockResponse.data.country,
        reason: mockResponse.data.reason,
        convertedAmount: mockResponse.data.convertedAmount,
        rate: mockResponse.data.rate,
        sender: mockResponse.data.sender,
        destination: mockResponse.data.destination,
        userId: mockResponse.data.customerUID,
        createdAt: mockResponse.data.createdAt,
        updatedAt: mockResponse.data.updatedAt,
        expiresAt: mockResponse.data.expiresAt,
        cryptoInfo: {
          walletAddress: mockResponse.data.settlementInfo?.walletAddress,
          cryptoAmount: mockResponse.data.settlementInfo?.cryptoAmount,
          cryptoCurrency: mockResponse.data.settlementInfo?.cryptoCurrency,
          cryptoNetwork: mockResponse.data.settlementInfo?.cryptoNetwork,
          rate: mockResponse.data.settlementInfo?.cryptoUSDRate,
          expiresAt: mockResponse.data.settlementInfo?.expiresAt,
        },
      });
      expect(adapter.post).toHaveBeenCalledWith(`/business/payments/${mockPayload.paymentRef}/reject`);
    });

    it('should handle error when rejecting pay out request', async () => {
      const error = {
        message: 'Payment not found',
        response: {
          data: {
            message: 'Payment not found',
          },
        },
      };
      (adapter.post as jest.Mock).mockRejectedValue(error);

      await expect(adapter.rejectPayOutRequest(mockPayload)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPayOutRequest', () => {
    const mockPayload = {
      paymentRef: 'payment_123',
    };

    const mockResponse: AxiosResponse = {
      data: {
        id: 'payment_123',
        status: 'pending',
        amount: 100.5,
        currency: 'NGN',
        channelId: 'channel_123',
        sequenceId: 'tx_1234567890',
        country: 'NG',
        reason: 'entertainment',
        convertedAmount: 100.5,
        rate: 1.0,
        sender: {
          name: 'John Doe',
          country: 'NG',
          phone: '+2341234567890',
          address: '123 Lagos Street, Lagos',
          dob: '1990-05-15',
          email: 'john.doe@example.com',
          idNumber: '12345678901',
          idType: 'NIN',
        },
        destination: {
          accountName: 'Jane Smith',
          accountNumber: '1234567890',
          accountType: 'bank',
          networkId: '5f1af11b-305f-4420-8fce-65ed2725a409',
        },
        customerUID: 'cust_987654321',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        expiresAt: '2024-01-02T00:00:00Z',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should successfully get pay out request', async () => {
      (adapter.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await adapter.getPayOutRequest(mockPayload);

      expect(result).toEqual({
        ref: mockResponse.data.id,
        providerRef: mockResponse.data.id,
        status: mockResponse.data.status,
        amount: mockResponse.data.amount,
        currency: mockResponse.data.currency,
        channelRef: mockResponse.data.channelId,
        sequenceRef: mockResponse.data.sequenceId,
        country: mockResponse.data.country,
        reason: mockResponse.data.reason,
        convertedAmount: mockResponse.data.convertedAmount,
        rate: mockResponse.data.rate,
        sender: mockResponse.data.sender,
        destination: mockResponse.data.destination,
        userId: mockResponse.data.customerUID,
        createdAt: mockResponse.data.createdAt,
        updatedAt: mockResponse.data.updatedAt,
        expiresAt: mockResponse.data.expiresAt,
        cryptoInfo: {
          walletAddress: mockResponse.data.settlementInfo?.walletAddress,
          cryptoAmount: mockResponse.data.settlementInfo?.cryptoAmount,
          cryptoCurrency: mockResponse.data.settlementInfo?.cryptoCurrency,
          cryptoNetwork: mockResponse.data.settlementInfo?.cryptoNetwork,
          rate: mockResponse.data.settlementInfo?.cryptoUSDRate,
          expiresAt: mockResponse.data.settlementInfo?.expiresAt,
        },
      });
      expect(adapter.get).toHaveBeenCalledWith(`/business/payments/${mockPayload.paymentRef}`);
    });

    it('should handle error when getting pay out request', async () => {
      const error = {
        message: 'Payment not found',
        response: {
          data: {
            message: 'Payment not found',
          },
        },
      };
      (adapter.get as jest.Mock).mockRejectedValue(error);

      await expect(adapter.getPayOutRequest(mockPayload)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPayOutRequestByTransactionRef', () => {
    const transactionId = 'tx_1234567890';

    const mockResponse: AxiosResponse = {
      data: {
        id: 'payment_123',
        status: 'pending',
        amount: 100.5,
        currency: 'NGN',
        channelId: 'channel_123',
        sequenceId: transactionId,
        country: 'NG',
        reason: 'entertainment',
        convertedAmount: 100.5,
        rate: 1.0,
        sender: {
          name: 'John Doe',
          country: 'NG',
          phone: '+2341234567890',
          address: '123 Lagos Street, Lagos',
          dob: '1990-05-15',
          email: 'john.doe@example.com',
          idNumber: '12345678901',
          idType: 'NIN',
        },
        destination: {
          accountName: 'Jane Smith',
          accountNumber: '1234567890',
          accountType: 'bank',
          networkId: '5f1af11b-305f-4420-8fce-65ed2725a409',
        },
        customerUID: 'cust_987654321',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        expiresAt: '2024-01-02T00:00:00Z',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should successfully get pay out request by transaction ref', async () => {
      (adapter.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await adapter.getPayOutRequestByTransactionRef(transactionId);

      expect(result).toEqual({
        ref: mockResponse.data.id,
        providerRef: mockResponse.data.id,
        status: mockResponse.data.status,
        amount: mockResponse.data.amount,
        currency: mockResponse.data.currency,
        channelRef: mockResponse.data.channelId,
        sequenceRef: mockResponse.data.sequenceId,
        country: mockResponse.data.country,
        reason: mockResponse.data.reason,
        convertedAmount: mockResponse.data.convertedAmount,
        rate: mockResponse.data.rate,
        sender: mockResponse.data.sender,
        destination: mockResponse.data.destination,
        userId: mockResponse.data.customerUID,
        createdAt: mockResponse.data.createdAt,
        updatedAt: mockResponse.data.updatedAt,
        expiresAt: mockResponse.data.expiresAt,
        cryptoInfo: {
          walletAddress: mockResponse.data.settlementInfo?.walletAddress,
          cryptoAmount: mockResponse.data.settlementInfo?.cryptoAmount,
          cryptoCurrency: mockResponse.data.settlementInfo?.cryptoCurrency,
          cryptoNetwork: mockResponse.data.settlementInfo?.cryptoNetwork,
          rate: mockResponse.data.settlementInfo?.cryptoUSDRate,
          expiresAt: mockResponse.data.settlementInfo?.expiresAt,
        },
      });
      expect(adapter.get).toHaveBeenCalledWith(`/business/payments/sequence-id/${transactionId}`);
    });

    it('should handle error when getting pay out request by transaction ref', async () => {
      const error = {
        message: 'Transaction not found',
        response: {
          data: {
            message: 'Transaction not found',
          },
        },
      };
      (adapter.get as jest.Mock).mockRejectedValue(error);

      await expect(adapter.getPayOutRequestByTransactionRef(transactionId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAllPayOutRequests', () => {
    const mockParams = {
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      page: 1,
      limit: 10,
      filterBy: 'status',
    };

    const mockPayments = [
      {
        id: 'payment_123',
        status: 'pending',
        amount: 100.5,
        currency: 'NGN',
        channelId: 'channel_123',
        sequenceId: 'tx_1234567890',
        country: 'NG',
        reason: 'entertainment',
        convertedAmount: 100.5,
        rate: 1.0,
        sender: {
          name: 'John Doe',
          country: 'NG',
          phone: '+2341234567890',
          address: '123 Lagos Street, Lagos',
          dob: '1990-05-15',
          email: 'john.doe@example.com',
          idNumber: '12345678901',
          idType: 'NIN',
        },
        destination: {
          accountName: 'Jane Smith',
          accountNumber: '1234567890',
          accountType: 'bank',
          networkId: '5f1af11b-305f-4420-8fce-65ed2725a409',
        },
        customerUID: 'cust_987654321',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        expiresAt: '2024-01-02T00:00:00Z',
      },
    ];

    const mockResponse: AxiosResponse = {
      data: {
        payments: mockPayments,
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should successfully get all pay out requests', async () => {
      (adapter.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await adapter.getAllPayOutRequests(mockParams);

      expect(result).toEqual(
        mockPayments.map((payment) => ({
          ref: payment.id,
          providerRef: payment.id,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
          channelRef: payment.channelId,
          sequenceRef: payment.sequenceId,
          country: payment.country,
          reason: payment.reason,
          convertedAmount: payment.convertedAmount,
          rate: payment.rate,
          sender: payment.sender,
          destination: payment.destination,
          userId: payment.customerUID,
          createdAt: payment.createdAt,
          updatedAt: payment.updatedAt,
          expiresAt: payment.expiresAt,
          cryptoInfo: {
            walletAddress: undefined,
            cryptoAmount: undefined,
            cryptoCurrency: undefined,
            cryptoNetwork: undefined,
            rate: undefined,
            expiresAt: undefined,
          },
        })),
      );
      expect(adapter.get).toHaveBeenCalled();
    });

    it('should handle error when getting all pay out requests', async () => {
      const error = {
        message: 'Failed to fetch payments',
        response: {
          data: {
            message: 'Failed to fetch payments',
          },
        },
      };
      (adapter.get as jest.Mock).mockRejectedValue(error);

      await expect(adapter.getAllPayOutRequests(mockParams)).rejects.toThrow(BadRequestException);
    });

    it('should handle empty collections response', async () => {
      const emptyResponse: AxiosResponse = {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      (adapter.get as jest.Mock).mockResolvedValue(emptyResponse);

      const result = await adapter.getAllPayOutRequests(mockParams);

      expect(result).toEqual([]);
    });
  });

  describe('createWebhook', () => {
    const mockPayload = {
      url: 'https://example.com/webhook',
    };

    const mockResponse: AxiosResponse = {
      data: {
        id: 'webhook_123',
        url: 'https://example.com/webhook',
        state: 'active',
        active: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should successfully create webhook', async () => {
      (adapter.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await adapter.createWebhook(mockPayload);

      expect(result).toEqual({
        id: mockResponse.data.id,
        url: mockResponse.data.url,
        isActive: mockResponse.data.active,
        createdAt: mockResponse.data.createdAt,
        updatedAt: mockResponse.data.updatedAt,
      });
      expect(adapter.post).toHaveBeenCalledWith('/business/webhooks', {
        url: mockPayload.url,
        active: true,
      });
    });

    it('should handle error when creating webhook', async () => {
      const error = {
        message: 'Invalid webhook URL',
        response: {
          data: {
            message: 'Invalid webhook URL',
          },
        },
      };
      (adapter.post as jest.Mock).mockRejectedValue(error);

      await expect(adapter.createWebhook(mockPayload)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getWebhooks', () => {
    const mockWebhooks = [
      {
        id: 'webhook_123',
        url: 'https://example.com/webhook',
        state: 'active',
        active: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ];

    const mockResponse: AxiosResponse = {
      data: {
        webhooks: mockWebhooks,
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should successfully get webhooks', async () => {
      (adapter.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await adapter.getWebhooks();

      expect(result).toEqual(
        mockWebhooks.map((webhook) => ({
          ref: webhook.id,
          url: webhook.url,
          isActive: webhook.active,
          createdAt: webhook.createdAt,
          updatedAt: webhook.updatedAt,
          event: webhook.state,
        })),
      );
      expect(adapter.get).toHaveBeenCalledWith('/business/webhooks');
    });

    it('should handle error when getting webhooks', async () => {
      const error = new Error('Failed to get webhooks');
      (adapter.get as jest.Mock).mockRejectedValue(error);

      await expect(adapter.getWebhooks()).rejects.toThrow(BadRequestException);
    });

    it('should handle empty webhooks response', async () => {
      const emptyResponse: AxiosResponse = {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      (adapter.get as jest.Mock).mockResolvedValue(emptyResponse);

      const result = await adapter.getWebhooks();

      expect(result).toEqual([]);
    });
  });

  describe('deleteWebhook', () => {
    const mockPayload = {
      ref: 'webhook_123',
    };

    const mockResponse: AxiosResponse = {
      data: {
        ok: true,
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should successfully delete webhook', async () => {
      (adapter.delete as jest.Mock).mockResolvedValue(mockResponse);

      const result = await adapter.deleteWebhook(mockPayload);

      expect(result).toEqual({
        ok: true,
      });
      expect(adapter.delete).toHaveBeenCalledWith(`/business/webhooks/${mockPayload.ref}`);
    });

    it('should handle error when deleting webhook', async () => {
      const error = {
        message: 'Webhook not found',
        response: {
          data: {
            message: 'Webhook not found',
          },
        },
      };
      (adapter.delete as jest.Mock).mockRejectedValue(error);

      await expect(adapter.deleteWebhook(mockPayload)).rejects.toThrow(BadRequestException);
    });
  });

  describe('createPayInRequest', () => {
    const mockPayload = {
      channelRef: 'channel_123',
      transactionRef: 'tx_1234567890',
      amount: 100.5,
      sender: {
        name: 'John Doe',
        country: 'NG',
        address: '123 Lagos Street, Lagos',
        dob: '1990-05-15',
        email: 'john.doe@example.com',
        idNumber: '12345678901',
        idType: 'NIN',
        additionalIdType: 'PASSPORT',
        additionalIdNumber: 'A12345678',
        phone: '+2341234567890',
      },
      transferType: ExchangeChannelType.BANK,
      userId: 'cust_987654321',
      redirectUrl: 'https://example.com/redirect',
      currencyCode: 'NGN',
      networkRef: 'network_123',
      receiver: {
        walletAddress: 'GCHqyq3uMed9PCVpaqFC8pbQMDCSPtPcYHU5fkKkAT4R',
        cryptoCurrency: 'USDC',
        cryptoNetwork: 'SOL',
      },
      customerType: 'retail' as const,
    };

    const mockResponse: AxiosResponse = {
      data: {
        id: 'collection_123',
        channelId: 'channel_123',
        sequenceId: 'tx_1234567890',
        amount: 100.5,
        currency: 'NGN',
        country: 'NG',
        recipient: mockPayload.sender,
        bankInfo: {
          name: 'Access Bank',
          accountNumber: '1234567890',
          accountName: 'John Doe',
          paymentLink: 'https://example.com/pay',
        },
        source: {
          accountType: 'bank',
        },
        status: 'pending',
        customerUID: 'cust_987654321',
        convertedAmount: 100.5,
        rate: 1.0,
        expiresAt: '2024-01-02T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should successfully create pay in request', async () => {
      (adapter.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await adapter.createPayInRequest(mockPayload);

      expect(result).toEqual({
        ref: mockResponse.data.id,
        channelRef: mockResponse.data.channelId,
        transactionRef: mockResponse.data.sequenceId,
        amount: mockResponse.data.amount,
        currency: mockResponse.data.currency,
        country: mockResponse.data.country,
        sender: mockResponse.data.recipient,
        bankInfo: mockResponse.data.bankInfo,
        source: {
          accountType: mockResponse.data.source.accountType,
          accountNumber: mockResponse.data.source.accountNumber,
          networkRef: mockResponse.data.source.networkId,
        },
        status: mockResponse.data.status,
        userId: mockResponse.data.customerUID,
        convertedAmount: mockResponse.data.convertedAmount,
        rate: mockResponse.data.rate,
        expiresAt: mockResponse.data.expiresAt,
        createdAt: mockResponse.data.createdAt,
        updatedAt: mockResponse.data.updatedAt,
        feeLocal: mockResponse.data.serviceFeeAmountLocal,
        feeUSD: mockResponse.data.serviceFeeAmountUSD,
        networkFeeLocal: mockResponse.data.networkFeeAmountLocal,
        networkFeeUSD: mockResponse.data.networkFeeAmountUSD,
        partnerFeeLocal: mockResponse.data.partnerFeeAmountLocal,
        partnerFeeUSD: mockResponse.data.partnerFeeAmountUSD,
        receiverCryptoInfo: {
          walletAddress: mockResponse.data.settlementInfo?.walletAddress,
          cryptoCurrency: mockResponse.data.settlementInfo?.cryptoCurrency,
          cryptoNetwork: mockResponse.data.settlementInfo?.cryptoNetwork,
          cryptoAmount: mockResponse.data.settlementInfo?.cryptoAmount,
          cryptoLocalRate: mockResponse.data.settlementInfo?.cryptoLocalRate,
          cryptoUSDRate: mockResponse.data.settlementInfo?.cryptoUSDRate,
        },
      });
      expect(adapter.post).toHaveBeenCalledWith('/business/collections', {
        channelId: mockPayload.channelRef,
        sequenceId: mockPayload.transactionRef,
        localAmount: undefined,
        amount: mockPayload.amount,
        recipient: {
          name: mockPayload.sender.name,
          country: mockPayload.sender.country,
          address: mockPayload.sender.address,
          dob: mockPayload.sender.dob,
          email: mockPayload.sender.email,
          idNumber: mockPayload.sender.idNumber,
          idType: mockPayload.sender.idType,
          additionalIdType: mockPayload.sender.additionalIdType,
          additionalIdNumber: mockPayload.sender.additionalIdNumber,
          phone: mockPayload.sender.phone,
        },
        source: {
          accountType: mockPayload.transferType,
          networkId: mockPayload.networkRef,
          accountNumber: '1111111111',
        },
        forceAccept: undefined,
        customerType: mockPayload.customerType,
        redirectUrl: mockPayload.redirectUrl,
        customerUID: mockPayload.userId,
        currency: mockPayload.currencyCode,
        country: mockPayload.sender.country,
        reason: 'other',
        directSettlement: true,
        settlementInfo: {
          walletAddress: mockPayload.receiver.walletAddress,
          cryptoCurrency: mockPayload.receiver.cryptoCurrency,
          cryptoNetwork: mockPayload.receiver.cryptoNetwork,
        },
      });
    });

    it('should handle error when creating pay in request', async () => {
      const error = {
        message: 'Invalid channel',
        response: {
          data: {
            message: 'Invalid channel',
          },
        },
      };
      (adapter.post as jest.Mock).mockRejectedValue(error);

      await expect(adapter.createPayInRequest(mockPayload)).rejects.toThrow(BadRequestException);
    });
  });

  describe('acceptPayInRequest', () => {
    const mockPayload = {
      ref: 'collection_123',
    };

    const mockResponse: AxiosResponse = {
      data: {
        id: 'collection_123',
        channelId: 'channel_123',
        sequenceId: 'tx_1234567890',
        amount: 100.5,
        currency: 'NGN',
        country: 'NG',
        recipient: {
          name: 'John Doe',
          country: 'NG',
          address: '123 Lagos Street, Lagos',
          dob: '1990-05-15',
          email: 'john.doe@example.com',
          idNumber: '12345678901',
          idType: 'NIN',
          phone: '+2341234567890',
        },
        bankInfo: {
          name: 'Access Bank',
          accountNumber: '1234567890',
          accountName: 'John Doe',
          paymentLink: 'https://example.com/pay',
        },
        source: {
          accountType: 'bank',
        },
        status: 'accepted',
        customerUID: 'cust_987654321',
        convertedAmount: 100.5,
        rate: 1.0,
        expiresAt: '2024-01-02T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should successfully accept pay in request', async () => {
      (adapter.post as jest.Mock).mockResolvedValue(mockResponse);
      const result = await adapter.acceptPayInRequest(mockPayload);
      expect(result).toEqual({
        ref: mockResponse.data.id,
        channelRef: mockResponse.data.channelId,
        transactionRef: mockResponse.data.sequenceId,
        amount: mockResponse.data.amount,
        currency: mockResponse.data.currency,
        country: mockResponse.data.country,
        sender: mockResponse.data.recipient,
        bankInfo: mockResponse.data.bankInfo,
        source: {
          accountType: mockResponse.data.source.accountType,
          accountNumber: mockResponse.data.source.accountNumber,
          networkRef: mockResponse.data.source.networkId,
        },
        status: mockResponse.data.status,
        userId: mockResponse.data.customerUID,
        convertedAmount: mockResponse.data.convertedAmount,
        rate: mockResponse.data.rate,
        expiresAt: mockResponse.data.expiresAt,
        createdAt: mockResponse.data.createdAt,
        updatedAt: mockResponse.data.updatedAt,
        feeLocal: mockResponse.data.serviceFeeAmountLocal,
        feeUSD: mockResponse.data.serviceFeeAmountUSD,
        networkFeeLocal: mockResponse.data.networkFeeAmountLocal,
        networkFeeUSD: mockResponse.data.networkFeeAmountUSD,
        partnerFeeLocal: mockResponse.data.partnerFeeAmountLocal,
        partnerFeeUSD: mockResponse.data.partnerFeeAmountUSD,
        receiverCryptoInfo: {
          walletAddress: mockResponse.data.settlementInfo?.walletAddress,
          cryptoCurrency: mockResponse.data.settlementInfo?.cryptoCurrency,
          cryptoNetwork: mockResponse.data.settlementInfo?.cryptoNetwork,
          cryptoAmount: mockResponse.data.settlementInfo?.cryptoAmount,
          cryptoLocalRate: mockResponse.data.settlementInfo?.cryptoLocalRate,
          cryptoUSDRate: mockResponse.data.settlementInfo?.cryptoUSDRate,
        },
      });
      expect(adapter.post).toHaveBeenCalledWith(`/business/collections/${mockPayload.ref}/accept`);
    });

    it('should handle error when accepting pay in request', async () => {
      const error = {
        message: 'Collection not found',
        response: {
          data: {
            message: 'Collection not found',
          },
        },
      };
      (adapter.post as jest.Mock).mockRejectedValue(error);

      await expect(adapter.acceptPayInRequest(mockPayload)).rejects.toThrow(BadRequestException);
    });
  });

  describe('rejectPayInRequest', () => {
    const mockPayload = {
      ref: 'collection_123',
    };

    const mockResponse: AxiosResponse = {
      data: {
        id: 'collection_123',
        channelId: 'channel_123',
        sequenceId: 'tx_1234567890',
        amount: 100.5,
        currency: 'NGN',
        country: 'NG',
        recipient: {
          name: 'John Doe',
          country: 'NG',
          address: '123 Lagos Street, Lagos',
          dob: '1990-05-15',
          email: 'john.doe@example.com',
          idNumber: '12345678901',
          idType: 'NIN',
          phone: '+2341234567890',
        },
        bankInfo: {
          name: 'Access Bank',
          accountNumber: '1234567890',
          accountName: 'John Doe',
          paymentLink: 'https://example.com/pay',
        },
        source: {
          accountType: 'bank',
        },
        status: 'rejected',
        customerUID: 'cust_987654321',
        convertedAmount: 100.5,
        rate: 1.0,
        expiresAt: '2024-01-02T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should successfully reject pay in request', async () => {
      (adapter.post as jest.Mock).mockResolvedValue(mockResponse);
      const result = await adapter.rejectPayInRequest(mockPayload);
      expect(result).toEqual({
        ref: mockResponse.data.id,
        channelRef: mockResponse.data.channelId,
        transactionRef: mockResponse.data.sequenceId,
        amount: mockResponse.data.amount,
        currency: mockResponse.data.currency,
        country: mockResponse.data.country,
        sender: mockResponse.data.recipient,
        bankInfo: mockResponse.data.bankInfo,
        source: {
          accountType: mockResponse.data.source.accountType,
          accountNumber: mockResponse.data.source.accountNumber,
          networkRef: mockResponse.data.source.networkId,
        },
        status: mockResponse.data.status,
        userId: mockResponse.data.customerUID,
        convertedAmount: mockResponse.data.convertedAmount,
        rate: mockResponse.data.rate,
        expiresAt: mockResponse.data.expiresAt,
        createdAt: mockResponse.data.createdAt,
        updatedAt: mockResponse.data.updatedAt,
        feeLocal: mockResponse.data.serviceFeeAmountLocal,
        feeUSD: mockResponse.data.serviceFeeAmountUSD,
        networkFeeLocal: mockResponse.data.networkFeeAmountLocal,
        networkFeeUSD: mockResponse.data.networkFeeAmountUSD,
        partnerFeeLocal: mockResponse.data.partnerFeeAmountLocal,
        partnerFeeUSD: mockResponse.data.partnerFeeAmountUSD,
        receiverCryptoInfo: {
          walletAddress: mockResponse.data.settlementInfo?.walletAddress,
          cryptoCurrency: mockResponse.data.settlementInfo?.cryptoCurrency,
          cryptoNetwork: mockResponse.data.settlementInfo?.cryptoNetwork,
          cryptoAmount: mockResponse.data.settlementInfo?.cryptoAmount,
          cryptoLocalRate: mockResponse.data.settlementInfo?.cryptoLocalRate,
          cryptoUSDRate: mockResponse.data.settlementInfo?.cryptoUSDRate,
        },
      });
      expect(adapter.post).toHaveBeenCalledWith(`/business/collections/${mockPayload.ref}/reject`);
    });

    it('should handle error when rejecting pay in request', async () => {
      const error = {
        message: 'Collection not found',
        response: {
          data: {
            message: 'Collection not found',
          },
        },
      };
      (adapter.post as jest.Mock).mockRejectedValue(error);

      await expect(adapter.rejectPayInRequest(mockPayload)).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelPayInRequest', () => {
    const mockPayload = {
      ref: 'collection_123',
    };

    const mockResponse: AxiosResponse = {
      data: {
        id: 'collection_123',
        channelId: 'channel_123',
        sequenceId: 'tx_1234567890',
        amount: 100.5,
        currency: 'NGN',
        country: 'NG',
        recipient: {
          name: 'John Doe',
          country: 'NG',
          address: '123 Lagos Street, Lagos',
          dob: '1990-05-15',
          email: 'john.doe@example.com',
          idNumber: '12345678901',
          idType: 'NIN',
          phone: '+2341234567890',
        },
        bankInfo: {
          name: 'Access Bank',
          accountNumber: '1234567890',
          accountName: 'John Doe',
          paymentLink: 'https://example.com/pay',
        },
        source: {
          accountType: 'bank',
        },
        status: 'cancelled',
        customerUID: 'cust_987654321',
        convertedAmount: 100.5,
        rate: 1.0,
        expiresAt: '2024-01-02T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should successfully cancel pay in request', async () => {
      (adapter.post as jest.Mock).mockResolvedValue(mockResponse);
      const result = await adapter.cancelPayInRequest(mockPayload);
      expect(result).toEqual({
        ref: mockResponse.data.id,
        channelRef: mockResponse.data.channelId,
        transactionRef: mockResponse.data.sequenceId,
        amount: mockResponse.data.amount,
        currency: mockResponse.data.currency,
        country: mockResponse.data.country,
        sender: mockResponse.data.recipient,
        bankInfo: mockResponse.data.bankInfo,
        source: {
          accountType: mockResponse.data.source.accountType,
          accountNumber: mockResponse.data.source.accountNumber,
          networkRef: mockResponse.data.source.networkId,
        },
        status: mockResponse.data.status,
        userId: mockResponse.data.customerUID,
        convertedAmount: mockResponse.data.convertedAmount,
        rate: mockResponse.data.rate,
        expiresAt: mockResponse.data.expiresAt,
        createdAt: mockResponse.data.createdAt,
        updatedAt: mockResponse.data.updatedAt,
        feeLocal: mockResponse.data.serviceFeeAmountLocal,
        feeUSD: mockResponse.data.serviceFeeAmountUSD,
        networkFeeLocal: mockResponse.data.networkFeeAmountLocal,
        networkFeeUSD: mockResponse.data.networkFeeAmountUSD,
        partnerFeeLocal: mockResponse.data.partnerFeeAmountLocal,
        partnerFeeUSD: mockResponse.data.partnerFeeAmountUSD,
        receiverCryptoInfo: {
          walletAddress: mockResponse.data.settlementInfo?.walletAddress,
          cryptoCurrency: mockResponse.data.settlementInfo?.cryptoCurrency,
          cryptoNetwork: mockResponse.data.settlementInfo?.cryptoNetwork,
          cryptoAmount: mockResponse.data.settlementInfo?.cryptoAmount,
          cryptoLocalRate: mockResponse.data.settlementInfo?.cryptoLocalRate,
          cryptoUSDRate: mockResponse.data.settlementInfo?.cryptoUSDRate,
        },
      });
      expect(adapter.post).toHaveBeenCalledWith(`/business/collections/${mockPayload.ref}/cancel`);
    });

    it('should handle error when cancelling pay in request', async () => {
      const error = {
        message: 'Collection not found',
        response: {
          data: {
            message: 'Collection not found',
          },
        },
      };
      (adapter.post as jest.Mock).mockRejectedValue(error);

      await expect(adapter.cancelPayInRequest(mockPayload)).rejects.toThrow(BadRequestException);
    });
  });

  describe('refundPayInRequest', () => {
    const mockPayload = {
      ref: 'collection_123',
    };

    const mockResponse: AxiosResponse = {
      data: {
        id: 'collection_123',
        channelId: 'channel_123',
        sequenceId: 'tx_1234567890',
        amount: 100.5,
        currency: 'NGN',
        country: 'NG',
        recipient: {
          name: 'John Doe',
          country: 'NG',
          address: '123 Lagos Street, Lagos',
          dob: '1990-05-15',
          email: 'john.doe@example.com',
          idNumber: '12345678901',
          idType: 'NIN',
          phone: '+2341234567890',
        },
        bankInfo: {
          name: 'Access Bank',
          accountNumber: '1234567890',
          accountName: 'John Doe',
          paymentLink: 'https://example.com/pay',
        },
        source: {
          accountType: 'bank',
        },
        status: 'refunded',
        customerUID: 'cust_987654321',
        convertedAmount: 100.5,
        rate: 1.0,
        expiresAt: '2024-01-02T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should successfully refund pay in request', async () => {
      (adapter.post as jest.Mock).mockResolvedValue(mockResponse);
      const result = await adapter.refundPayInRequest(mockPayload);
      expect(result).toEqual({
        ref: mockResponse.data.id,
        channelRef: mockResponse.data.channelId,
        transactionRef: mockResponse.data.sequenceId,
        amount: mockResponse.data.amount,
        currency: mockResponse.data.currency,
        country: mockResponse.data.country,
        sender: mockResponse.data.recipient,
        bankInfo: mockResponse.data.bankInfo,
        source: {
          accountType: mockResponse.data.source.accountType,
          accountNumber: mockResponse.data.source.accountNumber,
          networkRef: mockResponse.data.source.networkId,
        },
        status: mockResponse.data.status,
        userId: mockResponse.data.customerUID,
        convertedAmount: mockResponse.data.convertedAmount,
        rate: mockResponse.data.rate,
        expiresAt: mockResponse.data.expiresAt,
        createdAt: mockResponse.data.createdAt,
        updatedAt: mockResponse.data.updatedAt,
        feeLocal: mockResponse.data.serviceFeeAmountLocal,
        feeUSD: mockResponse.data.serviceFeeAmountUSD,
        networkFeeLocal: mockResponse.data.networkFeeAmountLocal,
        networkFeeUSD: mockResponse.data.networkFeeAmountUSD,
        partnerFeeLocal: mockResponse.data.partnerFeeAmountLocal,
        partnerFeeUSD: mockResponse.data.partnerFeeAmountUSD,
        receiverCryptoInfo: {
          walletAddress: mockResponse.data.settlementInfo?.walletAddress,
          cryptoCurrency: mockResponse.data.settlementInfo?.cryptoCurrency,
          cryptoNetwork: mockResponse.data.settlementInfo?.cryptoNetwork,
          cryptoAmount: mockResponse.data.settlementInfo?.cryptoAmount,
          cryptoLocalRate: mockResponse.data.settlementInfo?.cryptoLocalRate,
          cryptoUSDRate: mockResponse.data.settlementInfo?.cryptoUSDRate,
        },
      });
      expect(adapter.post).toHaveBeenCalledWith(`/business/collections/${mockPayload.ref}/refund`);
    });

    it('should handle error when refunding pay in request', async () => {
      const error = {
        message: 'Collection not found',
        response: {
          data: {
            message: 'Collection not found',
          },
        },
      };
      (adapter.post as jest.Mock).mockRejectedValue(error);

      await expect(adapter.refundPayInRequest(mockPayload)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPayInRequest', () => {
    const mockPayload = {
      ref: 'collection_123',
    };

    const mockResponse: AxiosResponse = {
      data: {
        id: 'collection_123',
        channelId: 'channel_123',
        sequenceId: 'tx_1234567890',
        amount: 100.5,
        currency: 'NGN',
        country: 'NG',
        recipient: {
          name: 'John Doe',
          country: 'NG',
          address: '123 Lagos Street, Lagos',
          dob: '1990-05-15',
          email: 'john.doe@example.com',
          idNumber: '12345678901',
          idType: 'NIN',
          phone: '+2341234567890',
        },
        bankInfo: {
          name: 'Access Bank',
          accountNumber: '1234567890',
          accountName: 'John Doe',
          paymentLink: 'https://example.com/pay',
        },
        source: {
          accountType: 'bank',
          networkId: 'network_123',
        },
        status: 'pending',
        customerUID: 'cust_987654321',
        convertedAmount: 100.5,
        rate: 1.0,
        expiresAt: '2024-01-02T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        serviceFeeAmountLocal: 50,
        serviceFeeAmountUSD: 0.25,
        settlementInfo: {
          walletAddress: 'GCHqyq3uMed9PCVpaqFC8pbQMDCSPtPcYHU5fkKkAT4R',
          cryptoCurrency: 'USDC',
          cryptoNetwork: 'SOL',
        },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should successfully get pay in request', async () => {
      (adapter.get as jest.Mock).mockResolvedValue(mockResponse);
      const result = await adapter.getPayInRequest(mockPayload);
      expect(result).toEqual({
        ref: mockResponse.data.id,
        channelRef: mockResponse.data.channelId,
        transactionRef: mockResponse.data.sequenceId,
        amount: mockResponse.data.amount,
        currency: mockResponse.data.currency,
        country: mockResponse.data.country,
        sender: mockResponse.data.recipient,
        bankInfo: mockResponse.data.bankInfo,
        source: {
          accountType: mockResponse.data.source.accountType,
          accountNumber: mockResponse.data.source.accountNumber,
          networkRef: mockResponse.data.source.networkId,
        },
        status: mockResponse.data.status,
        userId: mockResponse.data.customerUID,
        convertedAmount: mockResponse.data.convertedAmount,
        rate: mockResponse.data.rate,
        expiresAt: mockResponse.data.expiresAt,
        createdAt: mockResponse.data.createdAt,
        updatedAt: mockResponse.data.updatedAt,
        feeLocal: mockResponse.data.serviceFeeAmountLocal,
        feeUSD: mockResponse.data.serviceFeeAmountUSD,
        networkFeeLocal: mockResponse.data.networkFeeAmountLocal,
        networkFeeUSD: mockResponse.data.networkFeeAmountUSD,
        partnerFeeLocal: mockResponse.data.partnerFeeAmountLocal,
        partnerFeeUSD: mockResponse.data.partnerFeeAmountUSD,
        receiverCryptoInfo: {
          walletAddress: mockResponse.data.settlementInfo?.walletAddress,
          cryptoCurrency: mockResponse.data.settlementInfo?.cryptoCurrency,
          cryptoNetwork: mockResponse.data.settlementInfo?.cryptoNetwork,
          cryptoAmount: mockResponse.data.settlementInfo?.cryptoAmount,
          cryptoLocalRate: mockResponse.data.settlementInfo?.cryptoLocalRate,
          cryptoUSDRate: mockResponse.data.settlementInfo?.cryptoUSDRate,
        },
      });
      expect(adapter.get).toHaveBeenCalledWith(`/business/collections/${mockPayload.ref}`);
    });

    it('should handle error when getting pay in request', async () => {
      const error = {
        message: 'Collection not found',
        response: {
          data: {
            message: 'Collection not found',
          },
        },
      };
      (adapter.get as jest.Mock).mockRejectedValue(error);

      await expect(adapter.getPayInRequest(mockPayload)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPayInRequestByTransactionRef', () => {
    const transactionId = 'tx_1234567890';

    const mockResponse: AxiosResponse = {
      data: {
        id: 'collection_123',
        channelId: 'channel_123',
        sequenceId: transactionId,
        amount: 100.5,
        currency: 'NGN',
        country: 'NG',
        recipient: {
          name: 'John Doe',
          country: 'NG',
          address: '123 Lagos Street, Lagos',
          dob: '1990-05-15',
          email: 'john.doe@example.com',
          idNumber: '12345678901',
          idType: 'NIN',
          phone: '+2341234567890',
        },
        bankInfo: {
          name: 'Access Bank',
          accountNumber: '1234567890',
          accountName: 'John Doe',
          paymentLink: 'https://example.com/pay',
        },
        source: {
          accountType: 'bank',
        },
        status: 'pending',
        customerUID: 'cust_987654321',
        convertedAmount: 100.5,
        rate: 1.0,
        expiresAt: '2024-01-02T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should successfully get pay in request by transaction ref', async () => {
      (adapter.get as jest.Mock).mockResolvedValue(mockResponse);
      const result = await adapter.getPayInRequestByTransactionRef(transactionId);
      expect(result).toEqual({
        ref: mockResponse.data.id,
        channelRef: mockResponse.data.channelId,
        transactionRef: mockResponse.data.sequenceId,
        amount: mockResponse.data.amount,
        currency: mockResponse.data.currency,
        country: mockResponse.data.country,
        sender: mockResponse.data.recipient,
        bankInfo: mockResponse.data.bankInfo,
        source: {
          accountType: mockResponse.data.source.accountType,
          accountNumber: mockResponse.data.source.accountNumber,
          networkRef: mockResponse.data.source.networkId,
        },
        status: mockResponse.data.status,
        userId: mockResponse.data.customerUID,
        convertedAmount: mockResponse.data.convertedAmount,
        rate: mockResponse.data.rate,
        expiresAt: mockResponse.data.expiresAt,
        createdAt: mockResponse.data.createdAt,
        updatedAt: mockResponse.data.updatedAt,
        feeLocal: mockResponse.data.serviceFeeAmountLocal,
        feeUSD: mockResponse.data.serviceFeeAmountUSD,
        networkFeeLocal: mockResponse.data.networkFeeAmountLocal,
        networkFeeUSD: mockResponse.data.networkFeeAmountUSD,
        partnerFeeLocal: mockResponse.data.partnerFeeAmountLocal,
        partnerFeeUSD: mockResponse.data.partnerFeeAmountUSD,
        receiverCryptoInfo: {
          walletAddress: mockResponse.data.settlementInfo?.walletAddress,
          cryptoCurrency: mockResponse.data.settlementInfo?.cryptoCurrency,
          cryptoNetwork: mockResponse.data.settlementInfo?.cryptoNetwork,
          cryptoAmount: mockResponse.data.settlementInfo?.cryptoAmount,
          cryptoLocalRate: mockResponse.data.settlementInfo?.cryptoLocalRate,
          cryptoUSDRate: mockResponse.data.settlementInfo?.cryptoUSDRate,
        },
      });
      expect(adapter.get).toHaveBeenCalledWith(`/business/collections/sequence-id/${transactionId}`);
    });

    it('should handle error when getting pay in request by transaction ref', async () => {
      const error = {
        message: 'Transaction not found',
        response: {
          data: {
            message: 'Transaction not found',
          },
        },
      };
      (adapter.get as jest.Mock).mockRejectedValue(error);

      await expect(adapter.getPayInRequestByTransactionRef(transactionId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAllPayInRequests', () => {
    const mockParams = {
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      page: 1,
      limit: 10,
      filterBy: 'status',
    };

    const mockCollections = [
      {
        id: 'collection_123',
        channelId: 'channel_123',
        sequenceId: 'tx_1234567890',
        amount: 100.5,
        currency: 'NGN',
        country: 'NG',
        recipient: {
          name: 'John Doe',
          country: 'NG',
          address: '123 Lagos Street, Lagos',
          dob: '1990-05-15',
          email: 'john.doe@example.com',
          idNumber: '12345678901',
          idType: 'NIN',
          phone: '+2341234567890',
        },
        bankInfo: {
          name: 'Access Bank',
          accountNumber: '1234567890',
          accountName: 'John Doe',
          paymentLink: 'https://example.com/pay',
        },
        source: {
          accountType: 'bank',
          networkId: 'network_123',
          accountNumber: undefined,
        },
        status: 'pending',
        customerUID: 'cust_987654321',
        convertedAmount: 100.5,
        rate: 1.0,
        expiresAt: '2024-01-02T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        serviceFeeAmountLocal: 50,
        serviceFeeAmountUSD: 0.25,
        networkFeeAmountLocal: undefined,
        networkFeeAmountUSD: undefined,
        partnerFeeAmountLocal: undefined,
        partnerFeeAmountUSD: undefined,
        settlementInfo: {
          walletAddress: 'GCHqyq3uMed9PCVpaqFC8pbQMDCSPtPcYHU5fkKkAT4R',
          cryptoCurrency: 'USDC',
          cryptoNetwork: 'SOL',
          cryptoAmount: undefined,
          cryptoLocalRate: undefined,
          cryptoUSDRate: undefined,
        },
      },
    ];

    const mockResponse: AxiosResponse = {
      data: {
        collections: mockCollections,
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should successfully get all pay in requests', async () => {
      (adapter.get as jest.Mock).mockResolvedValue(mockResponse);
      const result = await adapter.getAllPayInRequests(mockParams);
      expect(result).toEqual(
        mockCollections.map((collection) => ({
          ref: collection.id,
          channelRef: collection.channelId,
          transactionRef: collection.sequenceId,
          amount: collection.amount,
          currency: collection.currency,
          country: collection.country,
          sender: collection.recipient,
          bankInfo: collection.bankInfo,
          source: {
            accountType: collection.source?.accountType,
            accountNumber: collection.source?.accountNumber,
            networkRef: collection.source?.networkId,
          },
          status: collection.status,
          userId: collection.customerUID,
          convertedAmount: collection.convertedAmount,
          rate: collection.rate,
          expiresAt: collection.expiresAt,
          createdAt: collection.createdAt,
          updatedAt: collection.updatedAt,
          feeLocal: collection.serviceFeeAmountLocal,
          feeUSD: collection.serviceFeeAmountUSD,
          networkFeeLocal: collection.networkFeeAmountLocal,
          networkFeeUSD: collection.networkFeeAmountUSD,
          partnerFeeLocal: collection.partnerFeeAmountLocal,
          partnerFeeUSD: collection.partnerFeeAmountUSD,
          receiverCryptoInfo: {
            walletAddress: collection.settlementInfo?.walletAddress,
            cryptoCurrency: collection.settlementInfo?.cryptoCurrency,
            cryptoNetwork: collection.settlementInfo?.cryptoNetwork,
            cryptoAmount: collection.settlementInfo?.cryptoAmount,
            cryptoLocalRate: collection.settlementInfo?.cryptoLocalRate,
            cryptoUSDRate: collection.settlementInfo?.cryptoUSDRate,
          },
        })),
      );
      expect(adapter.get).toHaveBeenCalled();
    });

    it('should handle error when getting all pay in requests', async () => {
      const error = {
        message: 'Failed to fetch collections',
        response: {
          data: {
            message: 'Failed to fetch collections',
          },
        },
      };
      (adapter.get as jest.Mock).mockRejectedValue(error);

      await expect(adapter.getAllPayInRequests(mockParams)).rejects.toThrow(BadRequestException);
    });

    it('should handle empty collections response', async () => {
      const emptyResponse: AxiosResponse = {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      (adapter.get as jest.Mock).mockResolvedValue(emptyResponse);
      const result = await adapter.getAllPayInRequests(mockParams);
      expect(result).toEqual([]);
    });
  });
});
