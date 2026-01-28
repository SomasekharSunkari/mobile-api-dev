import { Test, TestingModule } from '@nestjs/testing';
import { RainWebhookAuthGuard } from './rain-webhook.guard';
import * as crypto from 'crypto';

describe('RainWebhookAuthGuard', () => {
  let guard: RainWebhookAuthGuard;
  const originalEnv = process.env.RAIN_WEBHOOK_SIGNING_KEY;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RainWebhookAuthGuard],
    }).compile();

    guard = module.get<RainWebhookAuthGuard>(RainWebhookAuthGuard);
  });

  afterEach(() => {
    process.env.RAIN_WEBHOOK_SIGNING_KEY = originalEnv;
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('validateRequest', () => {
    it('should return false when signature header is missing', () => {
      const mockRequest = {
        headers: {},
        body: { test: 'data' },
      } as any;

      const result = guard.validateRequest(mockRequest);
      expect(result).toBe(false);
    });

    it('should return false when RAIN_WEBHOOK_SIGNING_KEY is not set', () => {
      delete process.env.RAIN_WEBHOOK_SIGNING_KEY;

      const mockRequest = {
        headers: { Signature: 'test-signature' },
        body: { test: 'data' },
      } as any;

      const result = guard.validateRequest(mockRequest);
      expect(result).toBe(false);
    });

    it('should validate signature correctly', () => {
      const webhookSigningKey = 'test-webhook-signing-key';
      process.env.RAIN_WEBHOOK_SIGNING_KEY = webhookSigningKey;

      const mockBody = { event_type: 'card_issued', id: 'test-id' };
      const payload = JSON.stringify(mockBody);
      const expectedSignature = crypto.createHmac('sha256', webhookSigningKey).update(payload).digest('hex');

      const mockRequest = {
        headers: { Signature: expectedSignature },
        body: mockBody,
      } as any;

      const result = guard.validateRequest(mockRequest);
      expect(result).toBe(true);
    });

    it('should return false for invalid signature', () => {
      const webhookSigningKey = 'test-webhook-signing-key';
      process.env.RAIN_WEBHOOK_SIGNING_KEY = webhookSigningKey;

      const mockRequest = {
        headers: { Signature: 'invalid-signature' },
        body: { event_type: 'card_issued', id: 'test-id' },
      } as any;

      const result = guard.validateRequest(mockRequest);
      expect(result).toBe(false);
    });

    it('should handle case-insensitive signature header', () => {
      const webhookSigningKey = 'test-webhook-signing-key';
      process.env.RAIN_WEBHOOK_SIGNING_KEY = webhookSigningKey;

      const mockBody = { event_type: 'card_issued', id: 'test-id' };
      const payload = JSON.stringify(mockBody);
      const expectedSignature = crypto.createHmac('sha256', webhookSigningKey).update(payload).digest('hex');

      const mockRequest = {
        headers: { signature: expectedSignature }, // lowercase
        body: mockBody,
      } as any;

      const result = guard.validateRequest(mockRequest);
      expect(result).toBe(true);
    });

    it('should handle JSON.stringify edge cases', () => {
      const webhookSigningKey = 'test-webhook-signing-key';
      process.env.RAIN_WEBHOOK_SIGNING_KEY = webhookSigningKey;

      // Test with nested objects and arrays
      const mockBody = {
        event_type: 'transaction_created',
        data: {
          amount: 100,
          currency: 'USD',
          metadata: ['tag1', 'tag2'],
        },
      };
      const payload = JSON.stringify(mockBody);
      const expectedSignature = crypto.createHmac('sha256', webhookSigningKey).update(payload).digest('hex');

      const mockRequest = {
        headers: { Signature: expectedSignature },
        body: mockBody,
      } as any;

      const result = guard.validateRequest(mockRequest);
      expect(result).toBe(true);
    });
  });

  describe('validateWebhookSignature', () => {
    it('should return false when RAIN_WEBHOOK_SIGNING_KEY is not set', () => {
      delete process.env.RAIN_WEBHOOK_SIGNING_KEY;

      const result = guard.validateWebhookSignature('test-signature', { test: 'data' });
      expect(result).toBe(false);
    });

    it('should return false when signature validation throws error', () => {
      process.env.RAIN_WEBHOOK_SIGNING_KEY = 'test-webhook-signing-key';

      // Mock JSON.stringify to throw an error
      const originalStringify = JSON.stringify;
      JSON.stringify = jest.fn().mockImplementation(() => {
        throw new Error('JSON stringify error');
      });

      const result = guard.validateWebhookSignature('test-signature', { test: 'data' });
      expect(result).toBe(false);

      // Restore original function
      JSON.stringify = originalStringify;
    });
  });
});
