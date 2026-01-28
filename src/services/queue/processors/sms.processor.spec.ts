import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import { Job } from 'bullmq';
import { ConfigService } from '../../../config/core/config.service';
import { QueueService } from '../queue.service';
import { SmsProcessor } from './sms.processor';
import { SendSmsData } from './sms/sms.interface';

jest.mock('axios');

describe('SmsProcessor', () => {
  let smsProcessor: SmsProcessor;
  let queueService: jest.Mocked<QueueService>;
  let configServiceSpy: jest.SpyInstance;
  let module: TestingModule;

  const mockJob: Partial<Job<SendSmsData>> = {
    id: 'test-job-id',
    data: {
      to: '+1234567890',
      body: 'Test message',
      from: '+0987654321',
    },
    updateProgress: jest.fn(),
  };

  const mockConfig = {
    apiKey: 'test-api-key',
    servicePlanId: 'test-service-plan-id',
    region: 'us',
    sender: '+1111111111',
  };

  // Reusable date objects to prevent memory bloat
  const staticDate = new Date('2025-01-01T00:00:00.000Z');

  // Helper to create mock SMS response
  const createMockSmsResponse = (overrides: Partial<any> = {}) => ({
    status: 200,
    statusText: 'OK',
    data: {
      id: 'batch-123',
      to: ['+1234567890'],
      from: '+0987654321',
      canceled: false,
      body: 'Test message',
      type: 'mt_text',
      created_at: staticDate,
      modified_at: staticDate,
      delivery_report: 'none',
      expire_at: staticDate,
      flash_message: false,
      ...overrides,
    },
  });

  beforeEach(async () => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    jest.resetAllMocks();

    // Create ConfigService spy for each test
    configServiceSpy = jest.spyOn(ConfigService, 'get').mockReturnValue(mockConfig);

    module = await Test.createTestingModule({
      providers: [
        SmsProcessor,
        {
          provide: QueueService,
          useValue: {
            processJobs: jest.fn(),
            addJob: jest.fn(),
          },
        },
      ],
    }).compile();

    smsProcessor = module.get<SmsProcessor>(SmsProcessor);
    queueService = module.get(QueueService);
  });

  afterEach(async () => {
    // Clean up spies and mocks after each test
    configServiceSpy?.mockRestore();
    jest.clearAllMocks();
    jest.restoreAllMocks();

    // Close the testing module to prevent memory leaks
    if (module) {
      await module.close();
    }
  });

  describe('constructor', () => {
    it('should initialize with sinch configuration', () => {
      expect(smsProcessor).toBeDefined();
      expect((smsProcessor as any).sinchConfig).toBeDefined();
      expect((smsProcessor as any).sinchConfig.apiKey).toBe('test-api-key');
    });
  });

  describe('onModuleInit', () => {
    it('should initialize and register processors', async () => {
      jest.spyOn(smsProcessor, 'registerProcessors');
      await smsProcessor.onModuleInit();
      expect(smsProcessor.registerProcessors).toHaveBeenCalled();
    });
  });

  describe('registerProcessors', () => {
    it('should register SMS processors with queue service', () => {
      smsProcessor.registerProcessors();
      expect(queueService.processJobs).toHaveBeenCalledWith('sms', 'send-sms', expect.any(Function), 5);
    });
  });

  describe('processSendSms', () => {
    it('should successfully process SMS with single recipient', async () => {
      const mockResponse = createMockSmsResponse();

      (axios as jest.MockedFunction<typeof axios>).mockResolvedValue(mockResponse as any);

      const result = await (smsProcessor as any).processSendSms(mockJob);

      expect(result).toBe(true);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(10);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(100);
      expect(axios).toHaveBeenCalled();
    });

    it('should successfully process SMS with multiple recipients', async () => {
      const multiRecipientJob = {
        ...mockJob,
        data: {
          to: ['+1234567890', '+0987654321'],
          body: 'Test message',
        },
      };

      const mockResponse = createMockSmsResponse({
        id: 'batch-456',
        to: ['+1234567890', '+0987654321'],
        from: '+1111111111',
      });

      (axios as jest.MockedFunction<typeof axios>).mockResolvedValue(mockResponse as any);

      const result = await (smsProcessor as any).processSendSms(multiRecipientJob);

      expect(result).toBe(true);
      expect(axios).toHaveBeenCalled();
    });

    it('should handle SMS sending failure gracefully', async () => {
      (axios as jest.MockedFunction<typeof axios>).mockRejectedValue(new Error('API error'));

      const result = await (smsProcessor as any).processSendSms(mockJob);

      expect(result).toBe(false);
    });

    it('should update progress at different stages', async () => {
      const mockResponse = createMockSmsResponse({ id: 'batch-789' });

      (axios as jest.MockedFunction<typeof axios>).mockResolvedValue(mockResponse as any);

      await (smsProcessor as any).processSendSms(mockJob);

      expect(mockJob.updateProgress).toHaveBeenNthCalledWith(1, 10);
      expect(mockJob.updateProgress).toHaveBeenNthCalledWith(2, 100);
    });

    it('should convert single recipient to array', async () => {
      const mockResponse = createMockSmsResponse({ id: 'batch-101' });

      (axios as jest.MockedFunction<typeof axios>).mockResolvedValue(mockResponse as any);

      await (smsProcessor as any).processSendSms(mockJob);

      expect(axios).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          data: expect.objectContaining({
            to: ['+1234567890'],
          }),
        }),
      );
    });
  });

  describe('performSendSms', () => {
    it('should send SMS successfully with default sender', async () => {
      const mockResponse = createMockSmsResponse({
        id: 'batch-202',
        from: '+1111111111',
      });

      (axios as jest.MockedFunction<typeof axios>).mockResolvedValue(mockResponse as any);

      await (smsProcessor as any).performSendSms(['+1234567890'], 'Test message');

      expect(axios).toHaveBeenCalledWith(
        'https://us.sms.api.sinch.com/xms/v1/test-service-plan-id/batches',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-api-key',
          }),
          data: expect.objectContaining({
            to: ['+1234567890'],
            body: 'Test message',
            from: '+1111111111',
          }),
        }),
      );
    });

    it('should send SMS with custom sender', async () => {
      const mockResponse = createMockSmsResponse({
        id: 'batch-303',
      });

      (axios as jest.MockedFunction<typeof axios>).mockResolvedValue(mockResponse as any);

      await (smsProcessor as any).performSendSms(['+1234567890'], 'Test message', '+0987654321');

      expect(axios).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          data: expect.objectContaining({
            from: '+0987654321',
          }),
        }),
      );
    });

    it('should handle HTTP error status codes', async () => {
      const mockResponse = {
        status: 400,
        statusText: 'Bad Request',
        data: {},
      };

      (axios as jest.MockedFunction<typeof axios>).mockResolvedValue(mockResponse as any);

      await expect((smsProcessor as any).performSendSms(['+1234567890'], 'Test message')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle missing batch ID in response', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        data: {
          to: ['+1234567890'],
          from: '+1111111111',
        },
      };

      (axios as jest.MockedFunction<typeof axios>).mockResolvedValue(mockResponse as any);

      await expect((smsProcessor as any).performSendSms(['+1234567890'], 'Test message')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle connection timeout errors', async () => {
      const timeoutError = new Error('Connection timeout');
      (timeoutError as any).code = 'ETIMEDOUT';

      (axios as jest.MockedFunction<typeof axios>).mockRejectedValue(timeoutError);

      const loggerSpy = jest.spyOn((smsProcessor as any).logger, 'error');

      await expect((smsProcessor as any).performSendSms(['+1234567890'], 'Test message')).rejects.toThrow();

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('SMS request timed out'));
    });

    it('should handle connection aborted errors', async () => {
      const abortedError = new Error('Connection aborted');
      (abortedError as any).code = 'ECONNABORTED';

      (axios as jest.MockedFunction<typeof axios>).mockRejectedValue(abortedError);

      const loggerSpy = jest.spyOn((smsProcessor as any).logger, 'error');

      await expect((smsProcessor as any).performSendSms(['+1234567890'], 'Test message')).rejects.toThrow();

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('SMS request timed out'));
    });

    it('should handle API response errors', async () => {
      const apiError = new Error('API Error');
      (apiError as any).response = {
        status: 500,
        data: { error: 'Internal Server Error' },
      };

      (axios as jest.MockedFunction<typeof axios>).mockRejectedValue(apiError);

      const loggerSpy = jest.spyOn((smsProcessor as any).logger, 'error');

      await expect((smsProcessor as any).performSendSms(['+1234567890'], 'Test message')).rejects.toThrow();

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('SMS API error'));
    });

    it('should handle no response errors', async () => {
      const noResponseError = new Error('No response');
      (noResponseError as any).request = {};

      (axios as jest.MockedFunction<typeof axios>).mockRejectedValue(noResponseError);

      const loggerSpy = jest.spyOn((smsProcessor as any).logger, 'error');

      await expect((smsProcessor as any).performSendSms(['+1234567890'], 'Test message')).rejects.toThrow();

      expect(loggerSpy).toHaveBeenCalledWith('SMS API did not respond');
    });

    it('should use correct region in URL', async () => {
      const mockResponse = createMockSmsResponse({
        id: 'batch-404',
        from: '+1111111111',
      });

      (axios as jest.MockedFunction<typeof axios>).mockResolvedValue(mockResponse as any);

      await (smsProcessor as any).performSendSms(['+1234567890'], 'Test message');

      expect(axios).toHaveBeenCalledWith(
        'https://us.sms.api.sinch.com/xms/v1/test-service-plan-id/batches',
        expect.any(Object),
      );
    });
  });

  describe('sendSms', () => {
    it('should queue SMS with single recipient', async () => {
      const mockQueuedJob = { id: 'job-123' } as any;
      queueService.addJob.mockResolvedValue(mockQueuedJob);

      const result = await smsProcessor.sendSms('+1234567890', 'Test message');

      expect(queueService.addJob).toHaveBeenCalledWith(
        'sms',
        'send-sms',
        {
          to: '+1234567890',
          body: 'Test message',
          from: undefined,
        },
        { delay: undefined, attempts: 3 },
      );
      expect(result).toEqual(mockQueuedJob);
    });

    it('should queue SMS with multiple recipients', async () => {
      const mockQueuedJob = { id: 'job-456' } as any;
      queueService.addJob.mockResolvedValue(mockQueuedJob);

      const recipients = ['+1234567890', '+0987654321'];
      await smsProcessor.sendSms(recipients, 'Test message');

      expect(queueService.addJob).toHaveBeenCalledWith(
        'sms',
        'send-sms',
        {
          to: recipients,
          body: 'Test message',
          from: undefined,
        },
        { delay: undefined, attempts: 3 },
      );
    });

    it('should queue SMS with custom sender', async () => {
      const mockQueuedJob = { id: 'job-789' } as any;
      queueService.addJob.mockResolvedValue(mockQueuedJob);

      await smsProcessor.sendSms('+1234567890', 'Test message', '+0987654321');

      expect(queueService.addJob).toHaveBeenCalledWith(
        'sms',
        'send-sms',
        {
          to: '+1234567890',
          body: 'Test message',
          from: '+0987654321',
        },
        { delay: undefined, attempts: 3 },
      );
    });

    it('should queue SMS with delay', async () => {
      const mockQueuedJob = { id: 'job-101' } as any;
      queueService.addJob.mockResolvedValue(mockQueuedJob);

      await smsProcessor.sendSms('+1234567890', 'Test message', undefined, 5000);

      expect(queueService.addJob).toHaveBeenCalledWith(
        'sms',
        'send-sms',
        {
          to: '+1234567890',
          body: 'Test message',
          from: undefined,
        },
        { delay: 5000, attempts: 3 },
      );
    });

    it('should configure retry attempts', async () => {
      const mockQueuedJob = { id: 'job-202' } as any;
      queueService.addJob.mockResolvedValue(mockQueuedJob);

      await smsProcessor.sendSms('+1234567890', 'Test message');

      expect(queueService.addJob).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          attempts: 3,
        }),
      );
    });
  });

  describe('scheduleSms', () => {
    it('should schedule SMS for future delivery', async () => {
      const mockQueuedJob = { id: 'job-303' } as any;
      queueService.addJob.mockResolvedValue(mockQueuedJob);

      const futureTime = new Date(Date.now() + 10000);
      await smsProcessor.scheduleSms('+1234567890', 'Scheduled message', futureTime);

      expect(queueService.addJob).toHaveBeenCalledWith(
        'sms',
        'send-sms',
        expect.objectContaining({
          to: '+1234567890',
          body: 'Scheduled message',
        }),
        expect.objectContaining({
          delay: expect.any(Number),
          attempts: 3,
        }),
      );
    });

    it('should send immediately if scheduled time is in the past', async () => {
      const mockQueuedJob = { id: 'job-404' } as any;
      queueService.addJob.mockResolvedValue(mockQueuedJob);

      const pastTime = new Date(Date.now() - 10000);
      await smsProcessor.scheduleSms('+1234567890', 'Past message', pastTime);

      expect(queueService.addJob).toHaveBeenCalledWith(
        'sms',
        'send-sms',
        expect.any(Object),
        expect.objectContaining({
          delay: undefined,
        }),
      );
    });

    it('should schedule SMS with custom sender', async () => {
      const mockQueuedJob = { id: 'job-505' } as any;
      queueService.addJob.mockResolvedValue(mockQueuedJob);

      const futureTime = new Date(Date.now() + 10000);
      await smsProcessor.scheduleSms('+1234567890', 'Scheduled message', futureTime, '+0987654321');

      expect(queueService.addJob).toHaveBeenCalledWith(
        'sms',
        'send-sms',
        expect.objectContaining({
          from: '+0987654321',
        }),
        expect.any(Object),
      );
    });

    it('should calculate correct delay for future time', async () => {
      const mockQueuedJob = { id: 'job-606' } as any;
      queueService.addJob.mockResolvedValue(mockQueuedJob);

      const now = Date.now();
      const futureTime = new Date(now + 5000);

      await smsProcessor.scheduleSms('+1234567890', 'Scheduled message', futureTime);

      expect(queueService.addJob).toHaveBeenCalledWith(
        'sms',
        'send-sms',
        expect.any(Object),
        expect.objectContaining({
          delay: expect.any(Number),
        }),
      );

      const callArgs = queueService.addJob.mock.calls[0];
      const delay = callArgs[3].delay;
      expect(delay).toBeGreaterThan(4000);
      expect(delay).toBeLessThanOrEqual(5100);
    });

    it('should schedule SMS with multiple recipients', async () => {
      const mockQueuedJob = { id: 'job-707' } as any;
      queueService.addJob.mockResolvedValue(mockQueuedJob);

      const futureTime = new Date(Date.now() + 10000);
      const recipients = ['+1234567890', '+0987654321'];

      await smsProcessor.scheduleSms(recipients, 'Scheduled message', futureTime);

      expect(queueService.addJob).toHaveBeenCalledWith(
        'sms',
        'send-sms',
        expect.objectContaining({
          to: recipients,
        }),
        expect.any(Object),
      );
    });
  });

  describe('logging', () => {
    it('should log when processing SMS job', async () => {
      const loggerSpy = jest.spyOn((smsProcessor as any).logger, 'log');

      const mockResponse = createMockSmsResponse({ id: 'batch-808' });

      (axios as jest.MockedFunction<typeof axios>).mockResolvedValue(mockResponse as any);

      await (smsProcessor as any).processSendSms(mockJob);

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Processing SMS job'));
    });

    it('should log when SMS is sent successfully', async () => {
      const loggerSpy = jest.spyOn((smsProcessor as any).logger, 'log');

      const mockResponse = createMockSmsResponse({ id: 'batch-909' });

      (axios as jest.MockedFunction<typeof axios>).mockResolvedValue(mockResponse as any);

      await (smsProcessor as any).processSendSms(mockJob);

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('SMS sent successfully'));
    });

    it('should log when SMS sending fails', async () => {
      const loggerSpy = jest.spyOn((smsProcessor as any).logger, 'error');

      (axios as jest.MockedFunction<typeof axios>).mockRejectedValue(new Error('Send failed'));

      await (smsProcessor as any).processSendSms(mockJob);

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to send SMS'));
    });

    it('should log when processors are registered', () => {
      const loggerSpy = jest.spyOn((smsProcessor as any).logger, 'log');

      smsProcessor.registerProcessors();

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Registered SMS processors for queue'));
    });
  });
});
