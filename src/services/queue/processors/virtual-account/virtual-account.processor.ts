import { BadRequestException, Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { WaasAdapter } from '../../../../adapters/waas/waas.adapter';
import { VirtualAccountType } from '../../../../database/models/virtualAccount';
import { UserTierService } from '../../../../modules/userTier/userTier.service';
import { CreateVirtualAccountDto } from '../../../../modules/virtualAccount/dtos/createVirtualAccount.dto';
import { VirtualAccountRepository } from '../../../../modules/virtualAccount/virtualAccount.repository';
import { VirtualAccountService } from '../../../../modules/virtualAccount/virtualAccount.service';
import { UtilsService } from '../../../../utils/utils.service';
import { QueueService } from '../../queue.service';

export interface VirtualAccountJobData {
  userId: string;
  data: CreateVirtualAccountDto;
  type: VirtualAccountType;
}

export interface DeleteVirtualAccountJobData {
  accountNumber: string;
  reason?: string;
}

export class VirtualAccountProcessor {
  private readonly logger = new Logger(VirtualAccountProcessor.name);
  private readonly queueName = 'virtual-account-processor';
  private readonly deleteQueueName = 'virtual-account-delete-processor';
  private processorsRegistered = false;
  private deleteProcessorsRegistered = false;

  @Inject(VirtualAccountService)
  private readonly virtualAccountService: VirtualAccountService;

  @Inject(VirtualAccountRepository)
  private readonly virtualAccountRepository: VirtualAccountRepository;

  @Inject(WaasAdapter)
  private readonly waasAdapter: WaasAdapter;

  @Inject(QueueService)
  private readonly queueService: QueueService;

  @Inject(UserTierService)
  private readonly userTierService: UserTierService;

  /**
   * Register queue processors (called when first job is queued)
   */
  private registerProcessors() {
    if (this.processorsRegistered) return;

    this.queueService.processJobs<VirtualAccountJobData>(
      this.queueName,
      this.queueName,
      this.processVirtualAccount.bind(this),
      3, // Max 3 concurrent virtual account operations
    );

    this.processorsRegistered = true;
    this.logger.log('Virtual account processors registered');
  }

  /**
   * Register delete queue processors (called when first delete job is queued)
   */
  private registerDeleteProcessors() {
    if (this.deleteProcessorsRegistered) return;

    this.queueService.processJobs<DeleteVirtualAccountJobData>(
      this.deleteQueueName,
      this.deleteQueueName,
      this.processDeleteVirtualAccount.bind(this),
      3, // Max 3 concurrent delete operations
    );

    this.deleteProcessorsRegistered = true;
    this.logger.log('Virtual account delete processors registered');
  }

  public async queueVirtualAccount(data: VirtualAccountJobData): Promise<Job<VirtualAccountJobData>> {
    // Register processors on first use (when Redis is ready)
    this.registerProcessors();
    return this.queueService.addJob(this.queueName, this.queueName, data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }

  public async queueDeleteVirtualAccount(data: DeleteVirtualAccountJobData): Promise<Job<DeleteVirtualAccountJobData>> {
    // Register delete processors on first use (when Redis is ready)
    this.registerDeleteProcessors();
    return this.queueService.addJob(this.deleteQueueName, this.deleteQueueName, data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }

  /**
   * Process the virtual account creation operation in background
   */
  private async processVirtualAccount(job: Job<VirtualAccountJobData>): Promise<any> {
    const { userId, data, type } = job.data;
    const userTier = await this.userTierService.getUserCurrentTier(userId);

    if (userTier?.level < 1) {
      throw new BadRequestException('User must be at least tier 1 to create a virtual account');
    }

    try {
      const virtualAccount = await this.virtualAccountService.findOrCreateVirtualAccount(userId, data, type);
      return virtualAccount;
    } catch (error) {
      this.logger.error(`Failed to create virtual account for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Process the virtual account deletion operation in background
   */
  private async processDeleteVirtualAccount(job: Job<DeleteVirtualAccountJobData>): Promise<any> {
    const { accountNumber, reason } = job.data;

    try {
      // Find the virtual account by account number
      const virtualAccount = await this.virtualAccountRepository.findOne({ account_number: accountNumber });

      if (!virtualAccount) {
        this.logger.warn(`Virtual account with account number ${accountNumber} not found`);
        return { success: false, message: 'Virtual account not found' };
      }

      // Prevent deletion of main accounts
      if (virtualAccount.type === VirtualAccountType.MAIN_ACCOUNT) {
        this.logger.warn(`Cannot delete main account: ${accountNumber}`);
        throw new BadRequestException('Cannot delete main account');
      }

      // Delete from the provider
      await this.waasAdapter.deleteVirtualAccount({
        accountNumber: accountNumber,
        ref: UtilsService.generateCode(15),
        reason: reason,
        isMainAccount: false,
      });

      // Delete from the database
      try {
        await this.virtualAccountRepository.delete(virtualAccount.id);
      } catch (error) {
        this.logger.error(`Failed to delete virtual account from database: ${error.message}`, error.stack);
      }

      this.logger.log(`Successfully deleted virtual account: ${accountNumber}`);
      return { success: true, message: 'Virtual account deleted successfully' };
    } catch (error) {
      this.logger.error(`Failed to delete virtual account ${accountNumber}: ${error.message}`, error.stack);
      throw error;
    }
  }
}
