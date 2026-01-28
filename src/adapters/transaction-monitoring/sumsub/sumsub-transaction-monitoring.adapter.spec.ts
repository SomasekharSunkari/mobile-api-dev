import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { AxiosResponse } from 'axios';
import { SumsubTransactionMonitoringAdapter } from './sumsub-transaction-monitoring.adapter';
import { UtilsService } from '../../../utils/utils.service';
import {
  SubmitTransactionPayload,
  TransactionType,
  TransactionDirection,
} from '../transaction-monitoring-adapter.interface';

// Mock UtilsService
jest.mock('../../../utils/utils.service');

describe('SumsubTransactionMonitoringAdapter', () => {
  let adapter: SumsubTransactionMonitoringAdapter;

  const mockIpCheckPayload = {
    ipAddress: '192.168.1.1',
    userId: 'test-user-id',
  };

  const mockIpCheckForApplicantPayload = {
    ipAddress: '192.168.1.1',
    applicantId: 'test-applicant-id',
  };

  const mockSumsubResponse = {
    status: 200,
    data: {
      data: {
        applicant: {
          device: {
            ipInfo: {
              city: 'San Francisco',
              state: 'CA',
              countryCode2: 'US',
              vpn: false,
            },
          },
        },
      },
    },
  } as AxiosResponse;

  const expectedTransformedResponse = {
    city: 'San Francisco',
    region: 'CA',
    country: 'US',
    isVpn: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SumsubTransactionMonitoringAdapter],
    }).compile();

    adapter = module.get<SumsubTransactionMonitoringAdapter>(SumsubTransactionMonitoringAdapter);

    // Mock UtilsService.generateTransactionReference
    (UtilsService.generateTransactionReference as jest.Mock).mockReturnValue('mock-txn-id');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  describe('ipCheck', () => {
    it('should successfully perform IP check and transform response', async () => {
      // Arrange
      jest.spyOn(adapter, 'post').mockResolvedValue(mockSumsubResponse);

      // Act
      const result = await adapter.ipCheck(mockIpCheckPayload);

      // Assert
      expect(adapter.post).toHaveBeenCalledWith(
        '/resources/applicants/-/kyt/txns/-/data',
        expect.objectContaining({
          txnId: 'mock-txn-id',
          type: 'userPlatformEvent',
          applicant: {
            externalUserId: mockIpCheckPayload.userId,
            device: {
              ipInfo: {
                ip: mockIpCheckPayload.ipAddress,
              },
            },
          },
        }),
      );
      expect(result).toEqual(expectedTransformedResponse);
    });

    it('should handle missing IP info data gracefully', async () => {
      // Arrange
      const responseWithoutIpInfo = {
        ...mockSumsubResponse,
        data: {
          data: {
            applicant: {
              device: {},
            },
          },
        },
      };
      jest.spyOn(adapter, 'post').mockResolvedValue(responseWithoutIpInfo);

      // Act
      const result = await adapter.ipCheck(mockIpCheckPayload);

      // Assert
      expect(result).toEqual({
        city: null,
        region: null,
        country: null,
        isVpn: false,
      });
    });

    it('should throw InternalServerErrorException on API error', async () => {
      // Arrange
      const error = new Error('API Error');
      jest.spyOn(adapter, 'post').mockRejectedValue(error);

      // Act & Assert
      await expect(adapter.ipCheck(mockIpCheckPayload)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('ipCheckForApplicant', () => {
    it('should successfully perform applicant IP check and transform response', async () => {
      // Arrange
      jest.spyOn(adapter, 'post').mockResolvedValue(mockSumsubResponse);

      // Act
      const result = await adapter.ipCheckForApplicant(mockIpCheckForApplicantPayload);

      // Assert
      expect(adapter.post).toHaveBeenCalledWith(
        `/resources/applicants/${mockIpCheckForApplicantPayload.applicantId}/kyt/txns/-/data`,
        expect.objectContaining({
          txnId: 'mock-txn-id',
          applicantId: mockIpCheckForApplicantPayload.applicantId,
          type: 'userPlatformEvent',
          applicant: {
            device: {
              ipInfo: {
                ip: mockIpCheckForApplicantPayload.ipAddress,
              },
            },
          },
        }),
      );
      expect(result).toEqual(expectedTransformedResponse);
    });

    it('should handle missing IP info data gracefully', async () => {
      // Arrange
      const responseWithoutIpInfo = {
        ...mockSumsubResponse,
        data: {
          data: {
            applicant: {
              device: {},
            },
          },
        },
      };
      jest.spyOn(adapter, 'post').mockResolvedValue(responseWithoutIpInfo);

      // Act
      const result = await adapter.ipCheckForApplicant(mockIpCheckForApplicantPayload);

      // Assert
      expect(result).toEqual({
        city: null,
        region: null,
        country: null,
        isVpn: false,
      });
    });

    it('should throw InternalServerErrorException on API error', async () => {
      // Arrange
      const error = new Error('API Error');
      jest.spyOn(adapter, 'post').mockRejectedValue(error);

      // Act & Assert
      await expect(adapter.ipCheckForApplicant(mockIpCheckForApplicantPayload)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('submitTransaction', () => {
    const mockSubmitTransactionPayload: SubmitTransactionPayload = {
      applicantId: 'test-applicant-id',
      transactionId: 'test-txn-id',
      transactionDate: '2025-09-25 02:41:37+0000',
      timeZone: 'UTC',
      transactionType: TransactionType.FINANCE,
      direction: TransactionDirection.IN,
      amount: 30,
      currency: 'USD',
      description: 'Test deposit transaction',
      participant: {
        type: 'individual',
        externalUserId: 'test-user-id',
        fullName: 'John Doe',
        dateOfBirth: '1990-01-01',
        address: {
          countryCode: 'USA',
          postal: '12345',
          city: 'Test City',
          state: 'CA',
          addressLine1: '123 Test St',
          addressLine2: null,
        },
      },
      counterparty: {
        type: 'individual',
        externalUserId: 'test-user-id',
        fullName: 'John Doe',
        dateOfBirth: '1990-01-01',
        address: {
          countryCode: 'USA',
          postal: '12345',
          city: 'Test City',
          state: 'CA',
          addressLine1: '123 Test St',
          addressLine2: null,
        },
        bankAccount: {
          accountType: 'account',
          accountNumber: '0000',
          countryCode: 'USA',
        },
        bankInfo: {
          bankName: 'Test Bank',
        },
      },
      device: {
        deviceFingerprint: 'test-fingerprint',
        ipInfo: {
          ipAddress: '8.8.8.8',
        },
      },
    };

    const mockSumsubTransactionResponse = {
      status: 200,
      data: {
        id: 'test-sumsub-id',
        data: {
          txnId: 'test-txn-id',
        },
        score: 60,
        review: {
          reviewStatus: 'onHold',
          reviewResult: {
            reviewAnswer: undefined,
          },
        },
        scoringResult: {
          failedRules: [
            {
              title: 'TM10 - Declined transactions in the last 7 days',
            },
            {
              title: 'TM08 - Velocity Rule - >2 Txns in 1 Day',
            },
          ],
        },
      },
    } as AxiosResponse;

    it('should successfully submit transaction and transform response', async () => {
      // Arrange
      jest.spyOn(adapter, 'post').mockResolvedValue(mockSumsubTransactionResponse);

      // Act
      const result = await adapter.submitTransaction(mockSubmitTransactionPayload);

      // Assert
      expect(adapter.post).toHaveBeenCalledWith(
        `/resources/applicants/${mockSubmitTransactionPayload.applicantId}/kyt/txns/-/data`,
        expect.objectContaining({
          txnId: mockSubmitTransactionPayload.transactionId,
          txnDate: mockSubmitTransactionPayload.transactionDate,
          zoneId: mockSubmitTransactionPayload.timeZone,
          type: mockSubmitTransactionPayload.transactionType,
          info: {
            direction: mockSubmitTransactionPayload.direction,
            amount: mockSubmitTransactionPayload.amount,
            currencyCode: mockSubmitTransactionPayload.currency,
            currencyType: 'fiat',
            paymentDetails: mockSubmitTransactionPayload.description,
          },
        }),
      );

      expect(result).toEqual({
        transactionId: 'test-txn-id',
        status: 'onHold',
        riskScore: 60,
        decision: undefined,
        flaggedReasons: ['TM10 - Declined transactions in the last 7 days', 'TM08 - Velocity Rule - >2 Txns in 1 Day'],
        data: mockSumsubTransactionResponse.data,
      });
    });

    it('should handle approved transaction response', async () => {
      // Arrange
      const approvedResponse = {
        ...mockSumsubTransactionResponse,
        data: {
          ...mockSumsubTransactionResponse.data,
          score: 0,
          review: {
            reviewStatus: 'completed',
            reviewResult: {
              reviewAnswer: 'GREEN',
            },
          },
          scoringResult: {
            failedRules: [],
          },
        },
      };
      jest.spyOn(adapter, 'post').mockResolvedValue(approvedResponse);

      // Act
      const result = await adapter.submitTransaction(mockSubmitTransactionPayload);

      // Assert
      expect(result).toEqual({
        transactionId: 'test-txn-id',
        status: 'completed',
        riskScore: 0,
        decision: 'GREEN',
        flaggedReasons: [],
        data: approvedResponse.data,
      });
    });

    it('should handle response without review status', async () => {
      // Arrange
      const responseWithoutReview = {
        ...mockSumsubTransactionResponse,
        data: {
          ...mockSumsubTransactionResponse.data,
          review: undefined,
          score: undefined,
          scoringResult: undefined,
        },
      };
      jest.spyOn(adapter, 'post').mockResolvedValue(responseWithoutReview);

      // Act
      const result = await adapter.submitTransaction(mockSubmitTransactionPayload);

      // Assert
      expect(result).toEqual({
        transactionId: 'test-txn-id',
        status: 'submitted',
        riskScore: undefined,
        decision: undefined,
        flaggedReasons: undefined,
        data: responseWithoutReview.data,
      });
    });

    it('should handle transaction without description', async () => {
      // Arrange
      const payloadWithoutDescription = {
        ...mockSubmitTransactionPayload,
        description: undefined,
      };
      jest.spyOn(adapter, 'post').mockResolvedValue(mockSumsubTransactionResponse);

      // Act
      const result = await adapter.submitTransaction(payloadWithoutDescription);

      // Assert
      expect(adapter.post).toHaveBeenCalledWith(
        `/resources/applicants/${payloadWithoutDescription.applicantId}/kyt/txns/-/data`,
        expect.objectContaining({
          info: {
            direction: payloadWithoutDescription.direction,
            amount: payloadWithoutDescription.amount,
            currencyCode: payloadWithoutDescription.currency,
            currencyType: 'fiat',
            paymentDetails: undefined,
          },
        }),
      );

      expect(result.transactionId).toBe('test-txn-id');
    });

    it('should throw InternalServerErrorException on API error', async () => {
      // Arrange
      const error = new Error('API Error');
      jest.spyOn(adapter, 'post').mockRejectedValue(error);

      // Act & Assert
      await expect(adapter.submitTransaction(mockSubmitTransactionPayload)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
