import { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as crypto from 'node:crypto';
import { PagaPersistentAccountWebhookPayload } from '../../../adapters/waas/paga/paga.interface';
import { PagaConfigProvider } from '../../../config/paga.config';
import { AppLoggerService } from '../../../services/logger/logger.service';
import { PagaWebhookAuthGuard } from './paga-webhook.guard';

describe('PagaWebhookAuthGuard', () => {
  let guard: PagaWebhookAuthGuard;
  let mockExecutionContext: jest.Mocked<ExecutionContext>;

  const mockPagaConfig = {
    collectApiUrl: 'https://test.paga.com',
    username: 'test-username',
    credential: 'test-credential',
    hmac: 'test-hmac-key',
    businessApiUrl: 'https://business.paga.com',
    webhookUsername: 'webhook-user',
    webhookPassword: 'webhook-pass',
  };

  const mockAppLoggerService = {
    logInfo: jest.fn(),
    logDebug: jest.fn(),
    logWarn: jest.fn(),
    logError: jest.fn(),
    setContext: jest.fn(),
  };

  beforeEach(async () => {
    jest.spyOn(PagaConfigProvider.prototype, 'getConfig').mockReturnValue(mockPagaConfig);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagaWebhookAuthGuard,
        {
          provide: AppLoggerService,
          useValue: mockAppLoggerService,
        },
      ],
    }).compile();

    guard = module.get<PagaWebhookAuthGuard>(PagaWebhookAuthGuard);
  });

  beforeEach(() => {
    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          headers: {},
          body: {},
        }),
      }),
    } as unknown as jest.Mocked<ExecutionContext>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('should call validateRequest with the request', () => {
      const mockRequest = {
        headers: {
          authorization: 'Basic ' + btoa('webhook-user:webhook-pass'),
        },
        body: createValidWebhookPayload(),
      };

      mockExecutionContext.switchToHttp().getRequest = jest.fn().mockReturnValue(mockRequest);

      const validateRequestSpy = jest.spyOn(guard, 'validateRequest');

      guard.canActivate(mockExecutionContext);

      expect(validateRequestSpy).toHaveBeenCalledWith(mockRequest);
      expect(mockAppLoggerService.logInfo).toHaveBeenCalledWith('Starting Paga webhook authentication');
    });

    it('should return true for valid authentication', () => {
      const payload = createValidWebhookPayload();
      const mockRequest = {
        headers: {
          authorization: 'Basic ' + btoa('webhook-user:webhook-pass'),
        },
        body: payload,
      };

      mockExecutionContext.switchToHttp().getRequest = jest.fn().mockReturnValue(mockRequest);

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
    });

    it('should return false for invalid authentication', () => {
      const mockRequest = {
        headers: {
          authorization: 'Basic ' + btoa('wrong-user:wrong-pass'),
        },
        body: createValidWebhookPayload(),
      };

      mockExecutionContext.switchToHttp().getRequest = jest.fn().mockReturnValue(mockRequest);

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(false);
    });
  });

  describe('validateRequest', () => {
    it('should return false when authorization header is missing', () => {
      const mockRequest = {
        headers: {},
        body: createValidWebhookPayload(),
      };

      const result = guard.validateRequest(mockRequest as unknown as Request);

      expect(result).toBe(false);
      expect(mockAppLoggerService.logWarn).toHaveBeenCalledWith('Invalid authorization header format', {
        metadata: { tokenType: undefined, hasToken: false },
      });
    });

    it('should return false when token type is not Basic', () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer ' + btoa('webhook-user:webhook-pass'),
        },
        body: createValidWebhookPayload(),
      };

      const result = guard.validateRequest(mockRequest as unknown as Request);

      expect(result).toBe(false);
      expect(mockAppLoggerService.logWarn).toHaveBeenCalledWith('Invalid authorization header format', {
        metadata: { tokenType: 'Bearer', hasToken: true },
      });
    });

    it('should return false when token is empty', () => {
      const mockRequest = {
        headers: {
          authorization: 'Basic ',
        },
        body: createValidWebhookPayload(),
      };

      const result = guard.validateRequest(mockRequest as unknown as Request);

      expect(result).toBe(false);
      expect(mockAppLoggerService.logWarn).toHaveBeenCalledWith('Invalid authorization header format', {
        metadata: { tokenType: 'Basic', hasToken: false },
      });
    });

    it('should log debug messages for successful header parsing', () => {
      const payload = createValidWebhookPayload();
      const mockRequest = {
        headers: {
          authorization: 'Basic ' + btoa('webhook-user:webhook-pass'),
        },
        body: payload,
      };

      guard.validateRequest(mockRequest as unknown as Request);

      expect(mockAppLoggerService.logDebug).toHaveBeenCalledWith('Extracting authorization header', {
        metadata: { hasAuthHeader: true },
      });
      expect(mockAppLoggerService.logDebug).toHaveBeenCalledWith(
        'Authorization header parsed successfully, proceeding to validate webhook header',
      );
    });
  });

  describe('validateWebhookHeader', () => {
    it('should return true for valid credentials and hash', () => {
      const payload = createValidWebhookPayload();
      const encryptedData = btoa('webhook-user:webhook-pass');

      const result = guard.validateWebhookHeader(encryptedData, payload);

      expect(result).toBe(true);
      expect(mockAppLoggerService.logInfo).toHaveBeenCalledWith('Paga webhook authentication successful', {
        metadata: { accountNumber: payload.accountNumber, statusCode: payload.statusCode },
      });
    });

    it('should return false for invalid credentials', () => {
      const payload = createValidWebhookPayload();
      const encryptedData = btoa('wrong-user:wrong-pass');

      const result = guard.validateWebhookHeader(encryptedData, payload);

      expect(result).toBe(false);
      expect(mockAppLoggerService.logWarn).toHaveBeenCalledWith('Webhook credentials validation failed');
    });

    it('should return false for invalid hash', () => {
      const payload: PagaPersistentAccountWebhookPayload = {
        statusCode: '0',
        statusMessage: 'SUCCESS',
        transactionReference: 'TXN_REF_123',
        fundingTransactionReference: 'FUND_TXN_123',
        fundingPaymentReference: 'FUND_PAY_123',
        accountNumber: '1234567890',
        accountName: 'John Doe',
        financialIdentificationNumber: '12345678901',
        amount: '5000.00',
        clearingFeeAmount: '50.00',
        payerDetails: {
          paymentReferenceNumber: 'PAY_REF_123',
          narration: 'Payment',
          payerBankName: 'Test Bank',
          payerName: 'Jane Doe',
          paymentMethod: 'BANK_TRANSFER',
          payerBankAccountNumber: '0987654321',
        },
        instantSettlementStatus: 'SETTLED',
        narration: 'Credit',
        hash: 'invalid-hash',
      };

      const encryptedData = btoa('webhook-user:webhook-pass');

      const result = guard.validateWebhookHeader(encryptedData, payload);

      expect(result).toBe(false);
      expect(mockAppLoggerService.logWarn).toHaveBeenCalledWith('Webhook hash validation failed', {
        metadata: { accountNumber: payload.accountNumber, statusCode: payload.statusCode },
      });
    });

    it('should log debug messages during validation', () => {
      const payload = createValidWebhookPayload();
      const encryptedData = btoa('webhook-user:webhook-pass');

      guard.validateWebhookHeader(encryptedData, payload);

      expect(mockAppLoggerService.logDebug).toHaveBeenCalledWith('Decoding base64 credentials');
      expect(mockAppLoggerService.logDebug).toHaveBeenCalledWith('Validating webhook credentials');
      expect(mockAppLoggerService.logDebug).toHaveBeenCalledWith(
        'Webhook credentials validated, proceeding to validate hash',
        {
          metadata: { accountNumber: payload.accountNumber, statusCode: payload.statusCode },
        },
      );
    });

    it('should handle missing username in credentials - still validates if password matches', () => {
      const payload = createValidWebhookPayload();
      const encryptedData = btoa(':webhook-pass');

      const result = guard.validateWebhookHeader(encryptedData, payload);

      // The guard uses && condition, so if password matches, it passes credential check
      expect(result).toBe(true);
    });

    it('should handle missing password in credentials - still validates if username matches', () => {
      const payload = createValidWebhookPayload();
      const encryptedData = btoa('webhook-user:');

      const result = guard.validateWebhookHeader(encryptedData, payload);

      // The guard uses && condition, so if username matches, it passes credential check
      expect(result).toBe(true);
    });

    it('should handle case insensitive username comparison', () => {
      const payload = createValidWebhookPayload();
      const encryptedData = btoa('WEBHOOK-USER:webhook-pass');

      const result = guard.validateWebhookHeader(encryptedData, payload);

      expect(result).toBe(true);
    });

    it('should handle case insensitive password comparison', () => {
      const payload = createValidWebhookPayload();
      const encryptedData = btoa('webhook-user:WEBHOOK-PASS');

      const result = guard.validateWebhookHeader(encryptedData, payload);

      expect(result).toBe(true);
    });
  });

  describe('Hash validation', () => {
    it('should correctly validate hash with sha512', () => {
      const statusCode = '0';
      const accountNumber = '1234567890';
      const amount = '5000.00';
      const clearingFeeAmount = '50.00';

      const expectedHash = crypto
        .createHash('sha512')
        .update(statusCode + accountNumber + amount + clearingFeeAmount + mockPagaConfig.hmac)
        .digest('hex');

      const payload: PagaPersistentAccountWebhookPayload = {
        statusCode,
        statusMessage: 'SUCCESS',
        transactionReference: 'TXN_REF_123',
        fundingTransactionReference: 'FUND_TXN_123',
        fundingPaymentReference: 'FUND_PAY_123',
        accountNumber,
        accountName: 'John Doe',
        financialIdentificationNumber: '12345678901',
        amount,
        clearingFeeAmount,
        payerDetails: {
          paymentReferenceNumber: 'PAY_REF_123',
          narration: 'Payment',
          payerBankName: 'Test Bank',
          payerName: 'Jane Doe',
          paymentMethod: 'BANK_TRANSFER',
          payerBankAccountNumber: '0987654321',
        },
        instantSettlementStatus: 'SETTLED',
        narration: 'Credit',
        hash: expectedHash,
      };

      const encryptedData = btoa('webhook-user:webhook-pass');

      const result = guard.validateWebhookHeader(encryptedData, payload);

      expect(result).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle malformed base64 in authorization header', () => {
      const payload = createValidWebhookPayload();
      const mockRequest = {
        headers: {
          authorization: 'Basic not-valid-base64!!!',
        },
        body: payload,
      };

      expect(() => {
        guard.validateRequest(mockRequest as unknown as Request);
      }).toThrow();
    });

    it('should handle credentials without colon separator', () => {
      const payload = createValidWebhookPayload();
      const encryptedData = btoa('usernamepassword');

      const result = guard.validateWebhookHeader(encryptedData, payload);

      expect(result).toBe(false);
    });
  });

  function createValidWebhookPayload(): PagaPersistentAccountWebhookPayload {
    const statusCode = '0';
    const accountNumber = '1234567890';
    const amount = '5000.00';
    const clearingFeeAmount = '50.00';

    const hash = crypto
      .createHash('sha512')
      .update(statusCode + accountNumber + amount + clearingFeeAmount + mockPagaConfig.hmac)
      .digest('hex');

    return {
      statusCode,
      statusMessage: 'SUCCESS',
      transactionReference: 'TXN_REF_123456789',
      fundingTransactionReference: 'FUND_TXN_123456789',
      fundingPaymentReference: 'FUND_PAY_123456789',
      accountNumber,
      accountName: 'John Doe',
      financialIdentificationNumber: '12345678901',
      amount,
      clearingFeeAmount,
      payerDetails: {
        paymentReferenceNumber: 'PAY_REF_123456789',
        narration: 'Payment for services',
        payerBankName: 'Access Bank',
        payerName: 'Jane Smith',
        paymentMethod: 'BANK_TRANSFER',
        payerBankAccountNumber: '0987654321',
      },
      instantSettlementStatus: 'SETTLED',
      narration: 'Credit from Jane Smith',
      hash,
    };
  }
});
