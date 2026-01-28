import { Test, TestingModule } from '@nestjs/testing';
import { PlaidExternalAccountAdapter } from './plaid.adapter';
import { RedisService } from '../../../services/redis/redis.service';
import { RiskSignalRequest } from '../external-account.adapter.interface';

describe('PlaidExternalAccountAdapter', () => {
  let adapter: PlaidExternalAccountAdapter;

  const mockConfig = {
    clientId: 'mock-client-id',
    secret: 'mock-secret',
    webhook: 'https://example.com/webhook',
    redirect_uri: 'https://example.com/redirect',
    signalRulesetKey: 'recommended-risk-rules',
  };

  const mockRequest: RiskSignalRequest = {
    token: 'test-access-token',
    accountRef: 'test-account-ref',
    amount: 100.0,
    currency: 'USD',
  };

  const mockPlaidSignalResponse = {
    data: {
      request_id: 'req-123',
      core_attributes: {},
      ruleset: {
        result: 'ACCEPT',
        ruleset_key: 'recommended-risk-rules',
        triggered_rule_details: {},
      },
      scores: {
        bank_initiated_return_risk: {
          score: 25,
          risk_tier: 3,
        },
        customer_initiated_return_risk: {
          score: 30,
          risk_tier: 2,
        },
      },
      warnings: [],
    },
  };

  beforeEach(async () => {
    const mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlaidExternalAccountAdapter,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    adapter = module.get<PlaidExternalAccountAdapter>(PlaidExternalAccountAdapter);

    // Mock the config provider
    (adapter as any).configProvider = {
      getConfig: () => mockConfig,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('evaluateRiskSignal', () => {
    it('should return risk signal data from Plaid API', async () => {
      jest.spyOn(adapter as any, 'signalEvaluate').mockResolvedValue(mockPlaidSignalResponse);

      const result = await adapter.evaluateRiskSignal(mockRequest);

      expect(result.ruleset.result).toBe('ACCEPT');
      expect(result.ruleset.rulesetKey).toBe('recommended-risk-rules');
      expect(result.scores.bankInitiatedReturnRisk?.score).toBe(25);
      expect(result.scores.customerInitiatedReturnRisk?.score).toBe(30);
      expect(result.requestRef).toBe('req-123');
    });

    it('should throw ServiceUnavailableException when ruleset result is missing', async () => {
      const noRulesetResponse = {
        data: {
          request_id: 'req-123',
          core_attributes: {},
          scores: {
            customer_initiated_return_risk: { score: 30, risk_tier: 2 },
          },
          warnings: [],
        },
      };

      jest.spyOn(adapter as any, 'signalEvaluate').mockResolvedValue(noRulesetResponse);

      await expect(adapter.evaluateRiskSignal(mockRequest)).rejects.toMatchObject({
        message: 'Service unavailable. Please try again later.',
        type: 'SERVICE_UNAVAILABLE_EXCEPTION',
        statusCode: 503,
      });
    });

    it('should throw ServiceUnavailableException when request_id is missing', async () => {
      const noRequestIdResponse = {
        data: {
          core_attributes: {},
          ruleset: {
            result: 'ACCEPT',
            ruleset_key: 'recommended-risk-rules',
            triggered_rule_details: {},
          },
          scores: {
            bank_initiated_return_risk: { score: 25, risk_tier: 3 },
            customer_initiated_return_risk: { score: 30, risk_tier: 2 },
          },
          warnings: [],
        },
      };

      jest.spyOn(adapter as any, 'signalEvaluate').mockResolvedValue(noRequestIdResponse);

      await expect(adapter.evaluateRiskSignal(mockRequest)).rejects.toMatchObject({
        message: 'Service unavailable. Please try again later.',
        type: 'SERVICE_UNAVAILABLE_EXCEPTION',
        statusCode: 503,
      });
    });

    it('should throw ServiceUnavailableException when Plaid API fails', async () => {
      const error = { isAxiosError: true, response: { data: { error_message: 'API Error' } } };
      jest.spyOn(adapter as any, 'signalEvaluate').mockRejectedValue(error);

      await expect(adapter.evaluateRiskSignal(mockRequest)).rejects.toMatchObject({
        message: 'Service unavailable. Please try again later.',
        type: 'SERVICE_UNAVAILABLE_EXCEPTION',
        statusCode: 503,
      });
    });

    it('should call signalEvaluate with correct parameters', async () => {
      const signalEvaluateSpy = jest.spyOn(adapter as any, 'signalEvaluate').mockResolvedValue(mockPlaidSignalResponse);

      await adapter.evaluateRiskSignal(mockRequest);

      expect(signalEvaluateSpy).toHaveBeenCalledWith({
        client_id: mockConfig.clientId,
        secret: mockConfig.secret,
        access_token: mockRequest.token,
        account_id: mockRequest.accountRef,
        client_transaction_id: expect.any(String),
        amount: mockRequest.amount,
        ruleset_key: mockConfig.signalRulesetKey,
      });
    });
  });

  describe('generateTransactionId', () => {
    it('should generate unique transaction IDs', () => {
      const id1 = (adapter as any).generateTransactionId();
      const id2 = (adapter as any).generateTransactionId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^txn_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^txn_\d+_[a-z0-9]+$/);
    });
  });
});
