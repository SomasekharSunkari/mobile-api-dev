import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RainWebhookService } from './rain-webhook.service';
import { RainWebhookController } from './rain-webhook.controller';
import { RainWebhookAuthGuard } from './rain-webhook.guard';

describe('RainWebhookController', () => {
  let controller: RainWebhookController;
  let rainWebhookService: jest.Mocked<RainWebhookService>;

  const mockBody = {
    id: 'webhook-123',
    resource: 'user',
    action: 'updated',
    body: {
      id: 'user-456',
      email: 'test@example.com',
    },
  };

  const mockHeaders = {
    Signature: 'test-signature',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RainWebhookController],
      providers: [
        {
          provide: RainWebhookService,
          useValue: {
            processWebhook: jest.fn(),
          },
        },
        {
          provide: RainWebhookAuthGuard,
          useValue: {
            canActivate: jest.fn().mockReturnValue(true),
          },
        },
      ],
    }).compile();

    controller = module.get<RainWebhookController>(RainWebhookController);
    rainWebhookService = module.get(RainWebhookService) as jest.Mocked<RainWebhookService>;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleWebhook', () => {
    it('should process webhook successfully', async () => {
      const mockResult = {
        status: 'processed',
        action: 'user_updated',
        userId: 'user-456',
      };

      rainWebhookService.processWebhook.mockResolvedValue(mockResult);

      const result = await controller.handleWebhook(mockBody, mockHeaders);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.message).toBe('Rain webhook processed successfully');
      expect(result.data).toEqual(mockResult);
      expect(rainWebhookService.processWebhook).toHaveBeenCalledWith(mockBody, mockHeaders);
    });

    it('should handle webhook with missing resource', async () => {
      const bodyWithoutResource = {
        id: 'webhook-123',
        action: 'updated',
      };

      const mockResult = {
        status: 'processed',
        action: 'user_updated',
      };

      rainWebhookService.processWebhook.mockResolvedValue(mockResult);

      const result = await controller.handleWebhook(bodyWithoutResource, mockHeaders);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.message).toBe('Rain webhook processed successfully');
      expect(rainWebhookService.processWebhook).toHaveBeenCalledWith(bodyWithoutResource, mockHeaders);
    });

    it('should handle webhook with missing action', async () => {
      const bodyWithoutAction = {
        id: 'webhook-123',
        resource: 'user',
      };

      const mockResult = {
        status: 'processed',
      };

      rainWebhookService.processWebhook.mockResolvedValue(mockResult);

      const result = await controller.handleWebhook(bodyWithoutAction, mockHeaders);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(rainWebhookService.processWebhook).toHaveBeenCalledWith(bodyWithoutAction, mockHeaders);
    });

    it('should handle webhook with missing id', async () => {
      const bodyWithoutId = {
        resource: 'user',
        action: 'updated',
      };

      const mockResult = {
        status: 'processed',
      };

      rainWebhookService.processWebhook.mockResolvedValue(mockResult);

      const result = await controller.handleWebhook(bodyWithoutId, mockHeaders);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(rainWebhookService.processWebhook).toHaveBeenCalledWith(bodyWithoutId, mockHeaders);
    });

    it('should handle webhook with empty body', async () => {
      const emptyBody = {};

      const mockResult = {
        status: 'processed',
      };

      rainWebhookService.processWebhook.mockResolvedValue(mockResult);

      const result = await controller.handleWebhook(emptyBody, mockHeaders);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(rainWebhookService.processWebhook).toHaveBeenCalledWith(emptyBody, mockHeaders);
    });

    it('should handle webhook processing error', async () => {
      const error = new Error('Processing failed');
      rainWebhookService.processWebhook.mockRejectedValue(error);

      await expect(controller.handleWebhook(mockBody, mockHeaders)).rejects.toThrow('Failed to process Rain webhook');
    });

    it('should handle webhook processing error with string message', async () => {
      const error = 'Processing failed';
      rainWebhookService.processWebhook.mockRejectedValue(error);

      await expect(controller.handleWebhook(mockBody, mockHeaders)).rejects.toThrow('Failed to process Rain webhook');
    });

    it('should handle webhook with card resource', async () => {
      const cardWebhookBody = {
        id: 'webhook-123',
        resource: 'card',
        action: 'created',
        body: {
          id: 'card-456',
          status: 'active',
        },
      };

      const mockResult = {
        status: 'processed',
        action: 'card_created',
        cardId: 'card-456',
      };

      rainWebhookService.processWebhook.mockResolvedValue(mockResult);

      const result = await controller.handleWebhook(cardWebhookBody, mockHeaders);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.data).toEqual(mockResult);
    });

    it('should handle webhook with transaction resource', async () => {
      const transactionWebhookBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'completed',
        body: {
          id: 'txn-456',
          status: 'completed',
        },
      };

      const mockResult = {
        status: 'processed',
        action: 'transaction_completed',
        transactionId: 'txn-456',
      };

      rainWebhookService.processWebhook.mockResolvedValue(mockResult);

      const result = await controller.handleWebhook(transactionWebhookBody, mockHeaders);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.data).toEqual(mockResult);
    });

    it('should handle webhook with null body', async () => {
      const nullBody = null as any;

      const mockResult = {
        status: 'processed',
      };

      rainWebhookService.processWebhook.mockResolvedValue(mockResult);

      const result = await controller.handleWebhook(nullBody, mockHeaders);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(rainWebhookService.processWebhook).toHaveBeenCalledWith(nullBody, mockHeaders);
    });

    it('should handle webhook with undefined body', async () => {
      const undefinedBody = undefined as any;

      const mockResult = {
        status: 'processed',
      };

      rainWebhookService.processWebhook.mockResolvedValue(mockResult);

      const result = await controller.handleWebhook(undefinedBody, mockHeaders);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(rainWebhookService.processWebhook).toHaveBeenCalledWith(undefinedBody, mockHeaders);
    });

    it('should handle webhook with complex nested body', async () => {
      const complexBody = {
        id: 'webhook-123',
        resource: 'user',
        action: 'updated',
        body: {
          id: 'user-456',
          email: 'test@example.com',
          metadata: {
            nested: {
              value: 'test',
            },
          },
          array: [1, 2, 3],
        },
      };

      const mockResult = {
        status: 'processed',
        action: 'user_updated',
      };

      rainWebhookService.processWebhook.mockResolvedValue(mockResult);

      const result = await controller.handleWebhook(complexBody, mockHeaders);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(rainWebhookService.processWebhook).toHaveBeenCalledWith(complexBody, mockHeaders);
    });

    it('should handle webhook error with Error instance', async () => {
      const error = new Error('Processing failed');
      error.stack = 'Error stack trace';
      rainWebhookService.processWebhook.mockRejectedValue(error);

      await expect(controller.handleWebhook(mockBody, mockHeaders)).rejects.toThrow('Failed to process Rain webhook');
    });

    it('should handle webhook error with non-Error object', async () => {
      const error = { message: 'Custom error', code: 'ERR_001' };
      rainWebhookService.processWebhook.mockRejectedValue(error);

      await expect(controller.handleWebhook(mockBody, mockHeaders)).rejects.toThrow('Failed to process Rain webhook');
    });
  });
});
