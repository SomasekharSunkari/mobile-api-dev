import { Inject, Injectable, Logger } from '@nestjs/common';
import { DateTime } from 'luxon';
import { add } from 'mathjs';
import { PaginationDto } from '../../../base/base.dto';
import {
  DoshPointsTransactionStatus,
  IDoshPointsTransaction,
} from '../../../database/models/doshPointsTransaction/doshPointsTransaction.interface';
import { DoshPointsTransactionModel } from '../../../database/models/doshPointsTransaction/doshPointsTransaction.model';
import { DoshPointsTransactionType } from '../../../database/models/doshPointsEvent/doshPointsEvent.interface';
import { DoshPointsException, DoshPointsExceptionType } from '../../../exceptions/dosh_points_exception';
import { LockerService } from '../../../services/locker/locker.service';
import { PushNotificationService } from '../../../services/pushNotification/pushNotification.service';
import { UserProfileRepository } from '../../auth/userProfile/userProfile.repository';
import { IN_APP_NOTIFICATION_TYPE, InAppNotificationService } from '../../inAppNotification';
import { DoshPointsAccountService } from '../doshPointsAccount/doshPointsAccount.service';
import { DoshPointsEventService } from '../doshPointsEvent/doshPointsEvent.service';
import {
  ALLOWED_METADATA_PATHS,
  ICreditPointsParams,
  IDoshPointsLedgerWriteResult,
  IFindOneQuery,
  IMetadataFilter,
} from '../doshPoints.interface';
import { DoshPointsTransactionRepository } from './doshPointsTransaction.repository';

@Injectable()
export class DoshPointsTransactionService {
  private readonly logger = new Logger(DoshPointsTransactionService.name);

  @Inject(DoshPointsTransactionRepository)
  private readonly transactionRepository: DoshPointsTransactionRepository;

  @Inject(DoshPointsAccountService)
  private readonly doshPointsAccountService: DoshPointsAccountService;

  @Inject(DoshPointsEventService)
  private readonly eventService: DoshPointsEventService;

  @Inject(LockerService)
  private readonly lockerService: LockerService;

  @Inject(InAppNotificationService)
  private readonly inAppNotificationService: InAppNotificationService;

  @Inject(PushNotificationService)
  private readonly pushNotificationService: PushNotificationService;

  @Inject(UserProfileRepository)
  private readonly userProfileRepository: UserProfileRepository;

  /**
   * Get transaction history for a user with pagination
   * Filters out internal tracking transactions (amount = 0)
   * @param user_id - The user's ID
   * @param pagination - Page and limit options
   * @returns Paginated transaction history
   */
  public async getTransactionHistory(user_id: string, pagination: PaginationDto = {}) {
    const { page = 1, limit = 10 } = pagination;

    const queryBuilder = this.transactionRepository
      .query()
      .where('user_id', user_id)
      .where('amount', '>', 0)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset((page - 1) * limit);

    return this.transactionRepository.paginateData(queryBuilder as any, limit, page);
  }

  /**
   * Find a transaction by query with optional JSON metadata filtering
   * @param query - Standard column filters
   * @param metadataFilter - Optional JSON path filter for metadata column
   * @returns The transaction or null
   */
  public async findOne(
    query: IFindOneQuery,
    metadataFilter?: IMetadataFilter,
  ): Promise<DoshPointsTransactionModel | null | undefined> {
    if (!metadataFilter) {
      return this.transactionRepository.findOne(query);
    }

    // Validate metadata path against allowlist to prevent SQL injection
    if (!ALLOWED_METADATA_PATHS.includes(metadataFilter.path)) {
      throw new Error(`Invalid metadata path: ${metadataFilter.path}`);
    }

    const queryBuilder = this.transactionRepository.query();

    if (query.user_id) {
      queryBuilder.where('user_id', query.user_id);
    }
    if (query.event_code) {
      queryBuilder.where('event_code', query.event_code);
    }
    if (query.source_reference) {
      queryBuilder.where('source_reference', query.source_reference);
    }

    queryBuilder.whereRaw(`metadata->${metadataFilter.path} = ?`, [metadataFilter.value]);

    const result = await queryBuilder.first();
    return result as DoshPointsTransactionModel | undefined;
  }

  /**
   * Update a transaction
   * @param transactionId - The transaction ID
   * @param data - The data to update
   */
  public async update(transactionId: string, data: Partial<IDoshPointsTransaction>) {
    return this.transactionRepository.update(transactionId, data);
  }

