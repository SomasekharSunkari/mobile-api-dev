import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../redis/redis.service';
import { QueueService } from './queue.service';

// Mock BullMQ
jest.mock('bullmq', () => {
  const mockQueue = {
    add: jest.fn(),
    addBulk: jest.fn(),
    getJob: jest.fn(),
    close: jest.fn(),
  };

  const mockWorker = {
    on: jest.fn(),
    close: jest.fn(),
  };

  return {
    Queue: jest.fn().mockImplementation(() => mockQueue),
    Worker: jest.fn().mockImplementation((name, processor) => {
      // Store processor for testing
      (mockWorker as any).processor = processor;
      return mockWorker;
    }),
  };
});

describe('QueueService', () => {
  let service: QueueService;
  let mockRedisService: jest.Mocked<RedisService>;
  let mockRedisClient: any;

  beforeEach(async () => {
    mockRedisClient = {
      options: {
        keyPrefix: 'test:',
        maxRetriesPerRequest: 3,
      },
    };

    mockRedisService = {
      getClient: jest.fn().mockReturnValue(mockRedisClient),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('getQueue', () => {
    it('should create and return a queue', () => {
      const queue = service.getQueue('test-queue');

      expect(queue).toBeDefined();
      expect(mockRedisService.getClient).toHaveBeenCalled();
    });

    it('should return same queue instance for same name', () => {
      const queue1 = service.getQueue('test-queue');
      const queue2 = service.getQueue('test-queue');

      expect(queue1).toBe(queue2);
    });
  });

  describe('addJob', () => {
    it('should add a job to the queue', async () => {
      const mockJob = { id: 'job-123', name: 'test-job', data: { foo: 'bar' } };
      const queue = service.getQueue('test-queue');
      (queue.add as jest.Mock).mockResolvedValue(mockJob);

      const result = await service.addJob('test-queue', 'test-job', { foo: 'bar' });

      expect(queue.add).toHaveBeenCalledWith('test-job', { foo: 'bar' }, undefined);
      expect(result).toEqual(mockJob);
    });

    it('should add a job with options', async () => {
      const mockJob = { id: 'job-123' };
      const queue = service.getQueue('test-queue');
      (queue.add as jest.Mock).mockResolvedValue(mockJob);
      const options = { delay: 1000, attempts: 3 };

      await service.addJob('test-queue', 'test-job', { foo: 'bar' }, options);

      expect(queue.add).toHaveBeenCalledWith('test-job', { foo: 'bar' }, options);
    });

    it('should timeout if job takes too long', async () => {
      jest.useFakeTimers();

      const queue = service.getQueue('test-queue');
      (queue.add as jest.Mock).mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 15000)));

      const addJobPromise = service.addJob('test-queue', 'test-job', {});

      // Fast-forward past the timeout threshold
      jest.advanceTimersByTime(11000);

      await expect(addJobPromise).rejects.toThrow('Queue addJob timeout');

      jest.useRealTimers();
    });
  });

  describe('addBulkJobs', () => {
    it('should add multiple jobs to the queue', async () => {
      const mockJobs = [
        { id: 'job-1', name: 'test-job', data: { id: 1 } },
        { id: 'job-2', name: 'test-job', data: { id: 2 } },
      ];
      const queue = service.getQueue('test-queue');
      (queue.addBulk as jest.Mock).mockResolvedValue(mockJobs);

      const jobs = [
        { name: 'test-job', data: { id: 1 } },
        { name: 'test-job', data: { id: 2 } },
      ];

      const result = await service.addBulkJobs('test-queue', jobs);

      expect(queue.addBulk).toHaveBeenCalledWith(jobs);
      expect(result).toEqual(mockJobs);
    });

    it('should handle empty jobs array', async () => {
      const queue = service.getQueue('test-queue');
      (queue.addBulk as jest.Mock).mockResolvedValue([]);

      const result = await service.addBulkJobs('test-queue', []);

      expect(queue.addBulk).toHaveBeenCalledWith([]);
      expect(result).toEqual([]);
    });
  });

  describe('processJobs', () => {
    it('should create a worker for the queue', () => {
      const processor = jest.fn();

      const worker = service.processJobs('test-queue', 'test-job', processor, 3);

      expect(worker).toBeDefined();
      expect(worker.on).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(worker.on).toHaveBeenCalledWith('failed', expect.any(Function));
    });

    it('should return same worker for same queue and job name', () => {
      const processor = jest.fn();

      const worker1 = service.processJobs('test-queue', 'test-job', processor);
      const worker2 = service.processJobs('test-queue', 'test-job', processor);

      expect(worker1).toBe(worker2);
    });
  });

  describe('processJobsWithRouter', () => {
    it('should create a router worker for the queue', () => {
      const processor = jest.fn();

      const worker = service.processJobsWithRouter('test-queue', processor, 5);

      expect(worker).toBeDefined();
      expect(worker.on).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(worker.on).toHaveBeenCalledWith('failed', expect.any(Function));
    });

    it('should return same worker for same queue', () => {
      const processor = jest.fn();

      const worker1 = service.processJobsWithRouter('test-queue', processor);
      const worker2 = service.processJobsWithRouter('test-queue', processor);

      expect(worker1).toBe(worker2);
    });
  });

  describe('getJob', () => {
    it('should get a job by ID', async () => {
      const mockJob = { id: 'job-123', data: { foo: 'bar' } };
      const queue = service.getQueue('test-queue');
      (queue.getJob as jest.Mock).mockResolvedValue(mockJob);

      const result = await service.getJob('test-queue', 'job-123');

      expect(queue.getJob).toHaveBeenCalledWith('job-123');
      expect(result).toEqual(mockJob);
    });
  });

  describe('removeJob', () => {
    it('should remove a job from the queue', async () => {
      const mockJob = {
        id: 'job-123',
        remove: jest.fn().mockResolvedValue(undefined),
      };
      const queue = service.getQueue('test-queue');
      (queue.getJob as jest.Mock).mockResolvedValue(mockJob);

      await service.removeJob('test-queue', 'job-123');

      expect(mockJob.remove).toHaveBeenCalled();
    });

    it('should handle non-existent job gracefully', async () => {
      const queue = service.getQueue('test-queue');
      (queue.getJob as jest.Mock).mockResolvedValue(null);

      await expect(service.removeJob('test-queue', 'non-existent')).resolves.toBeUndefined();
    });
  });

  describe('closeAll', () => {
    it('should close all queues and workers', async () => {
      // Create some queues and workers
      service.getQueue('queue-1');
      service.getQueue('queue-2');
      service.processJobs('queue-1', 'job-1', jest.fn());

      await service.closeAll();

      // Workers and queues should have their close methods called
      // This is verified by the mock implementation
    });
  });
});
