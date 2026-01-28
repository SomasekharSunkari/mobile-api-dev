import { Test, TestingModule } from '@nestjs/testing';
import { NotImplementedException } from '@nestjs/common';
import { ExternalAccountAdapter } from './external-account.adapter';
import { PlaidExternalAccountAdapter } from './plaid/plaid.adapter';
import { ZerohashExternalAccountAdapter } from './zerohash/zerohash.adapter';
import { RiskSignalRequest } from './external-account.adapter.interface';

describe('ExternalAccountAdapter', () => {
  let adapter: ExternalAccountAdapter;
  let plaidAdapter: PlaidExternalAccountAdapter;

  const mockRequest: RiskSignalRequest = {
    token: 'test-access-token',
    accountRef: 'test-account-ref',
    amount: 100.0,
    currency: 'USD',
  };

  const mockRiskSignalResponse = {
    core_attributes: {},
    request_id: 'req-123',
    ruleset: {
      result: 'ACCEPT' as const,
      ruleset_key: 'recommended-risk-rules',
      triggered_rule_details: {},
    },
    scores: {
      bank_initiated_return_risk: { score: 25, risk_tier: 3 },
      customer_initiated_return_risk: { score: 30, risk_tier: 2 },
    },
    warnings: [],
  };

  beforeEach(async () => {
    const mockPlaidAdapter = {
      evaluateRiskSignal: jest.fn(),
      reportDecision: jest.fn(),
      reportReturn: jest.fn(),
    };

    const mockZerohashAdapter = {
      evaluateRiskSignal: jest.fn(),
      reportDecision: jest.fn(),
      reportReturn: jest.fn(),
      requestQuote: jest.fn(),
      executePayment: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExternalAccountAdapter,
        { provide: PlaidExternalAccountAdapter, useValue: mockPlaidAdapter },
        { provide: ZerohashExternalAccountAdapter, useValue: mockZerohashAdapter },
      ],
    }).compile();

    adapter = module.get<ExternalAccountAdapter>(ExternalAccountAdapter);
    plaidAdapter = module.get<PlaidExternalAccountAdapter>(PlaidExternalAccountAdapter);
  });

  describe('evaluateRiskSignal', () => {
    it('should delegate to PlaidExternalAccountAdapter for US country', async () => {
      (plaidAdapter.evaluateRiskSignal as jest.Mock).mockResolvedValue(mockRiskSignalResponse);

      const result = await adapter.evaluateRiskSignal(mockRequest, 'US');

      expect(plaidAdapter.evaluateRiskSignal).toHaveBeenCalledWith(mockRequest);
      expect(result).toEqual(mockRiskSignalResponse);
    });

    it('should throw NotImplementedException for unsupported country', async () => {
      await expect(adapter.evaluateRiskSignal(mockRequest, 'UK')).rejects.toThrow(NotImplementedException);
      await expect(adapter.evaluateRiskSignal(mockRequest, 'UK')).rejects.toThrow(
        'No risk signal evaluation support for country UK',
      );
    });

    it('should handle uppercase country codes', async () => {
      (plaidAdapter.evaluateRiskSignal as jest.Mock).mockResolvedValue(mockRiskSignalResponse);

      const result = await adapter.evaluateRiskSignal(mockRequest, 'us');

      expect(plaidAdapter.evaluateRiskSignal).toHaveBeenCalledWith(mockRequest);
      expect(result).toEqual(mockRiskSignalResponse);
    });

    it('should bubble up errors from PlaidExternalAccountAdapter', async () => {
      const error = new Error('Plaid API Error');
      (plaidAdapter.evaluateRiskSignal as jest.Mock).mockRejectedValue(error);

      await expect(adapter.evaluateRiskSignal(mockRequest, 'US')).rejects.toThrow('Plaid API Error');
    });
  });

  describe('reportDecision', () => {
    const mockDecisionRequest = {
      clientTransactionRef: 'tx-123',
      initiated: true,
      daysFundsOnHold: 1,
      amountInstantlyAvailable: 50.0,
    };

    it('should delegate to PlaidExternalAccountAdapter for US country', async () => {
      const mockResponse = { success: true };
      (plaidAdapter.reportDecision as jest.Mock).mockResolvedValue(mockResponse);

      const result = await adapter.reportDecision(mockDecisionRequest, 'US');

      expect(plaidAdapter.reportDecision).toHaveBeenCalledWith(mockDecisionRequest);
      expect(result).toEqual(mockResponse);
    });

    it('should throw NotImplementedException for unsupported countries', async () => {
      await expect(adapter.reportDecision(mockDecisionRequest, 'UK')).rejects.toThrow(NotImplementedException);
    });
  });

  describe('reportReturn', () => {
    const mockReturnRequest = {
      clientTransactionRef: 'tx-123',
      returnCode: 'R01',
      returnedAt: '2023-01-01T00:00:00Z',
    };

    it('should delegate to PlaidExternalAccountAdapter for US country', async () => {
      const mockResponse = { success: true };
      (plaidAdapter.reportReturn as jest.Mock).mockResolvedValue(mockResponse);

      const result = await adapter.reportReturn(mockReturnRequest, 'US');

      expect(plaidAdapter.reportReturn).toHaveBeenCalledWith(mockReturnRequest);
      expect(result).toEqual(mockResponse);
    });

    it('should throw NotImplementedException for unsupported countries', async () => {
      await expect(adapter.reportReturn(mockReturnRequest, 'UK')).rejects.toThrow(NotImplementedException);
    });
  });

  describe('requestQuote', () => {
    const mockQuoteRequest = {
      providerUserRef: 'participant-123',
      targetCurrency: 'USD',
      sourceCurrency: 'USDC',
      operation: 'buy' as const,
      amount: '100.00',
      quoteExpiry: '5m',
    };

    const mockQuoteResponse = {
      quoteRef: 'quote-456',
      amount: '100.00',
      rate: '1.00',
      expiresAt: 1640995200,
    };

    it('should delegate to ZerohashExternalAccountAdapter for US country', async () => {
      const zerohashAdapter = adapter['zerohashAdapter'];
      (zerohashAdapter.requestQuote as jest.Mock).mockResolvedValue(mockQuoteResponse);

      const result = await adapter.requestQuote(mockQuoteRequest, 'US');

      expect(zerohashAdapter.requestQuote).toHaveBeenCalledWith(mockQuoteRequest);
      expect(result).toEqual(mockQuoteResponse);
    });

    it('should throw NotImplementedException for unsupported countries', async () => {
      await expect(adapter.requestQuote(mockQuoteRequest, 'UK')).rejects.toThrow(NotImplementedException);
    });
  });

  describe('executePayment', () => {
    const mockExecuteRequest = {
      providerUserRef: 'participant-123',
      quoteRef: 'quote-456',
      achSignedAgreement: 1,
      externalAccountRef: 'ext-account-123',
      description: 'Test payment',
    };

    const mockExecuteResponse = {
      requestRef: 'req-789',
      transactionRef: 'txn-abc123',
      status: 'pending',
      warning: 'Test warning',
    };

    it('should delegate to ZerohashExternalAccountAdapter for US country', async () => {
      const zerohashAdapter = adapter['zerohashAdapter'];
      (zerohashAdapter.executePayment as jest.Mock).mockResolvedValue(mockExecuteResponse);

      const result = await adapter.executePayment(mockExecuteRequest, 'US');

      expect(zerohashAdapter.executePayment).toHaveBeenCalledWith(mockExecuteRequest);
      expect(result).toEqual(mockExecuteResponse);
    });

    it('should throw NotImplementedException for unsupported countries', async () => {
      await expect(adapter.executePayment(mockExecuteRequest, 'UK')).rejects.toThrow(NotImplementedException);
    });
  });
});
