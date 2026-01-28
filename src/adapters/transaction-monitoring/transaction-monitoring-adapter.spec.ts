import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TransactionMonitoringAdapter } from './transaction-monitoring-adapter';
import { SumsubTransactionMonitoringAdapter } from './sumsub/sumsub-transaction-monitoring.adapter';

describe('TransactionMonitoringAdapter', () => {
  let adapter: TransactionMonitoringAdapter;
  let sumsubAdapter: jest.Mocked<SumsubTransactionMonitoringAdapter>;

  const mockIpCheckPayload = {
    ipAddress: '192.168.1.1',
    userId: 'test-user-id',
  };

  const mockIpCheckForApplicantPayload = {
    ipAddress: '192.168.1.1',
    applicantId: 'test-applicant-id',
  };

  const mockIpCheckResponse = {
    city: 'San Francisco',
    region: 'CA',
    country: 'US',
    isVpn: false,
  };

  beforeEach(async () => {
    const mockSumsubAdapter = {
      ipCheck: jest.fn(),
      ipCheckForApplicant: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionMonitoringAdapter,
        { provide: SumsubTransactionMonitoringAdapter, useValue: mockSumsubAdapter },
      ],
    }).compile();

    adapter = module.get<TransactionMonitoringAdapter>(TransactionMonitoringAdapter);
    sumsubAdapter = module.get(SumsubTransactionMonitoringAdapter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  describe('getProviderName', () => {
    it('should return sumsub as default provider', () => {
      const providerName = adapter.getProviderName();
      expect(providerName).toBe('sumsub');
    });
  });

  describe('ipCheck', () => {
    it('should delegate to sumsub adapter for IP check', async () => {
      // Arrange
      sumsubAdapter.ipCheck.mockResolvedValue(mockIpCheckResponse);

      // Act
      const result = await adapter.ipCheck(mockIpCheckPayload);

      // Assert
      expect(sumsubAdapter.ipCheck).toHaveBeenCalledWith(mockIpCheckPayload);
      expect(result).toEqual(mockIpCheckResponse);
    });

    it('should throw error if provider is not supported', async () => {
      // Arrange
      jest.spyOn(adapter, 'getProviderName').mockReturnValue('unsupported');

      // Act & Assert
      await expect(adapter.ipCheck(mockIpCheckPayload)).rejects.toThrow(BadRequestException);
    });
  });

  describe('ipCheckForApplicant', () => {
    it('should delegate to sumsub adapter for applicant IP check', async () => {
      // Arrange
      sumsubAdapter.ipCheckForApplicant.mockResolvedValue(mockIpCheckResponse);

      // Act
      const result = await adapter.ipCheckForApplicant(mockIpCheckForApplicantPayload);

      // Assert
      expect(sumsubAdapter.ipCheckForApplicant).toHaveBeenCalledWith(mockIpCheckForApplicantPayload);
      expect(result).toEqual(mockIpCheckResponse);
    });

    it('should throw error if provider is not supported', async () => {
      // Arrange
      jest.spyOn(adapter, 'getProviderName').mockReturnValue('unsupported');

      // Act & Assert
      await expect(adapter.ipCheckForApplicant(mockIpCheckForApplicantPayload)).rejects.toThrow(BadRequestException);
    });
  });
});
