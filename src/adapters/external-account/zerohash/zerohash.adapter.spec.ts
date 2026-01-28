import { BadGatewayException, NotImplementedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE } from '../../../constants/constants';
import {
  DecisionReportRequest,
  ExecutePaymentRequest,
  FundingQuoteRequest,
  ReturnReportRequest,
  RiskSignalRequest,
} from '../external-account.adapter.interface';
import { ZerohashExternalAccountAdapter } from './zerohash.adapter';
import {
  ZeroHashExecutePaymentWrappedResponse,
  ZeroHashFundingQuoteWrappedResponse,
} from './zerohash.adapter.interface';

// Mock the ZerohashAxiosHelper parent class
jest.mock('../../participant/zerohash/zerohash.axios');

describe('ZerohashExternalAccountAdapter', () => {
  let adapter: ZerohashExternalAccountAdapter;

  const mockPost = jest.fn();
  const mockGet = jest.fn();
  const mockPatch = jest.fn();

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ZerohashExternalAccountAdapter],
    }).compile();

    adapter = module.get<ZerohashExternalAccountAdapter>(ZerohashExternalAccountAdapter);

    // Mock the parent class methods
    adapter['post'] = mockPost;
    adapter['get'] = mockGet;
    adapter['patch'] = mockPatch;
  });

  describe('evaluateRiskSignal', () => {
    it('should throw NotImplementedException', async () => {
      const request: RiskSignalRequest = {
        token: 'test-token',
        accountRef: 'test-account-ref',
        amount: 100,
        currency: 'USD',
      };

      await expect(adapter.evaluateRiskSignal(request)).rejects.toThrow(NotImplementedException);
      await expect(adapter.evaluateRiskSignal(request)).rejects.toThrow(
        'Risk signal evaluation not implemented for ZeroHash',
      );
    });

    it('should log the request details', async () => {
      const request: RiskSignalRequest = {
        token: 'test-token',
        accountRef: 'test-account-ref',
        amount: 100,
        currency: 'USD',
      };

      const loggerSpy = jest.spyOn(adapter['logger'], 'debug');

      await expect(adapter.evaluateRiskSignal(request)).rejects.toThrow();

      expect(loggerSpy).toHaveBeenCalledWith(
        `evaluateRiskSignal not supported by ZeroHash: ${JSON.stringify(request)}`,
      );
    });
  });

  describe('reportDecision', () => {
    it('should throw NotImplementedException', async () => {
      const request: DecisionReportRequest = {
        clientTransactionRef: 'test-transaction-ref',
        initiated: true,
        daysFundsOnHold: 1,
        amountInstantlyAvailable: 50,
      };

      await expect(adapter.reportDecision(request)).rejects.toThrow(NotImplementedException);
      await expect(adapter.reportDecision(request)).rejects.toThrow('Decision reporting not implemented for ZeroHash');
    });

    it('should log the request details', async () => {
      const request: DecisionReportRequest = {
        clientTransactionRef: 'test-transaction-ref',
        initiated: true,
      };

      const loggerSpy = jest.spyOn(adapter['logger'], 'debug');

      await expect(adapter.reportDecision(request)).rejects.toThrow();

      expect(loggerSpy).toHaveBeenCalledWith(`reportDecision not supported by ZeroHash: ${JSON.stringify(request)}`);
    });
  });

  describe('reportReturn', () => {
    it('should throw NotImplementedException', async () => {
      const request: ReturnReportRequest = {
        clientTransactionRef: 'test-transaction-ref',
        returnCode: 'R01',
        returnedAt: '2023-01-01T00:00:00Z',
      };

      await expect(adapter.reportReturn(request)).rejects.toThrow(NotImplementedException);
      await expect(adapter.reportReturn(request)).rejects.toThrow('Return reporting not implemented for ZeroHash');
    });

    it('should log the request details', async () => {
      const request: ReturnReportRequest = {
        clientTransactionRef: 'test-transaction-ref',
        returnCode: 'R01',
      };

      const loggerSpy = jest.spyOn(adapter['logger'], 'debug');

      await expect(adapter.reportReturn(request)).rejects.toThrow();

      expect(loggerSpy).toHaveBeenCalledWith(`reportReturn not supported by ZeroHash: ${JSON.stringify(request)}`);
    });
  });

  describe('requestQuote', () => {
    const mockRequest: FundingQuoteRequest = {
      providerUserRef: 'test-participant',
      targetCurrency: 'USD',
      sourceCurrency: 'USDC',
      operation: 'buy',
      amount: '100.00',
      quoteExpiry: '5m',
    };

    const mockZerohashResponse: ZeroHashFundingQuoteWrappedResponse = {
      message: {
        request_id: 'req-123',
        participant_code: 'test-participant',
        quoted_currency: 'USD',
        underlying_currency: 'USDC',
        side: 'buy',
        quantity: '100.00',
        price: '1.00',
        quote_id: 'quote-456',
        expire_ts: 1640995200,
        account_group: 'default',
        account_label: 'test-account',
        quote_notional: '100.00',
        disclosed_spread: '0.01',
        disclosed_spread_rate: '0.01%',
      },
    };

    it('should successfully request a quote and map response correctly', async () => {
      mockPost.mockResolvedValue({ data: mockZerohashResponse });

      const result = await adapter.requestQuote(mockRequest);

      expect(mockPost).toHaveBeenCalledWith('/payments/rfq', {
        participant_code: 'test-participant',
        quoted_currency: 'USD',
        underlying_currency: 'USDC',
        side: 'buy',
        total: '100.00',
        quote_expiry: '5m',
      });

      expect(result).toEqual({
        quoteRef: 'quote-456',
        amount: '100.00',
        rate: '1.00',
        expiresAt: 1640995200,
      });
    });

    it('should log the request', async () => {
      mockPost.mockResolvedValue({ data: mockZerohashResponse });
      const loggerSpy = jest.spyOn(adapter['logger'], 'log');

      await adapter.requestQuote(mockRequest);

      expect(loggerSpy).toHaveBeenCalledWith(
        `Requesting quote from ZeroHash for participant: ${mockRequest.providerUserRef}`,
      );
    });

    it('should log the response', async () => {
      mockPost.mockResolvedValue({ data: mockZerohashResponse });
      const loggerSpy = jest.spyOn(adapter['logger'], 'debug');

      await adapter.requestQuote(mockRequest);

      expect(loggerSpy).toHaveBeenCalledWith(
        `ZeroHash Request Funding Quote response:\n${JSON.stringify(mockZerohashResponse, null, 2)}`,
      );
    });

    it('should handle request without optional quoteExpiry', async () => {
      const requestWithoutExpiry = { ...mockRequest };
      delete requestWithoutExpiry.quoteExpiry;

      mockPost.mockResolvedValue({ data: mockZerohashResponse });

      await adapter.requestQuote(requestWithoutExpiry);

      expect(mockPost).toHaveBeenCalledWith('/payments/rfq', {
        participant_code: 'test-participant',
        quoted_currency: 'USD',
        underlying_currency: 'USDC',
        side: 'buy',
        total: '100.00',
      });
    });

    it('should throw BadGatewayException on API error with response', async () => {
      const error = {
        message: 'API Error',
        response: {
          status: 400,
          data: { error: 'Invalid request' },
        },
      };

      mockPost.mockRejectedValue(error);

      await expect(adapter.requestQuote(mockRequest)).rejects.toThrow(BadGatewayException);
      await expect(adapter.requestQuote(mockRequest)).rejects.toThrow(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    });

    it('should throw BadGatewayException on API error without response', async () => {
      const error = {
        message: 'Network Error',
      };

      mockPost.mockRejectedValue(error);

      await expect(adapter.requestQuote(mockRequest)).rejects.toThrow(BadGatewayException);
      await expect(adapter.requestQuote(mockRequest)).rejects.toThrow(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    });

    it('should log error details when API call fails', async () => {
      const error = {
        message: 'API Error',
        response: {
          status: 400,
          data: { error: 'Invalid request' },
        },
      };

      mockPost.mockRejectedValue(error);
      const loggerErrorSpy = jest.spyOn(adapter['logger'], 'error');

      await expect(adapter.requestQuote(mockRequest)).rejects.toThrow();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        `Failed to request quote for participant ${mockRequest.providerUserRef}: ${error.message}`,
      );
      expect(loggerErrorSpy).toHaveBeenCalledWith(`ZeroHash response status: ${error.response.status}`);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        `ZeroHash response data: ${JSON.stringify(error.response.data, null, 2)}`,
      );
    });
  });

  describe('executePayment', () => {
    const mockRequest: ExecutePaymentRequest = {
      providerUserRef: 'test-participant',
      quoteRef: 'quote-456',
      achSignedAgreement: 1,
      externalAccountRef: 'ext-account-123',
      description: 'Test payment',
    };

    const mockZerohashResponse: ZeroHashExecutePaymentWrappedResponse = {
      message: {
        request_id: 'req-789',
        transaction_id: 'txn-abc123',
        status: 'pending',
        warning: 'Test warning',
      },
    };

    it('should successfully execute payment and map response correctly', async () => {
      mockPost.mockResolvedValue({ data: mockZerohashResponse });

      const result = await adapter.executePayment(mockRequest);

      expect(mockPost).toHaveBeenCalledWith('/payments/execute', {
        participant_code: 'test-participant',
        quote_id: 'quote-456',
        ach_signed_agreement: 1,
        external_account_id: 'ext-account-123',
        description: 'Test payment',
      });

      expect(result).toEqual({
        requestRef: 'req-789',
        transactionRef: 'txn-abc123',
        status: 'pending',
        warning: 'Test warning',
      });
    });

    it('should log the request', async () => {
      mockPost.mockResolvedValue({ data: mockZerohashResponse });
      const loggerSpy = jest.spyOn(adapter['logger'], 'log');

      await adapter.executePayment(mockRequest);

      expect(loggerSpy).toHaveBeenCalledWith(
        `Executing payment on ZeroHash for participant: ${mockRequest.providerUserRef}, quote: ${mockRequest.quoteRef}`,
      );
    });

    it('should log the response', async () => {
      mockPost.mockResolvedValue({ data: mockZerohashResponse });
      const loggerSpy = jest.spyOn(adapter['logger'], 'debug');

      await adapter.executePayment(mockRequest);

      expect(loggerSpy).toHaveBeenCalledWith(
        `ZeroHash execute payment response:\n${JSON.stringify(mockZerohashResponse, null, 2)}`,
      );
    });

    it('should handle request without optional description', async () => {
      const requestWithoutDescription = { ...mockRequest };
      delete requestWithoutDescription.description;

      mockPost.mockResolvedValue({ data: mockZerohashResponse });

      await adapter.executePayment(requestWithoutDescription);

      expect(mockPost).toHaveBeenCalledWith('/payments/execute', {
        participant_code: 'test-participant',
        quote_id: 'quote-456',
        ach_signed_agreement: 1,
        external_account_id: 'ext-account-123',
      });
    });

    it('should handle response without optional warning', async () => {
      const responseWithoutWarning = {
        message: {
          request_id: 'req-789',
          transaction_id: 'txn-abc123',
          status: 'pending',
        },
      };

      mockPost.mockResolvedValue({ data: responseWithoutWarning });

      const result = await adapter.executePayment(mockRequest);

      expect(result).toEqual({
        requestRef: 'req-789',
        transactionRef: 'txn-abc123',
        status: 'pending',
        warning: undefined,
      });
    });

    it('should throw BadGatewayException on API error with 4xx status', async () => {
      const error = {
        message: 'API Error',
        response: {
          status: 422,
          data: { error: 'Invalid quote' },
        },
      };

      mockPost.mockRejectedValue(error);

      await expect(adapter.executePayment(mockRequest)).rejects.toThrow(BadGatewayException);
      await expect(adapter.executePayment(mockRequest)).rejects.toThrow(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    });

    it('should throw BadGatewayException on API error without response', async () => {
      const error = {
        message: 'Connection timeout',
      };

      mockPost.mockRejectedValue(error);

      await expect(adapter.executePayment(mockRequest)).rejects.toThrow(BadGatewayException);
      await expect(adapter.executePayment(mockRequest)).rejects.toThrow(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    });

    it('should log error details when API call fails', async () => {
      const error = {
        message: 'API Error',
        response: {
          status: 422,
          data: { error: 'Invalid quote' },
        },
      };

      mockPost.mockRejectedValue(error);
      const loggerErrorSpy = jest.spyOn(adapter['logger'], 'error');

      await expect(adapter.executePayment(mockRequest)).rejects.toThrow();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        `Failed to execute payment for participant ${mockRequest.providerUserRef}: ${error.message}`,
      );
      expect(loggerErrorSpy).toHaveBeenCalledWith(`ZeroHash response status: ${error.response.status}`);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        `ZeroHash response data: ${JSON.stringify(error.response.data, null, 2)}`,
      );
    });

    it('should throw BadGatewayException with generic message on ZeroHash errors', async () => {
      const error = {
        message: 'API Error',
        response: {
          status: 400,
          data: {
            errors: ["transfer's amount is greater than platform's ACH limit", 'secondary error message'],
          },
        },
      };

      mockPost.mockRejectedValue(error);

      await expect(adapter.executePayment(mockRequest)).rejects.toThrow(BadGatewayException);
      await expect(adapter.executePayment(mockRequest)).rejects.toThrow(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    });

    it('should throw BadGatewayException with generic message when no errors array exists', async () => {
      const error = {
        message: 'API Error',
        response: {
          status: 400,
          data: {
            message: 'Some other error format',
          },
        },
      };

      mockPost.mockRejectedValue(error);

      await expect(adapter.executePayment(mockRequest)).rejects.toThrow(BadGatewayException);
      await expect(adapter.executePayment(mockRequest)).rejects.toThrow(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    });

    it('should throw BadGatewayException for 4xx client errors', async () => {
      const error = {
        message: 'Client Error',
        response: {
          status: 422,
          data: {
            errors: ['Invalid account configuration'],
          },
        },
      };

      mockPost.mockRejectedValue(error);

      await expect(adapter.executePayment(mockRequest)).rejects.toThrow(BadGatewayException);
      await expect(adapter.executePayment(mockRequest)).rejects.toThrow(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    });

    it('should throw BadGatewayException for 5xx server errors', async () => {
      const error = {
        message: 'Server Error',
        response: {
          status: 500,
          data: {
            errors: ['Internal server error'],
          },
        },
      };

      mockPost.mockRejectedValue(error);

      await expect(adapter.executePayment(mockRequest)).rejects.toThrow(BadGatewayException);
      await expect(adapter.executePayment(mockRequest)).rejects.toThrow(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    });

    it('should throw BadGatewayException when no status code is available', async () => {
      const error = {
        message: 'Network timeout',
        // No response object
      };

      mockPost.mockRejectedValue(error);

      await expect(adapter.executePayment(mockRequest)).rejects.toThrow(BadGatewayException);
      await expect(adapter.executePayment(mockRequest)).rejects.toThrow(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    });

    it('should throw BadGatewayException with generic message on empty errors array', async () => {
      const error = {
        message: 'API Error',
        response: {
          status: 400,
          data: {
            errors: [], // Empty array
          },
        },
      };

      mockPost.mockRejectedValue(error);

      await expect(adapter.executePayment(mockRequest)).rejects.toThrow(BadGatewayException);
      await expect(adapter.executePayment(mockRequest)).rejects.toThrow(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    });
  });

  describe('inheritance', () => {
    it('should extend ZerohashAxiosHelper', () => {
      expect(adapter).toBeInstanceOf(ZerohashExternalAccountAdapter);
      // Verify it has the inherited HTTP methods (mocked)
      expect(typeof adapter['post']).toBe('function');
      expect(typeof adapter['get']).toBe('function');
      expect(typeof adapter['patch']).toBe('function');
    });
  });
});
