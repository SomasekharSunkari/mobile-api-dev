import { Test, TestingModule } from '@nestjs/testing';
import { NgnAccountRetryController } from './ngnAccountRetry.controller';
import { NgnAccountRetryService } from './ngnAccountRetry.service';

describe('NgnAccountRetryController', () => {
  let controller: NgnAccountRetryController;
  let mockService: jest.Mocked<NgnAccountRetryService>;

  beforeEach(async () => {
    mockService = {
      triggerRetry: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NgnAccountRetryController],
      providers: [
        {
          provide: NgnAccountRetryService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<NgnAccountRetryController>(NgnAccountRetryController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('triggerRetry', () => {
    it('should call service and return transformed response', async () => {
      const serviceResult = {
        message: 'Scan job queued. Users will be processed in chunks of 500.',
      };
      mockService.triggerRetry.mockResolvedValue(serviceResult);

      const result = await controller.triggerRetry();

      expect(mockService.triggerRetry).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        statusCode: 200,
        message: 'NGN account retry scan job queued successfully',
        data: serviceResult,
      });
      expect(result.timestamp).toBeDefined();
    });

    it('should propagate errors from service', async () => {
      const error = new Error('Service error');
      mockService.triggerRetry.mockRejectedValue(error);

      await expect(controller.triggerRetry()).rejects.toThrow('Service error');
    });
  });
});