  /**
   * Credit points to a user's account
   * Handles idempotency, one-time event validation, and atomic balance updates
   * @param params - Credit parameters
   * @returns The transaction and account, with flag indicating if duplicate
   */
  public async creditPoints(params: ICreditPointsParams): Promise<IDoshPointsLedgerWriteResult> {
    const { user_id, event_code, source_reference, description, metadata } = params;

    this.logger.log(`Crediting points for user: ${user_id}, event: ${event_code}, source: ${source_reference}`);

    // Lock to prevent race conditions across multiple app instances
    const lockKey = `dosh_points_credit_${user_id}_${event_code}_${source_reference}`;

    return this.lockerService.runWithLock(lockKey, async () => {
      // Step 1: Validate event config
      const event = await this.eventService.findByCode(event_code);

      // Step 2: Check for existing transaction (handles both idempotency and one-time events)
      // For one-time events: check by user + event (any source)
      // For multi-use events: check by user + event + source (exact match)
      const existingTransaction = await this.transactionRepository.findOne(
        event.is_one_time_per_user ? { user_id, event_code } : { user_id, event_code, source_reference },
      );

      if (existingTransaction) {
        // REJECT: One-time event already earned with a different source
        // Example: User got ONBOARDING_BONUS for tier_123, now trying again with tier_456
        if (event.is_one_time_per_user && existingTransaction.source_reference !== source_reference) {
          throw new DoshPointsException(DoshPointsExceptionType.ALREADY_EARNED, event_code);
        }

        // SUCCESS (idempotent): Exact same request was already processed
        // Example: Retry due to network timeout - return the original transaction
        this.logger.log(`Duplicate transaction found: ${existingTransaction.id}, returning existing`);
        return {
          transaction: existingTransaction,
          is_duplicate: true,
        };
      }

      // Step 3: Get or create account
      const currentAccount = await this.doshPointsAccountService.findOrCreate(user_id);

      // Calculate amounts (convert from bigint/string to number)
      const pointsToCredit = Number(event.default_points);
      const balanceBefore = Number(currentAccount.balance);
      const balanceAfter = Number(add(balanceBefore, pointsToCredit));

      // Generate idempotency key from user + event + source
      const idempotency_key = `${user_id}_${event_code}_${source_reference}`;

      // Step 4: Create transaction and update balance atomically
      return this.transactionRepository.transaction(async (trx) => {
        const transaction = await this.transactionRepository.create(
          {
            dosh_points_account_id: currentAccount.id,
            user_id,
            event_code,
            transaction_type: DoshPointsTransactionType.CREDIT,
            amount: pointsToCredit,
            balance_before: balanceBefore,
            balance_after: balanceAfter,
            source_reference,
            description: description ?? event.name,
            metadata,
            status: DoshPointsTransactionStatus.COMPLETED,
            idempotency_key,
            processed_at: DateTime.now().toISO(),
          },
          trx,
        );

        const account = await this.doshPointsAccountService.updateBalance(currentAccount.id, balanceAfter, trx);

        this.logger.log(`Points credited: ${pointsToCredit} to user ${user_id}, new balance: ${balanceAfter}`);

        // Send in-app notification for points earned (only if points > 0)
        if (pointsToCredit > 0) {
          const title = 'Dosh Points Earned!';
          const message = `You earned ${pointsToCredit} Dosh Points for ${event.name}.`;

          let inAppSuccess = false;
          let pushSuccess = false;

          try {
            await this.inAppNotificationService.createNotification({
              user_id,
              type: IN_APP_NOTIFICATION_TYPE.REWARDS,
              title,
              message,
            });
            inAppSuccess = true;
          } catch (error) {
            this.logger.error(`Failed to send in-app notification for user ${user_id}: ${error.message}`, error);
            // Do not rethrow - transaction should complete even if notification fails
          }

          try {
            const userProfile = await this.userProfileRepository.findByUserId(user_id);

            if (userProfile?.notification_token) {
              this.logger.log(`Sending push notification to user ${user_id}`);
              await this.pushNotificationService.sendPushNotification([userProfile.notification_token], {
                title,
                body: message,
              });
              this.logger.log(`Push notification sent to user ${user_id}`);
              pushSuccess = true;
            } else {
              this.logger.log(`No notification token found for user ${user_id}, skipping push notification`);
            }
          } catch (error) {
            this.logger.error(`Failed to send push notification for user ${user_id}: ${error.message}`, error);
            // Do not rethrow - transaction should complete even if notification fails
          }

          this.logger.debug(
            `Notification summary for user ${user_id}: In-App=${inAppSuccess ? '✓' : '✗'}, Push=${pushSuccess ? '✓' : '✗'}`,
          );
        }

        return {
          transaction,
          account,
          is_duplicate: false,
        };
      });
    });
  }
}
