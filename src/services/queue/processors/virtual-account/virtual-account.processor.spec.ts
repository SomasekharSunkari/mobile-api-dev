import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { WaasAdapter } from '../../../../adapters/waas/waas.adapter';
import { VirtualAccountType } from '../../../../database/models/virtualAccount';
import { UserTierService } from '../../../../modules/userTier/userTier.service';
import { VirtualAccountRepository } from '../../../../modules/virtualAccount/virtualAccount.repository';
import { VirtualAccountService } from '../../../../modules/virtualAccount/virtualAccount.service';
import { QueueService } from '../../queue.service';
import {
  DeleteVirtualAccountJobData,
  VirtualAccountJobData,
  VirtualAccountProcessor,
} from './virtual-account.processor';

describe('VirtualAccountProcessor', () => {
  let processor: VirtualAccountProcessor;

  const mockVirtualAccountService = {
    create: jest.fn(),
    findOrCreateVirtualAccount: jest.fn(),
  };

  const mockVirtualAccountRepository = {
    findOne: jest.fn(),
    delete: jest.fn(),
  };

  const mockWaasAdapter = {
    deleteVirtualAccount: jest.fn(),
  };

  const mockQueueService = {
    addJob: jest.fn(),
    processJobs: jest.fn(),
  };

  const mockUserTierService = {
    getUserCurrentTier: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VirtualAccountProcessor,
        { provide: VirtualAccountService, useValue: mockVirtualAccountService },
        { provide: VirtualAccountRepository, useValue: mockVirtualAccountRepository },
        { provide: WaasAdapter, useValue: mockWaasAdapter },
        { provide: QueueService, useValue: mockQueueService },
        { provide: UserTierService, useValue: mockUserTierService },
      ],
    }).compile();

    processor = module.get<VirtualAccountProcessor>(VirtualAccountProcessor);
  });

  describe('queueVirtualAccount', () => {
    it('should add job to queue and register processors', async () => {
      const jobData: VirtualAccountJobData = {
        userId: 'user-123',
        data: { fiat_wallet_id: 'wallet-123' },
        type: VirtualAccountType.MAIN_ACCOUNT,
      };

      const mockJob = { id: 'job-123', data: jobData };
      mockQueueService.addJob.mockResolvedValue(mockJob);

      const result = await processor.queueVirtualAccount(jobData);

      expect(mockQueueService.processJobs).toHaveBeenCalledWith(
        'virtual-account-processor',
        'virtual-account-processor',
        expect.any(Function),
        3,
      );
      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        'virtual-account-processor',
        'virtual-account-processor',
        jobData,
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );
      expect(result).toEqual(mockJob);
    });

    it('should only register processors once', async () => {
      const jobData: VirtualAccountJobData = {
        userId: 'user-123',
        data: { fiat_wallet_id: 'wallet-123' },
        type: VirtualAccountType.MAIN_ACCOUNT,
      };

      mockQueueService.addJob.mockResolvedValue({ id: 'job-123', data: jobData });

      await processor.queueVirtualAccount(jobData);
      await processor.queueVirtualAccount(jobData);

      // processJobs should only be called once (first time)
      expect(mockQueueService.processJobs).toHaveBeenCalledTimes(1);
      // addJob should be called twice
      expect(mockQueueService.addJob).toHaveBeenCalledTimes(2);
    });
  });

  describe('processVirtualAccount (private method via queueVirtualAccount)', () => {
    it('should create virtual account when user tier is at least 1', async () => {
      const jobData: VirtualAccountJobData = {
        userId: 'user-123',
        data: { fiat_wallet_id: 'wallet-123' },
        type: VirtualAccountType.MAIN_ACCOUNT,
      };

      mockUserTierService.getUserCurrentTier.mockResolvedValue({ level: 1 });
      mockVirtualAccountService.findOrCreateVirtualAccount.mockResolvedValue({ id: 'va-123' });

      // Queue the job to register processors
      await processor.queueVirtualAccount(jobData);

      // Get the processor callback that was registered
      const processorCallback = mockQueueService.processJobs.mock.calls[0][2];

      // Create a mock job
      const mockJob = { data: jobData } as Job<VirtualAccountJobData>;

      // Call the processor directly
      const result = await processorCallback(mockJob);

      expect(mockUserTierService.getUserCurrentTier).toHaveBeenCalledWith('user-123');
      expect(mockVirtualAccountService.findOrCreateVirtualAccount).toHaveBeenCalledWith(
        'user-123',
        { fiat_wallet_id: 'wallet-123' },
        VirtualAccountType.MAIN_ACCOUNT,
      );
      expect(result).toEqual({ id: 'va-123' });
    });

    it('should throw BadRequestException when user tier is less than 1', async () => {
      const jobData: VirtualAccountJobData = {
        userId: 'user-123',
        data: { fiat_wallet_id: 'wallet-123' },
        type: VirtualAccountType.MAIN_ACCOUNT,
      };

      mockUserTierService.getUserCurrentTier.mockResolvedValue({ level: 0 });

      // Queue the job to register processors
      await processor.queueVirtualAccount(jobData);

      // Get the processor callback that was registered
      const processorCallback = mockQueueService.processJobs.mock.calls[0][2];

      // Create a mock job
      const mockJob = { data: jobData } as Job<VirtualAccountJobData>;

      // Call the processor and expect error
      await expect(processorCallback(mockJob)).rejects.toThrow(BadRequestException);
      await expect(processorCallback(mockJob)).rejects.toThrow(
        'User must be at least tier 1 to create a virtual account',
      );
    });

    it('should proceed when user tier is null (edge case - undefined level is not less than 1)', async () => {
      const jobData: VirtualAccountJobData = {
        userId: 'user-123',
        data: { fiat_wallet_id: 'wallet-123' },
        type: VirtualAccountType.MAIN_ACCOUNT,
      };

      mockUserTierService.getUserCurrentTier.mockResolvedValue(null);
      mockVirtualAccountService.findOrCreateVirtualAccount.mockResolvedValue({ id: 'va-123' });

      // Queue the job to register processors
      await processor.queueVirtualAccount(jobData);

      // Get the processor callback that was registered
      const processorCallback = mockQueueService.processJobs.mock.calls[0][2];

      // Create a mock job
      const mockJob = { data: jobData } as Job<VirtualAccountJobData>;

      // When userTier is null, userTier?.level is undefined, and undefined < 1 is false
      // So the processor will attempt to create the virtual account
      const result = await processorCallback(mockJob);
      expect(result).toEqual({ id: 'va-123' });
    });

    it('should propagate errors from virtual account service', async () => {
      const jobData: VirtualAccountJobData = {
        userId: 'user-123',
        data: { fiat_wallet_id: 'wallet-123' },
        type: VirtualAccountType.MAIN_ACCOUNT,
      };

      mockUserTierService.getUserCurrentTier.mockResolvedValue({ level: 1 });
      mockVirtualAccountService.findOrCreateVirtualAccount.mockRejectedValue(
        new Error('Virtual account creation failed'),
      );

      // Queue the job to register processors
      await processor.queueVirtualAccount(jobData);

      // Get the processor callback that was registered
      const processorCallback = mockQueueService.processJobs.mock.calls[0][2];

      // Create a mock job
      const mockJob = { data: jobData } as Job<VirtualAccountJobData>;

      // Call the processor and expect error
      await expect(processorCallback(mockJob)).rejects.toThrow('Virtual account creation failed');
    });

    it('should handle tier level exactly 1', async () => {
      const jobData: VirtualAccountJobData = {
        userId: 'user-123',
        data: { fiat_wallet_id: 'wallet-123' },
        type: VirtualAccountType.MAIN_ACCOUNT,
      };

      mockUserTierService.getUserCurrentTier.mockResolvedValue({ level: 1 });
      mockVirtualAccountService.findOrCreateVirtualAccount.mockResolvedValue({ id: 'va-123' });

      // Queue the job to register processors
      await processor.queueVirtualAccount(jobData);

      // Get the processor callback that was registered
      const processorCallback = mockQueueService.processJobs.mock.calls[0][2];

      // Create a mock job
      const mockJob = { data: jobData } as Job<VirtualAccountJobData>;

      // Call the processor directly
      const result = await processorCallback(mockJob);

      expect(result).toEqual({ id: 'va-123' });
    });

    it('should handle tier level greater than 1', async () => {
      const jobData: VirtualAccountJobData = {
        userId: 'user-123',
        data: { fiat_wallet_id: 'wallet-123' },
        type: VirtualAccountType.MAIN_ACCOUNT,
      };

      mockUserTierService.getUserCurrentTier.mockResolvedValue({ level: 3 });
      mockVirtualAccountService.findOrCreateVirtualAccount.mockResolvedValue({ id: 'va-123' });

      // Queue the job to register processors
      await processor.queueVirtualAccount(jobData);

      // Get the processor callback that was registered
      const processorCallback = mockQueueService.processJobs.mock.calls[0][2];

      // Create a mock job
      const mockJob = { data: jobData } as Job<VirtualAccountJobData>;

      // Call the processor directly
      const result = await processorCallback(mockJob);

      expect(result).toEqual({ id: 'va-123' });
    });
  });

  describe('queueDeleteVirtualAccount', () => {
    it('should add delete job to queue and register delete processors', async () => {
      const jobData: DeleteVirtualAccountJobData = {
        accountNumber: '1234567890',
        reason: 'User requested deletion',
      };

      const mockJob = { id: 'job-123', data: jobData };
      mockQueueService.addJob.mockResolvedValue(mockJob);

      const result = await processor.queueDeleteVirtualAccount(jobData);

      expect(mockQueueService.processJobs).toHaveBeenCalledWith(
        'virtual-account-delete-processor',
        'virtual-account-delete-processor',
        expect.any(Function),
        3,
      );
      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        'virtual-account-delete-processor',
        'virtual-account-delete-processor',
        jobData,
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );
      expect(result).toEqual(mockJob);
    });

    it('should only register delete processors once', async () => {
      const jobData: DeleteVirtualAccountJobData = {
        accountNumber: '1234567890',
      };

      mockQueueService.addJob.mockResolvedValue({ id: 'job-123', data: jobData });

      await processor.queueDeleteVirtualAccount(jobData);
      await processor.queueDeleteVirtualAccount(jobData);

      // processJobs for delete should only be called once
      const deleteProcessorCalls = mockQueueService.processJobs.mock.calls.filter(
        (call) => call[0] === 'virtual-account-delete-processor',
      );
      expect(deleteProcessorCalls).toHaveLength(1);
      // addJob should be called twice
      expect(mockQueueService.addJob).toHaveBeenCalledTimes(2);
    });
  });

  describe('processDeleteVirtualAccount', () => {
    it('should delete virtual account successfully for exchange account', async () => {
      const jobData: DeleteVirtualAccountJobData = {
        accountNumber: '1234567890',
        reason: 'User requested deletion',
      };

      const mockVirtualAccount = {
        id: 'va-123',
        account_number: '1234567890',
        type: VirtualAccountType.EXCHANGE_ACCOUNT,
        bank_ref: 'bank-ref-123',
      };

      mockVirtualAccountRepository.findOne.mockResolvedValue(mockVirtualAccount);
      mockWaasAdapter.deleteVirtualAccount.mockResolvedValue({ status: 'success' });
      mockVirtualAccountRepository.delete.mockResolvedValue(1);

      // Queue the job to register processors
      await processor.queueDeleteVirtualAccount(jobData);

      // Get the processor callback that was registered
      const processorCallback = mockQueueService.processJobs.mock.calls.find(
        (call) => call[0] === 'virtual-account-delete-processor',
      )[2];

      // Create a mock job
      const mockJob = { data: jobData } as Job<DeleteVirtualAccountJobData>;

      // Call the processor directly
      const result = await processorCallback(mockJob);

      expect(mockVirtualAccountRepository.findOne).toHaveBeenCalledWith({ account_number: '1234567890' });
      expect(mockWaasAdapter.deleteVirtualAccount).toHaveBeenCalledWith({
        accountNumber: '1234567890',
        ref: expect.any(String),
        reason: 'User requested deletion',
        isMainAccount: false,
      });
      expect(mockVirtualAccountRepository.delete).toHaveBeenCalledWith('va-123');
      expect(result).toEqual({ success: true, message: 'Virtual account deleted successfully' });
    });

    it('should return failure when virtual account not found', async () => {
      const jobData: DeleteVirtualAccountJobData = {
        accountNumber: '1234567890',
      };

      mockVirtualAccountRepository.findOne.mockResolvedValue(null);

      // Queue the job to register processors
      await processor.queueDeleteVirtualAccount(jobData);

      // Get the processor callback that was registered
      const processorCallback = mockQueueService.processJobs.mock.calls.find(
        (call) => call[0] === 'virtual-account-delete-processor',
      )[2];

      // Create a mock job
      const mockJob = { data: jobData } as Job<DeleteVirtualAccountJobData>;

      // Call the processor directly
      const result = await processorCallback(mockJob);

      expect(result).toEqual({ success: false, message: 'Virtual account not found' });
      expect(mockWaasAdapter.deleteVirtualAccount).not.toHaveBeenCalled();
      expect(mockVirtualAccountRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when trying to delete main account', async () => {
      const jobData: DeleteVirtualAccountJobData = {
        accountNumber: '1234567890',
      };

      const mockVirtualAccount = {
        id: 'va-123',
        account_number: '1234567890',
        type: VirtualAccountType.MAIN_ACCOUNT,
        bank_ref: 'bank-ref-123',
      };

      mockVirtualAccountRepository.findOne.mockResolvedValue(mockVirtualAccount);

      // Queue the job to register processors
      await processor.queueDeleteVirtualAccount(jobData);

      // Get the processor callback that was registered
      const processorCallback = mockQueueService.processJobs.mock.calls.find(
        (call) => call[0] === 'virtual-account-delete-processor',
      )[2];

      // Create a mock job
      const mockJob = { data: jobData } as Job<DeleteVirtualAccountJobData>;

      // Call the processor and expect error
      await expect(processorCallback(mockJob)).rejects.toThrow(BadRequestException);
      expect(mockWaasAdapter.deleteVirtualAccount).not.toHaveBeenCalled();
      expect(mockVirtualAccountRepository.delete).not.toHaveBeenCalled();
    });

    it('should propagate errors from waas adapter', async () => {
      const jobData: DeleteVirtualAccountJobData = {
        accountNumber: '1234567890',
      };

      const mockVirtualAccount = {
        id: 'va-123',
        account_number: '1234567890',
        type: VirtualAccountType.EXCHANGE_ACCOUNT,
        bank_ref: 'bank-ref-123',
      };

      mockVirtualAccountRepository.findOne.mockResolvedValue(mockVirtualAccount);
      mockWaasAdapter.deleteVirtualAccount.mockRejectedValue(new Error('Provider deletion failed'));

      // Queue the job to register processors
      await processor.queueDeleteVirtualAccount(jobData);

      // Get the processor callback that was registered
      const processorCallback = mockQueueService.processJobs.mock.calls.find(
        (call) => call[0] === 'virtual-account-delete-processor',
      )[2];

      // Create a mock job
      const mockJob = { data: jobData } as Job<DeleteVirtualAccountJobData>;

      // Call the processor and expect error
      await expect(processorCallback(mockJob)).rejects.toThrow('Provider deletion failed');
      expect(mockVirtualAccountRepository.delete).not.toHaveBeenCalled();
    });

    it('should delete without reason when not provided', async () => {
      const jobData: DeleteVirtualAccountJobData = {
        accountNumber: '1234567890',
      };

      const mockVirtualAccount = {
        id: 'va-123',
        account_number: '1234567890',
        type: VirtualAccountType.EXCHANGE_ACCOUNT,
        bank_ref: 'bank-ref-123',
      };

      mockVirtualAccountRepository.findOne.mockResolvedValue(mockVirtualAccount);
      mockWaasAdapter.deleteVirtualAccount.mockResolvedValue({ status: 'success' });
      mockVirtualAccountRepository.delete.mockResolvedValue(1);

      // Queue the job to register processors
      await processor.queueDeleteVirtualAccount(jobData);

      // Get the processor callback that was registered
      const processorCallback = mockQueueService.processJobs.mock.calls.find(
        (call) => call[0] === 'virtual-account-delete-processor',
      )[2];

      // Create a mock job
      const mockJob = { data: jobData } as Job<DeleteVirtualAccountJobData>;

      // Call the processor directly
      await processorCallback(mockJob);

      expect(mockWaasAdapter.deleteVirtualAccount).toHaveBeenCalledWith({
        accountNumber: '1234567890',
        ref: expect.any(String),
        reason: undefined,
        isMainAccount: false,
      });
    });

    it('should continue and return success when database delete fails', async () => {
      const jobData: DeleteVirtualAccountJobData = {
        accountNumber: '1234567890',
        reason: 'User requested deletion',
      };

      const mockVirtualAccount = {
        id: 'va-123',
        account_number: '1234567890',
        type: VirtualAccountType.EXCHANGE_ACCOUNT,
        bank_ref: 'bank-ref-123',
      };

      mockVirtualAccountRepository.findOne.mockResolvedValue(mockVirtualAccount);
      mockWaasAdapter.deleteVirtualAccount.mockResolvedValue({ status: 'success' });
      mockVirtualAccountRepository.delete.mockRejectedValue(new Error('Database connection failed'));

      // Queue the job to register processors
      await processor.queueDeleteVirtualAccount(jobData);

      // Get the processor callback that was registered
      const processorCallback = mockQueueService.processJobs.mock.calls.find(
        (call) => call[0] === 'virtual-account-delete-processor',
      )[2];

      // Create a mock job
      const mockJob = { data: jobData } as Job<DeleteVirtualAccountJobData>;

      // Call the processor directly - should succeed even if db delete fails
      const result = await processorCallback(mockJob);

      expect(mockWaasAdapter.deleteVirtualAccount).toHaveBeenCalled();
      expect(mockVirtualAccountRepository.delete).toHaveBeenCalledWith('va-123');
      expect(result).toEqual({ success: true, message: 'Virtual account deleted successfully' });
    });
  });
});
