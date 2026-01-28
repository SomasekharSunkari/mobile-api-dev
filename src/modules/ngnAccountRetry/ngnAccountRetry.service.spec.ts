import { Test, TestingModule } from '@nestjs/testing';
import { NgnAccountRetryProcessor } from '../../services/queue/processors/ngn-account-retry/ngn-account-retry.processor';
import { NgnAccountRetryService } from './ngnAccountRetry.service';

describe('NgnAccountRetryService', () => {
  let service: NgnAccountRetryService;
  let mockProcessor: jest.Mocked<NgnAccountRetryProcessor>;

  beforeEach(async () => {
    mockProcessor = {
      queueScanJob: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NgnAccountRetryService,
        {
          provide: NgnAccountRetryProcessor,
          useValue: mockProcessor,
        },
      ],
    }).compile();

    service = module.get<NgnAccountRetryService>(NgnAccountRetryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('triggerRetry', () => {
    it('should queue a scan job and return success message', async () => {
      mockProcessor.queueScanJob.mockResolvedValue({
        id: 'test-job-id',
        name: 'scan-users',
        data: { offset: 0 },
      } as any);

      const result = await service.triggerRetry();

      expect(mockProcessor.queueScanJob).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        message: 'Scan job queued. Users will be processed in chunks of 500.',
      });
    });

    it('should propagate errors from processor', async () => {
      const error = new Error('Queue connection failed');
      mockProcessor.queueScanJob.mockRejectedValue(error);

      await expect(service.triggerRetry()).rejects.toThrow('Queue connection failed');
    });
  });
});
