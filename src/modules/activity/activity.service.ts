import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import { UserModel } from '../../database/models';
import { ActivityRepository } from './activity.repository';
import { IActivityFilters, IActivityPaginatedResponse } from './activity.interface';
import { GetActivitiesDto } from './dto';
import { TransactionService } from '../transaction/transaction.service';
import { ExternalAccountService } from '../externalAccount/external-account.service';
import { BlockchainAccountsService } from '../blockchainAccounts/blockchainAccounts.service';
import { VirtualAccountRepository } from '../virtualAccount/virtualAccount.repository';
import { KycStatusLogRepository } from '../auth/kycStatusLog/kycStatusLog.repository';
import { KycVerificationRepository } from '../auth/kycVerification/kycVerification.repository';

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  @Inject(ActivityRepository)
  private readonly activityRepository: ActivityRepository;

  @Inject(TransactionService)
  private readonly transactionService: TransactionService;

  @Inject(ExternalAccountService)
  private readonly externalAccountService: ExternalAccountService;

  @Inject(BlockchainAccountsService)
  private readonly blockchainAccountsService: BlockchainAccountsService;

  @Inject(VirtualAccountRepository)
  private readonly virtualAccountRepository: VirtualAccountRepository;

  @Inject(KycStatusLogRepository)
  private readonly kycStatusLogRepository: KycStatusLogRepository;

  @Inject(KycVerificationRepository)
  private readonly kycVerificationRepository: KycVerificationRepository;

  async getUserActivities(user: UserModel, filters: GetActivitiesDto = {}): Promise<IActivityPaginatedResponse> {
    this.logger.log(`Fetching activities for user ${user.id} with filters: ${JSON.stringify(filters)}`);

    const activityFilters: IActivityFilters = {
      activity_type: filters.activity_type,
      start_date: filters.start_date,
      end_date: filters.end_date,
      page: filters.page,
      limit: filters.limit,
    };

    try {
      const result = await this.activityRepository.getUserActivities(user.id, activityFilters);
      this.logger.log(
        `Retrieved ${result.activities.length} activities for user ${user.id} (page ${result.pagination.current_page} of ${result.pagination.page_count})`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Failed to fetch activities for user ${user.id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getActivityDetails(
    id: string,
    activityType: string,
    user: UserModel,
  ): Promise<{
    activity_type: string;
    details: Record<string, any>;
  }> {
    this.logger.log(`Fetching ${activityType} details for ID ${id} by user ${user.id}`);

    try {
      // Delegate to the appropriate service based on activity type
      // This reuses existing business logic and validation from each service

      switch (activityType) {
        case 'transaction': {
          // Use TransactionService which includes child transactions and proper validation
          const transaction = await this.transactionService.findOne({ id, user_id: user.id });
          return {
            activity_type: 'transaction',
            details: transaction,
          };
        }

        case 'external_account': {
          // Use ExternalAccountService which includes user validation
          const externalAccount = await this.externalAccountService.getExternalAccount(user, id);
          return {
            activity_type: 'external_account',
            details: externalAccount,
          };
        }

        case 'blockchain_account': {
          // Use BlockchainAccountsService but add user validation
          const blockchainAccount = await this.blockchainAccountsService.getAccountById(id);

          // Validate user ownership since BlockchainAccountsService doesn't check this
          if (blockchainAccount.user_id !== user.id) {
            throw new NotFoundException('Blockchain account not found or access denied');
          }

          return {
            activity_type: 'blockchain_account',
            details: blockchainAccount,
          };
        }

        case 'virtual_account': {
          // Use VirtualAccountRepository directly with user validation
          const virtualAccount = await this.virtualAccountRepository.findById(id);

          if (!virtualAccount || virtualAccount.user_id !== user.id) {
            throw new NotFoundException('Virtual account not found or access denied');
          }

          return {
            activity_type: 'virtual_account',
            details: virtualAccount,
          };
        }

        case 'kyc_status': {
          // For KYC status logs, we need to join with KYC verification to validate user ownership
          const kycStatusLog = await this.kycStatusLogRepository.findById(id);

          if (!kycStatusLog) {
            throw new NotFoundException('KYC status log not found');
          }

          // Get the associated KYC verification to validate user ownership
          const kycVerification = await this.kycVerificationRepository.findById(kycStatusLog.kyc_id);

          if (!kycVerification || kycVerification.user_id !== user.id) {
            throw new NotFoundException('KYC status log not found or access denied');
          }

          // Combine the data like the original query did
          const combinedDetails = {
            ...kycStatusLog,
            user_id: kycVerification.user_id,
            provider: kycVerification.provider,
            kyc_status: kycVerification.status,
          };

          return {
            activity_type: 'kyc_status',
            details: combinedDetails,
          };
        }

        default:
          this.logger.warn(`Invalid activity type requested: ${activityType} for user ${user.id}`);
          throw new NotFoundException('Invalid activity type');
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        this.logger.warn(`${activityType} with ID ${id} not found for user ${user.id}`);
      } else {
        this.logger.error(`Failed to fetch ${activityType} details for ID ${id}: ${error.message}`, error.stack);
      }
      throw error;
    }
  }
}
