import { Inject, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { Job } from 'bullmq';
import { KYCAdapter } from '../../../../adapters/kyc/kyc-adapter';
import { GetKycDetailsResponse } from '../../../../adapters/kyc/kyc-adapter.interface';
import { FiatWalletModel, UserModel } from '../../../../database';
import { DatabaseSchema } from '../../../../database/database.schema';
import { DatabaseTables } from '../../../../database/database.table';
import { VirtualAccountType } from '../../../../database/models/virtualAccount';
import { UserRepository } from '../../../../modules/auth/user/user.repository';
import { FiatWalletService } from '../../../../modules/fiatWallet';
import { UserTierRepository } from '../../../../modules/userTier/userTier.repository';
import { CreateVirtualAccountDto } from '../../../../modules/virtualAccount/dtos/createVirtualAccount.dto';
import { VirtualAccountService } from '../../../../modules/virtualAccount/virtualAccount.service';
import { QueueService } from '../../queue.service';

const CHUNK_SIZE = 500;

export interface NgnAccountRetryJobData {
  userId: string;
}

export interface NgnAccountScanJobData {
  offset: number;
}

export class NgnAccountRetryProcessor {
  private readonly logger = new Logger(NgnAccountRetryProcessor.name);
  private readonly queueName = 'ngn-account-retry-processor';
  private readonly scanJobName = 'scan-users';
  private readonly processJobName = 'process-user';
  private processorsRegistered = false;

  @Inject(VirtualAccountService)
  private readonly virtualAccountService: VirtualAccountService;

  @Inject(FiatWalletService)
  private readonly fiatWalletService: FiatWalletService;

  @Inject(KYCAdapter)
  private readonly kycAdapter: KYCAdapter;

  @Inject(UserRepository)
  private readonly userRepository: UserRepository;

  @Inject(UserTierRepository)
  private readonly userTierRepository: UserTierRepository;

  @Inject(QueueService)
  private readonly queueService: QueueService;

  /**
   * Register queue processors (called when first job is queued)
   */
  private registerProcessors() {
    if (this.processorsRegistered) return;

    // Register a single worker that handles all job types
    this.queueService.processJobsWithRouter(
      this.queueName,
      async (job) => {
        if (job.name === this.scanJobName) {
          return await this.processScanJob(job as Job<NgnAccountScanJobData>);
        } else if (job.name === this.processJobName) {
          return await this.processNgnAccountCreation(job as Job<NgnAccountRetryJobData>);
        }
        this.logger.warn(`Unknown job name: ${job.name}`);
        return null;
      },
      5, // concurrency
    );

    this.processorsRegistered = true;
    this.logger.log('NGN account retry processors registered');
  }

  /**
   * Queue a scan job to find and process users without NGN accounts
   */
  public async queueScanJob(): Promise<Job<NgnAccountScanJobData>> {
    this.registerProcessors();
    return this.queueService.addJob(
      this.queueName,
      this.scanJobName,
      { offset: 0 },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );
  }

  /**
   * Process scan job - fetches users in chunks and queues them for processing
   */
  private async processScanJob(
    job: Job<NgnAccountScanJobData>,
  ): Promise<{ processedChunk: number; queuedUsers: number; hasMore: boolean }> {
    const { offset } = job.data;
    this.logger.log(`Processing scan job with offset ${offset}`);

    // Fetch chunk of users without NGN account
    const users = await this.findUsersWithoutNGNAccountChunk(offset, CHUNK_SIZE);

    if (users.length === 0) {
      this.logger.log('No more users to process');
      return { processedChunk: offset / CHUNK_SIZE, queuedUsers: 0, hasMore: false };
    }

    // Queue all users in this chunk for processing using bulk add
    const jobs = users.map((user) => ({
      name: this.processJobName,
      data: { userId: user.id },
      opts: {
        attempts: 3,
        backoff: {
          type: 'exponential' as const,
          delay: 5000,
        },
      },
    }));

    await this.queueService.addBulkJobs(this.queueName, jobs);
    this.logger.log(`Queued ${users.length} users for NGN account creation`);

    // If we got a full chunk, queue next scan job
    const hasMore = users.length === CHUNK_SIZE;
    if (hasMore) {
      await this.queueService.addJob(
        this.queueName,
        this.scanJobName,
        { offset: offset + CHUNK_SIZE },
        {
          delay: 1000, // Small delay to allow current chunk to start processing
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      );
      this.logger.log(`Queued next scan job with offset ${offset + CHUNK_SIZE}`);
    }

    return { processedChunk: offset / CHUNK_SIZE, queuedUsers: users.length, hasMore };
  }

  /**
   * Find users who have completed tier >= 1 but don't have an NGN virtual account (paginated)
   */
  private async findUsersWithoutNGNAccountChunk(offset: number, limit: number): Promise<UserModel[]> {
    this.logger.log(`Finding users without NGN virtual account (offset: ${offset}, limit: ${limit})`);

    const schema = DatabaseSchema.apiService;
    const userTiersTable = `${schema}.${DatabaseTables.user_tiers}`;
    const tiersTable = `${schema}.${DatabaseTables.tiers}`;
    const usersTable = `${schema}.${DatabaseTables.users}`;
    const fiatWalletsTable = `${schema}.${DatabaseTables.fiat_wallets}`;
    const virtualAccountsTable = `${schema}.${DatabaseTables.virtual_accounts}`;

    const knex = this.userTierRepository.model.knex();

    const users = await this.userTierRepository
      .query()
      .select(`${usersTable}.*`)
      .distinct(`${usersTable}.id`)
      .join(tiersTable, `${userTiersTable}.tier_id`, `${tiersTable}.id`)
      .join(usersTable, `${userTiersTable}.user_id`, `${usersTable}.id`)
      .leftJoin(fiatWalletsTable, function () {
        this.on(`${fiatWalletsTable}.user_id`, '=', `${usersTable}.id`).andOn(
          `${fiatWalletsTable}.asset`,
          '=',
          knex.raw('?', ['NGN']),
        );
      })
      .leftJoin(virtualAccountsTable, function () {
        this.on(`${virtualAccountsTable}.fiat_wallet_id`, '=', `${fiatWalletsTable}.id`).andOn(
          `${virtualAccountsTable}.type`,
          '=',
          knex.raw('?', [VirtualAccountType.MAIN_ACCOUNT]),
        );
      })
      .where(`${tiersTable}.level`, '>=', 1)
      .whereNull(`${virtualAccountsTable}.id`)
      .orderBy(`${usersTable}.id`, 'asc')
      .offset(offset)
      .limit(limit);

    this.logger.log(`Found ${users.length} users in chunk (offset: ${offset})`);

    return users as unknown as UserModel[];
  }

  /**
   * Process the NGN account creation for a user
   */
  private async processNgnAccountCreation(job: Job<NgnAccountRetryJobData>): Promise<any> {
    const { userId } = job.data;
    this.logger.log(`Processing NGN account creation for user ${userId}`);

    try {
      const user = (await this.userRepository.findById(userId)) as UserModel;
      if (!user) {
        this.logger.error(`User ${userId} not found`);
        throw new NotFoundException(`User ${userId} not found`);
      }

      // Get KYC details for the user
      const kycDetails = await this.kycAdapter.getKycDetailsByUserId(userId);
      if (!kycDetails?.data) {
        this.logger.error(`KYC details not found for user ${userId}`);
        throw new NotFoundException(`KYC details not found for user ${userId}`);
      }

      // Create NGN bank account
      await this.handleCreateNGNBankAccount(kycDetails.data, user);

      this.logger.log(`Successfully created NGN account for user ${userId}`);
      return { success: true, userId };
    } catch (error) {
      this.logger.error(`Failed to create NGN account for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Creates NGN fiat wallet and virtual account for a user
   */
  private async handleCreateNGNBankAccount(data: GetKycDetailsResponse, user: UserModel) {
    this.logger.log(`Creating NGN bank account for user ${data.userId}`);

    const isNgUser = data.country?.toUpperCase() === 'NGA';

    // Create NGN wallet within a transaction to prevent duplicates
    const ngnWallet = await this.userRepository.transaction(async (trx) => {
      return await this.fiatWalletService.getUserWallet(data.userId, 'NGN', trx);
    });

    if (!ngnWallet) {
      throw new InternalServerErrorException(`Failed to create/get NGN fiat wallet for user ${data.userId}`);
    }
    this.logger.log(`Created/got NGN fiat wallet with ID: ${ngnWallet.id} for user ${data.userId}`);

    const payload: {
      bvn?: string;
      dob: string;
      fiatWallet: FiatWalletModel;
    } = {
      dob: data.dob,
      fiatWallet: ngnWallet,
    };

    if (isNgUser && data.idNumber) {
      payload.bvn = data.idNumber;
    }

    await this.createNGVirtualAccount(user, payload);
  }

  /**
   * Creates NG virtual account for a user
   */
  private async createNGVirtualAccount(
    user: UserModel,
    data: { bvn?: string; dob: string; fiatWallet: FiatWalletModel },
  ) {
    this.logger.log(`Creating NG virtual account for user ${user.id}`);

    if (!user) {
      throw new Error('User is required for virtual account creation');
    }

    if (!data.fiatWallet) {
      throw new Error('Fiat wallet is required for virtual account creation');
    }

    try {
      const payload: CreateVirtualAccountDto = {
        fiat_wallet_id: data.fiatWallet.id,
      };

      if (data.bvn) {
        payload.bvn = data.bvn;
      }

      // Create virtual account within a transaction to prevent duplicates
      const virtualAccount = await this.userRepository.transaction(async (trx) => {
        return await this.virtualAccountService.findOrCreateVirtualAccount(
          user.id,
          payload,
          VirtualAccountType.MAIN_ACCOUNT,
          trx,
        );
      });

      this.logger.log(`Created NG virtual account with ID: ${virtualAccount.id} for user ${user.id}`);
      return virtualAccount;
    } catch (error) {
      this.logger.error(`Error creating virtual account for user ${user.id}: ${error.message}`, error.stack);
      throw new Error(`Error creating virtual account: ${error.message}`);
    }
  }
}
