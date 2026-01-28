import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { add } from 'mathjs';
import { Transaction } from 'objection';
import { DATE_TIME_FORMAT } from '../../constants/constants';
import { CurrencyUtility, SUPPORTED_CURRENCIES } from '../../currencies/currencies';
import {
  FiatWalletTransactionType,
  ITransactionUpdateMetadata,
  TransactionCategory,
  TransactionModel,
  TransactionScope,
  TransactionStatus,
  TransactionType,
  UserProfileModel,
} from '../../database';
import { DepositProcessedMail } from '../../notifications/mails/deposit_processed_mail';
import { RewardProcessedMail } from '../../notifications/mails/reward_processed_mail';
import { TransferSuccessfulMail } from '../../notifications/mails/transfer_successful_mail';
import { UsdFundsReceivedMail } from '../../notifications/mails/usd_funds_received_mail';
import { WalletExchangeSuccessMail } from '../../notifications/mails/wallet_exchange_success_mail';
import { WithdrawalProcessedMail } from '../../notifications/mails/withdrawal_processed_mail';
import { LockerService } from '../../services/locker';
import { PushNotificationService } from '../../services/pushNotification/pushNotification.service';
import { MailerService } from '../../services/queue/processors/mailer/mailer.service';
import { UtilsService } from '../../utils/utils.service';
import { UserService } from '../auth/user/user.service';
import { UserProfileService } from '../auth/userProfile/userProfile.service';
import { FiatWalletService } from '../fiatWallet/fiatWallet.service';
import { FiatWalletEscrowService } from '../fiatWallet/fiatWalletEscrow.service';
import { FiatWalletTransactionService } from '../fiatWalletTransactions/fiatWalletTransactions.service';
import { IN_APP_NOTIFICATION_TYPE } from '../inAppNotification/inAppNotification.enum';
import { InAppNotificationService } from '../inAppNotification/inAppNotification.service';
import { CreateTransactionDto } from './dto/createTransaction.dto';
import { GetTransactionsDto } from './dto/getTransactions.dto';
import { GetTransactionsResponseDto, TransactionResponseDto } from './dto/transactionResponse.dto';
import { UpdateInReviewTransactionStatusDto } from './dto/updateInReviewTransactionStatus.dto';
import { ITransactionNotificationOptions } from './transaction.interface';
import { TransactionRepository } from './transaction.repository';

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  @Inject(TransactionRepository)
  private readonly transactionRepository: TransactionRepository;

  @Inject(LockerService)
  private readonly lockerService: LockerService;

  @Inject(InAppNotificationService)
  private readonly inAppNotificationService: InAppNotificationService;

  @Inject(MailerService)
  private readonly mailerService: MailerService;

  @Inject(UserService)
  private readonly userService: UserService;

  @Inject(PushNotificationService)
  private readonly pushNotificationService: PushNotificationService;

  @Inject(UserProfileService)
  private readonly userProfileService: UserProfileService;

  @Inject(forwardRef(() => FiatWalletService))
  private readonly fiatWalletService: FiatWalletService;

  @Inject(forwardRef(() => FiatWalletTransactionService))
  private readonly fiatWalletTransactionService: FiatWalletTransactionService;

  @Inject(forwardRef(() => FiatWalletEscrowService))
  private readonly fiatWalletEscrowService: FiatWalletEscrowService;

  async create(userId: string, data: CreateTransactionDto, trx?: Transaction): Promise<TransactionModel> {
    const transaction = await this.transactionRepository.create(
      {
        amount: data.amount,
        asset: data.asset,
        balance_before: data.balance_before,
        balance_after: data.balance_after,
        transaction_type: data.transaction_type,
        category: data.category,
        transaction_scope: data.transaction_scope,
        reference: data.reference,
        status: data.status || TransactionStatus.PENDING,
        processed_at: DateTime.now().toSQL(),
        metadata: data.metadata,
        user_id: userId,
        external_reference: data.external_reference,
        description: data.description,
        parent_transaction_id: data.parent_transaction_id,
      },
      trx,
    );

    return transaction;
  }

  async findAll(userId: string, filters: GetTransactionsDto = {}): Promise<GetTransactionsResponseDto> {
    const query: Record<string, any> = { user_id: userId };

    // Apply basic filters
    if (filters.asset) query.asset = filters.asset;

    // Build query with basic filters
    let queryBuilder = this.transactionRepository.query().where(query);

    // Handle array filters with IN clauses
    if (filters.transaction_type && filters.transaction_type.length > 0) {
      queryBuilder = queryBuilder.whereIn('transaction_type', filters.transaction_type);
    }
    if (filters.status && filters.status.length > 0) {
      queryBuilder = queryBuilder.whereIn('status', filters.status);
    }
    if (filters.category && filters.category.length > 0) {
      queryBuilder = queryBuilder.whereIn('category', filters.category);
    }
    if (filters.transaction_scope && filters.transaction_scope.length > 0) {
      queryBuilder = queryBuilder.whereIn('transaction_scope', filters.transaction_scope);
    }

    // Add date range filters if provided (using UTC timezone to match database)
    if (filters.start_date) {
      const startDateTime = DateTime.fromISO(filters.start_date, { zone: 'utc' }).startOf('day').toSQL();
      queryBuilder = queryBuilder.where('created_at', '>=', startDateTime);
    }

    if (filters.end_date) {
      const endDateTime = DateTime.fromISO(filters.end_date, { zone: 'utc' }).endOf('day').toSQL();
      queryBuilder = queryBuilder.where('created_at', '<=', endDateTime);
    }

    // Filter by fiat_wallet_id if provided
    if (filters.fiat_wallet_id) {
      queryBuilder = queryBuilder.whereExists(
        this.transactionRepository.model
          .relatedQuery('fiatWalletTransaction')
          .where('fiat_wallet_id', filters.fiat_wallet_id),
      );
    }

    // Filter for unique beneficiaries - returns only one transaction per unique beneficiary
    if (filters.unique_beneficiary) {
      const knex = this.transactionRepository.model.knex();
      const beneficiaryKey = knex.raw(`
        COALESCE(
          (metadata::jsonb)->>'recipient_user_id',
          CONCAT((metadata::jsonb)->>'destination_account_number', '_', (metadata::jsonb)->>'destination_bank_code'),
          (metadata::jsonb)->>'destination_account_number',
          id::text
        )
      `);

      queryBuilder = queryBuilder.whereIn('id', (subquery) => {
        subquery
          .select('id')
          .distinctOn(beneficiaryKey)
          .from('api_service.transactions')
          .where('user_id', query.user_id)
          .whereIn('transaction_type', [TransactionType.TRANSFER_OUT, TransactionType.WITHDRAWAL])
          .whereNotNull('metadata')
          .orderByRaw(
            `COALESCE(
              (metadata::jsonb)->>'recipient_user_id',
              CONCAT((metadata::jsonb)->>'destination_account_number', '_', (metadata::jsonb)->>'destination_bank_code'),
              (metadata::jsonb)->>'destination_account_number',
              id::text
            ), created_at DESC`,
          );
      });
    }

    // Apply search across multiple tables if search term is provided
    if (filters.search) {
      const searchTerm = `%${filters.search}%`;

      queryBuilder = queryBuilder.where((builder) => {
        builder
          // Search main transaction fields
          .where('reference', 'ilike', searchTerm)
          .orWhere('external_reference', 'ilike', searchTerm)
          .orWhere('asset', 'ilike', searchTerm)
          .orWhere('description', 'ilike', searchTerm)
          .orWhere('transaction_type', 'ilike', searchTerm)
          .orWhere('status', 'ilike', searchTerm)
          .orWhere('category', 'ilike', searchTerm)
          .orWhere('transaction_scope', 'ilike', searchTerm)
          .orWhere('failure_reason', 'ilike', searchTerm)
          // Search numeric fields as text
          .orWhereRaw('CAST(amount AS TEXT) ILIKE ?', [searchTerm])
          // Search related fiat wallet transactions
          .orWhereExists(
            this.transactionRepository.model.relatedQuery('fiatWalletTransaction').where((fwtBuilder) => {
              fwtBuilder
                .where('provider_reference', 'ilike', searchTerm)
                .orWhere('provider_quote_ref', 'ilike', searchTerm)
                .orWhere('provider_request_ref', 'ilike', searchTerm)
                .orWhere('currency', 'ilike', searchTerm)
                .orWhere('provider', 'ilike', searchTerm)
                .orWhere('source', 'ilike', searchTerm)
                .orWhere('destination', 'ilike', searchTerm)
                .orWhere('description', 'ilike', searchTerm)
                .orWhereRaw('CAST(amount AS TEXT) ILIKE ?', [searchTerm]);
            }),
          )
          // Search related blockchain transactions
          .orWhereExists(
            this.transactionRepository.model.relatedQuery('blockchainWalletTransaction').where((bwtBuilder) => {
              bwtBuilder
                .where('provider_reference', 'ilike', searchTerm)
                .orWhere('tx_hash', 'ilike', searchTerm)
                .orWhere('peer_wallet_address', 'ilike', searchTerm)
                .orWhere('description', 'ilike', searchTerm)
                .orWhere('type', 'ilike', searchTerm)
                .orWhereRaw('CAST(amount AS TEXT) ILIKE ?', [searchTerm]);
            }),
          )
          // Search related card transactions
          .orWhereExists(
            this.transactionRepository.model.relatedQuery('cardTransaction').where((ctBuilder) => {
              ctBuilder
                .where('provider_reference', 'ilike', searchTerm)
                .orWhere('merchant_name', 'ilike', searchTerm)
                .orWhere('merchant_id', 'ilike', searchTerm)
                .orWhere('merchant_city', 'ilike', searchTerm)
                .orWhere('merchant_country', 'ilike', searchTerm)
                .orWhere('merchant_category', 'ilike', searchTerm)
                .orWhere('description', 'ilike', searchTerm)
                .orWhere('transaction_type', 'ilike', searchTerm)
                .orWhereRaw('CAST(amount AS TEXT) ILIKE ?', [searchTerm]);
            }),
          );
      });
    }

    // Apply consistent ordering and include relationships
    queryBuilder = queryBuilder
      .orderBy('created_at', 'desc')
      .withGraphFetched(
        '[fiatWalletTransaction.[externalAccount, virtualAccount], blockchainWalletTransaction, cardTransaction.card]',
      );

    // Handle pagination
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const offset = (page - 1) * limit;

    // Apply limit and offset to ensure correct pagination with complex search queries
    queryBuilder = queryBuilder.limit(limit).offset(offset);

    // filter out these transactions:
    // 1. transactions with status reconcile
    queryBuilder = queryBuilder.whereNot('status', TransactionStatus.RECONCILE);

    const paginatedResult = await this.transactionRepository.paginateData(queryBuilder as any, limit, page);

    // Hardcoded fields to return in flattened format
    const selectedFields = [
      // Transaction fields
      'id',
      'user_id',
      'asset',
      'amount',
      'transaction_type',
      'status',
      'category',
      'transaction_scope',
      'description',
      'failure_reason',
      'created_at',
      'updated_at',
      'completed_at',
      'failed_at',
      'deleted_at',
      'processed_at',
      // Fiat wallet transaction fields (simplified names)
      'fiatWalletTransaction.provider_fee:provider_fee',
      'fiatWalletTransaction.source:source',
      'fiatWalletTransaction.destination:destination',
      'fiatWalletTransaction.settled_at:settled_at',
      // Unified account fields (populated from either external account or virtual account)
      'fiatWalletTransaction.externalAccount.bank_name:bank_name',
      'fiatWalletTransaction.externalAccount.account_number:account_number',
      'fiatWalletTransaction.externalAccount.account_name:account_name',
      'fiatWalletTransaction.externalAccount.routing_number:routing_number',
      'fiatWalletTransaction.externalAccount.bank_ref:bank_ref',
      'fiatWalletTransaction.externalAccount.account_type:account_type',
      'fiatWalletTransaction.externalAccount.nuban:nuban',
      'fiatWalletTransaction.externalAccount.swift_code:swift_code',
      'fiatWalletTransaction.externalAccount.expiration_date:expiration_date',
      // Virtual account fields (fallback for NG users when no external account)
      'fiatWalletTransaction.virtualAccount.bank_name:virtual_bank_name',
      'fiatWalletTransaction.virtualAccount.account_number:virtual_account_number',
      'fiatWalletTransaction.virtualAccount.account_name:virtual_account_name',
      'fiatWalletTransaction.virtualAccount.routing_number:virtual_routing_number',
      'fiatWalletTransaction.virtualAccount.bank_ref:virtual_bank_ref',
      'fiatWalletTransaction.virtualAccount.iban:virtual_iban',
      // Recipient information from metadata (for transfer transactions)
      'metadata.recipient_user_id:recipient_user_id',
      'metadata.recipient_username:recipient_username',
      // Destination details from metadata (for external transfers)
      'metadata.destination_bank:destination_bank',
      'metadata.destination_name:destination_name',
      'metadata.destination_account_number:destination_account_number',
      'metadata.destination_bank_code:destination_bank_code',
      'metadata.destination_bank_ref:destination_bank_ref',
      'metadata.recipient_first_name:recipient_first_name',
      'metadata.recipient_last_name:recipient_last_name',
      // Sender information from metadata (for transfer transactions)
      'metadata.sender_user_id:sender_user_id',
      'metadata.sender_username:sender_username',
      'metadata.sender_first_name:sender_first_name',
      'metadata.sender_last_name:sender_last_name',
      // Card transaction fields
      'cardTransaction.merchant_name:card_merchant_name',
      'cardTransaction.card.last_four_digits:card_last_four_digits',
    ];

    // Get the table name key from the paginated result
    const tableKey = Object.keys(paginatedResult).find((key) => key !== 'pagination');

    if (!tableKey) {
      return paginatedResult;
    }

    // Transform data to include only selected fields and flatten nested objects
    const transformedData: TransactionResponseDto[] = (paginatedResult as any)[tableKey].map((transaction: any) => {
      const result = this.selectAndFlattenFields(transaction, selectedFields);

      // Only include virtual account info for NGN deposits from external sources
      const shouldIncludeVirtualAccount =
        transaction.asset === 'NGN' &&
        transaction.transaction_type === 'deposit' &&
        transaction.transaction_scope === 'external';

      if (!shouldIncludeVirtualAccount) {
        // Remove virtual account fields if they shouldn't be included
        delete result.virtual_account_name;
        delete result.virtual_account_number;
        delete result.virtual_bank_name;
        delete result.virtual_bank_ref;
        delete result.virtual_routing_number;
        delete result.virtual_iban;
      }

      return result;
    });

    // Populate avatar URLs for recipient users in internal transfers
    await this.populateRecipientAvatarUrls(transformedData);

    return {
      transactions: transformedData,
      pagination: paginatedResult.pagination,
    };
  }

  /**
   * Populates avatar URLs for recipient users in internal transfer transactions
   */
  private async populateRecipientAvatarUrls(transactions: TransactionResponseDto[]): Promise<void> {
    // Collect unique recipient user IDs
    const recipientUserIds = [
      ...new Set(transactions.filter((tx) => tx.recipient_user_id).map((tx) => tx.recipient_user_id as string)),
    ];

    if (recipientUserIds.length === 0) {
      return;
    }

    // Fetch user profiles for all recipient users in a single query
    const userProfiles = await UserProfileModel.query().whereIn('user_id', recipientUserIds).whereNotNull('image_key');

    // Populate avatar URLs for profiles with image_key
    await Promise.all(userProfiles.map((profile) => this.userProfileService.populateAvatarUrl(profile)));

    // Create a map of user_id to avatar_url
    const avatarUrlMap = new Map<string, string | null>();
    userProfiles.forEach((profile) => {
      avatarUrlMap.set(profile.user_id, profile.avatar_url);
    });

    // Assign avatar URLs to transactions
    transactions.forEach((tx) => {
      if (tx.recipient_user_id) {
        tx.recipient_avatar_url = avatarUrlMap.get(tx.recipient_user_id as string) || null;
      }
    });
  }

  private selectAndFlattenFields(transaction: TransactionModel, selectedColumns: string[]): Record<string, any> {
    const result: Record<string, any> = {};

    selectedColumns.forEach((field) => {
      // Check if field has custom naming (field:customName)
      const [fieldPath, customName] = field.includes(':') ? field.split(':') : [field, null];

      if (fieldPath.includes('.')) {
        const fieldParts = fieldPath.split('.');
        let currentValue = transaction;
        let isValid = true;

        // Navigate through the nested structure
        for (const part of fieldParts) {
          if (currentValue && currentValue[part] !== undefined) {
            currentValue = currentValue[part];

            // Special handling for metadata field - parse JSON if it's a string
            if (part === 'metadata' && typeof currentValue === 'string') {
              try {
                currentValue = JSON.parse(currentValue);
              } catch {
                isValid = false;
                break;
              }
            }
          } else {
            isValid = false;
            break;
          }
        }

        if (isValid && currentValue !== undefined) {
          // Use custom name if provided, otherwise use underscore notation
          const flattenedKey = customName || fieldParts.join('_');
          result[flattenedKey] = currentValue;
        }
      } else if (transaction[fieldPath] !== undefined) {
        // Handle direct fields
        const key = customName || fieldPath;
        result[key] = transaction[fieldPath];
      }
    });

    return result;
  }

  async findById(id: string): Promise<TransactionModel> {
    const transaction = await this.transactionRepository.findById(id);

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    return transaction as TransactionModel;
  }

  async findOne(filters: Partial<TransactionModel>): Promise<TransactionModel> {
    const transaction = await this.transactionRepository.findOne(filters, undefined, {
      graphFetch: '[fiatWalletTransaction, blockchainWalletTransaction]',
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction with specified filters not found`);
    }

    return transaction;
  }
  async updateStatus(
    id: string,
    status: TransactionStatus,
    metadata?: ITransactionUpdateMetadata,
    trx?: Transaction,
    notificationOptions?: ITransactionNotificationOptions,
  ): Promise<TransactionModel> {
    this.logger.debug(
      `Updating transaction ${id} status to ${status} with metadata ${JSON.stringify(metadata)} and notification options ${JSON.stringify(notificationOptions)}`,
    );

    // Use the locker service to ensure only one process can update this transaction at a time
    const lockKey = `transaction:${id}:update-status`;

    // Lock will automatically be released when the callback completes or throws an error
    return this.lockerService.withLock(lockKey, async () => {
      // Verify transaction exists and get latest state
      const existingTransaction = await this.transactionRepository.findById(id, '[user]', trx);

      if (!existingTransaction) {
        throw new NotFoundException(`Transaction with id ${id} not found`);
      }

      const currentStatus = existingTransaction.status;

      // Terminal states that cannot be transitioned from (except to same status)
      const terminalStates = [TransactionStatus.COMPLETED, TransactionStatus.FAILED, TransactionStatus.CANCELLED];
      const isCurrentStatusTerminal = terminalStates.includes(currentStatus);

      // Prevent status transitions from terminal states to other states
      if (isCurrentStatusTerminal && currentStatus !== status) {
        this.logger.warn(
          `Ignoring status transition from terminal state ${currentStatus} to ${status} for transaction ${id}`,
        );
        return existingTransaction as TransactionModel;
      }

      // Check if status is already the target status to prevent duplicate notifications
      const isStatusChanged = currentStatus !== status;

      const updateData: Partial<TransactionModel> = { status };

      if (status === TransactionStatus.PROCESSING) {
        updateData.processed_at = DateTime.now().toSQL();
      } else if (status === TransactionStatus.COMPLETED) {
        updateData.completed_at = DateTime.now().toSQL();
      } else if (status === TransactionStatus.FAILED) {
        updateData.failed_at = DateTime.now().toSQL();
        if (metadata?.failure_reason) {
          updateData.failure_reason = metadata.failure_reason;
        }
      } else if (status === TransactionStatus.REVIEW) {
        if (metadata?.failure_reason) {
          updateData.failure_reason = metadata.failure_reason;
        }
      }

      if (metadata?.provider_reference) {
        updateData.external_reference = metadata.provider_reference;
      }

      if (metadata?.provider_metadata) {
        const existingMetadata = existingTransaction.metadata || {};
        updateData.metadata = {
          ...existingMetadata,
          ...metadata.provider_metadata,
        };
      }

      if (!metadata) {
        metadata = {
          ...existingTransaction.metadata,
        };
      }

      if (metadata?.balance_after !== undefined) {
        updateData.balance_after = metadata.balance_after;
      }

      const updatedTransaction = (await this.transactionRepository.update(id, updateData, {
        trx,
      })) as unknown as TransactionModel;

      // If notification options are not provided, use default options
      notificationOptions = notificationOptions || {
        shouldSendInAppNotification: true,
        shouldSendEmail: true,
        shouldSendPushNotification: true,
      };

      // Send transaction status notifications only if status has changed
      if (isStatusChanged) {
        const mainAmount = CurrencyUtility.formatCurrencyAmountToMainUnit(
          updatedTransaction.amount,
          updatedTransaction.asset,
        );
        const formattedAmount =
          mainAmount !== null
            ? Math.abs(mainAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : `${Math.abs(Number(updatedTransaction.amount))}`;

        if (status === TransactionStatus.COMPLETED) {
          // Send in-app notification
          let notificationConfig: {
            type: IN_APP_NOTIFICATION_TYPE;
            title: string;
            message: string;
          };
          let recipientName = metadata?.recipient;

          // For exchange transactions, use source transaction currency/amount for both in-app and push notifications
          let notificationAsset = updatedTransaction.asset;
          let notificationAmount = formattedAmount;

          if (updatedTransaction.transaction_type?.toLowerCase() === TransactionType.EXCHANGE.toLowerCase()) {
            // we will get the parent transaction
            const parentTransaction = await this.getParentTransaction(updatedTransaction);
            const formattedParentAmount = CurrencyUtility.formatCurrencyAmountToMainUnit(
              parentTransaction.amount,
              parentTransaction.asset,
            );

            notificationAsset = parentTransaction.asset;
            notificationAmount = formattedParentAmount.toString();

            notificationConfig = this.inAppNotificationService.getTransactionNotificationConfig(
              TransactionType.EXCHANGE,
              notificationAmount,
              notificationAsset,
              metadata?.recipient,
              metadata?.sender_name,
              metadata?.bank_name,
              metadata?.account_number,
            );
          } else {
            // For card funding transactions, use destination_name from metadata if available
            let transactionMetadata: Record<string, any> | undefined;

            // Parse metadata if it's a string
            if (updatedTransaction.metadata) {
              if (typeof updatedTransaction.metadata === 'string') {
                try {
                  transactionMetadata = JSON.parse(updatedTransaction.metadata);
                } catch {
                  transactionMetadata = undefined;
                }
              } else {
                transactionMetadata = updatedTransaction.metadata;
              }
            }

            if (
              updatedTransaction.transaction_type === TransactionType.TRANSFER_OUT &&
              transactionMetadata?.destination_name &&
              typeof transactionMetadata.destination_name === 'string' &&
              transactionMetadata.destination_name.startsWith('Card ****')
            ) {
              recipientName = transactionMetadata.destination_name;
            }

            notificationConfig = this.inAppNotificationService.getTransactionNotificationConfig(
              updatedTransaction.transaction_type,
              notificationAmount,
              notificationAsset,
              recipientName,
              metadata?.sender_name,
              metadata?.bank_name,
              metadata?.account_number,
            );
          }

          // Send in-app notification
          if (notificationOptions.shouldSendInAppNotification) {
            await this.inAppNotificationService.createNotification({
              user_id: updatedTransaction.user_id,
              type: notificationConfig.type,
              title: notificationConfig.title,
              message: notificationConfig.message,
              metadata: {
                transactionId: updatedTransaction.id,
                amount: updatedTransaction.amount,
                asset: updatedTransaction.asset,
                transactionType: updatedTransaction.transaction_type,
              },
            });
          }
          // Send push notification
          if (notificationOptions.shouldSendPushNotification) {
            const pushConfig = this.pushNotificationService.getTransactionPushNotificationConfig(
              updatedTransaction.transaction_type,
              notificationAmount,
              notificationAsset,
              recipientName,
              metadata?.sender_name,
            );

            await this.sendTransactionPushNotification(updatedTransaction.user_id, pushConfig.title, pushConfig.body);
          }

          // Send email notifications for USD transactions only
          if (notificationOptions.shouldSendEmail) {
            await this.sendTransactionEmailNotification(updatedTransaction, metadata);
          }
        } else if (status === TransactionStatus.FAILED) {
          const failedTitle = 'Transaction Failed';
          const failedMessage = `Your ${formattedAmount} ${updatedTransaction.asset} transaction has failed.`;

          await this.inAppNotificationService.createNotification({
            user_id: updatedTransaction.user_id,
            type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_FAILED,
            title: failedTitle,
            message: failedMessage,
            metadata: {
              transactionId: updatedTransaction.id,
              amount: updatedTransaction.amount,
              asset: updatedTransaction.asset,
              transactionType: updatedTransaction.transaction_type,
              failureReason: metadata?.failure_reason,
            },
          });

          // Send push notification
          await this.sendTransactionPushNotification(updatedTransaction.user_id, failedTitle, failedMessage);
        }
      }

      return updatedTransaction;
    });
  }

  private async getParentTransaction(transaction: TransactionModel): Promise<TransactionModel> {
    if (!transaction.parent_transaction_id) {
      return transaction;
    }

    const parentTransaction = await this.transactionRepository.findOne({
      id: transaction.parent_transaction_id,
    });

    return parentTransaction;
  }

  private async sendTransactionEmailNotification(
    transaction: TransactionModel,
    metadata?: {
      description?: string;
      source?: string;
      destination?: string;
      recipient?: string;
      provider_fee?: number;
      participant_code?: string;
      sender_name?: string;
      recipient_name?: string;
      recipient_location?: string;
    },
  ): Promise<void> {
    // Only send email notifications for USD transactions
    if (transaction.asset !== 'USD') {
      return;
    }

    const emailTypes = ['deposit', 'withdrawal', 'transfer_in', 'transfer_out', 'reward'];
    if (!emailTypes.includes(transaction.transaction_type)) {
      return;
    }

    try {
      // Get user details for email notification
      const user = await this.userService.findByUserId(transaction.user_id);

      // Convert amounts from smallest unit to main unit for display
      const displayAmount = CurrencyUtility.formatCurrencyAmountToMainUnit(transaction.amount, transaction.asset);

      switch (transaction.transaction_type) {
        case 'deposit': {
          const newBalanceInMainUnit = CurrencyUtility.formatCurrencyAmountToMainUnit(
            transaction.balance_after,
            transaction.asset,
          );
          const depositEmail = new DepositProcessedMail(
            user,
            displayAmount,
            transaction.asset,
            transaction.id,
            newBalanceInMainUnit,
            metadata?.description,
            metadata?.source,
            metadata?.participant_code,
            transaction.external_reference,
            metadata?.provider_fee,
          );

          this.logger.log(`Attempting to send deposit email to ${user.email} for amount ${displayAmount}`);
          await this.mailerService.send(depositEmail);
          this.logger.log(`Deposit processed email sent to ${user.email}`);
          break;
        }

        case 'withdrawal': {
          const withdrawalEmail = new WithdrawalProcessedMail(
            user,
            displayAmount,
            transaction.asset,
            transaction.id,
            metadata?.description,
            metadata?.destination,
            metadata?.participant_code,
            transaction.external_reference,
            metadata?.provider_fee,
          );

          this.logger.log(`Attempting to send withdrawal email to ${user.email} for amount ${displayAmount}`);
          await this.mailerService.send(withdrawalEmail);
          this.logger.log(`Withdrawal processed email sent to ${user.email}`);
          break;
        }

        case 'transfer_out': {
          // Sender gets transfer successful email
          await this.sendTransferEmail(user, displayAmount, transaction, metadata);
          break;
        }

        case 'transfer_in': {
          // Receiver gets funds received email
          await this.sendFundsReceivedEmail(user, displayAmount, transaction, metadata);
          break;
        }

        case 'reward': {
          const newBalanceInMainUnit = CurrencyUtility.formatCurrencyAmountToMainUnit(
            transaction.balance_after,
            transaction.asset,
          );
          const rewardEmail = new RewardProcessedMail(
            user,
            displayAmount,
            transaction.asset,
            transaction.id,
            newBalanceInMainUnit,
            metadata?.description,
            metadata?.participant_code,
            transaction.external_reference,
          );

          this.logger.log(`Attempting to send reward email to ${user.email} for amount ${displayAmount}`);
          await this.mailerService.send(rewardEmail);
          this.logger.log(`Reward processed email sent to ${user.email}`);
          break;
        }
      }
    } catch (emailError) {
      this.logger.error(
        `Failed to send email notification for ${transaction.transaction_type} ${transaction.id}:`,
        emailError,
      );
      // Don't throw error - email failure shouldn't fail the transaction processing
    }
  }

  private async sendTransferEmail(
    user: any,
    displayAmount: number,
    transaction: TransactionModel,
    metadata?: {
      description?: string;
      recipient?: string;
      provider_fee?: number;
      participant_code?: string;
      sender_name?: string;
      recipient_name?: string;
      recipient_location?: string;
    },
  ): Promise<void> {
    // Normalize USDC to USD for currency formatting (USDC uses same decimal places as USD)
    const normalizedCurrency = transaction.asset.toUpperCase() === 'USDC' ? 'USD' : transaction.asset.toUpperCase();

    const transferFee = metadata?.provider_fee
      ? `$${CurrencyUtility.formatCurrencyAmountToMainUnit(metadata.provider_fee, normalizedCurrency)?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`
      : '$0.00';

    // Use participant_code from metadata if available
    const accountId = metadata?.participant_code;

    const transferEmail = new TransferSuccessfulMail(
      user,
      displayAmount,
      transaction.asset,
      transaction.id,
      metadata?.description,
      metadata?.recipient || 'N/A',
      transferFee,
      transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1),
      accountId,
      metadata?.sender_name,
      metadata?.recipient_name,
      metadata?.recipient_location,
      metadata?.provider_fee, // Pass raw provider_fee for calculation
      transaction.external_reference,
    );

    this.logger.log(`Attempting to send transfer email to ${user.email} for amount ${displayAmount}`);
    await this.mailerService.send(transferEmail);
    this.logger.log(`Transfer successful email sent to ${user.email}`);
  }

  private async sendFundsReceivedEmail(
    user: any,
    displayAmount: number,
    transaction: TransactionModel,
    metadata?: {
      description?: string;
      provider_fee?: number;
      participant_code?: string;
      sender_name?: string;
      recipient_name?: string;
      recipient_location?: string;
    },
  ): Promise<void> {
    const fundsReceivedEmail = new UsdFundsReceivedMail(
      user,
      displayAmount,
      transaction.asset,
      transaction.id,
      metadata?.description,
      metadata?.sender_name,
      metadata?.participant_code,
      metadata?.recipient_name,
      metadata?.recipient_location,
      metadata?.provider_fee, // Pass raw provider_fee for calculation
      transaction.external_reference,
    );

    this.logger.log(`Attempting to send funds received email to ${user.email} for amount ${displayAmount}`);
    await this.mailerService.send(fundsReceivedEmail);
    this.logger.log(`Funds received email sent to ${user.email}`);
  }

  private async sendTransactionPushNotification(userId: string, title: string, message: string): Promise<void> {
    try {
      const userProfile = await this.userProfileService.findByUserId(userId);

      if (userProfile?.notification_token) {
        this.logger.log(`Sending push notification to user ${userId}`);
        await this.pushNotificationService.sendPushNotification([userProfile.notification_token], {
          title,
          body: message,
        });
        this.logger.log(`Push notification sent to user ${userId}`);
      } else {
        this.logger.log(`No notification token found for user ${userId}, skipping push notification`);
      }
    } catch (error) {
      this.logger.error(`Failed to send push notification to user ${userId}: ${error.message}`, error.stack);
      // Don't throw error - push notification failure shouldn't fail the transaction processing
    }
  }

  /**
   * Completes an exchange transaction by updating balances and sending success email
   * Used by webhook handlers when exchange is finalized
   */
  async completeExchangeTransaction(
    transaction: TransactionModel,
    amountInSmallestUnit: number,
    trx?: Transaction,
  ): Promise<void> {
    this.logger.log(`Completing exchange transaction ${transaction.id} with amount ${amountInSmallestUnit}`);

    // Fetch related records
    const fiatWalletTransaction = await this.fiatWalletTransactionService.findOne({ transaction_id: transaction.id });
    if (!fiatWalletTransaction) {
      this.logger.warn(`No fiat wallet transaction found for transaction: ${transaction.id}`);
      return;
    }

    const parentTransaction = await this.transactionRepository.findOne({ id: transaction.parent_transaction_id });
    if (!parentTransaction) {
      this.logger.warn(`No parent transaction found for transaction: ${transaction.id}`);
    }

    const user = await this.userService.findByUserId(transaction.user_id);

    await this.transactionRepository.transaction(async (innerTrx) => {
      const txn = trx || innerTrx;

      // Update wallet balance
      await this.fiatWalletService.updateBalance(
        fiatWalletTransaction.fiat_wallet_id,
        amountInSmallestUnit,
        transaction.id,
        FiatWalletTransactionType.EXCHANGE,
        TransactionStatus.COMPLETED,
        {
          fiat_wallet_transaction_id: fiatWalletTransaction.id,
        },
        txn,
      );

      // Update transaction status to completed
      await this.updateStatus(transaction.id, TransactionStatus.COMPLETED, {}, txn, {
        shouldSendPushNotification: true,
        shouldSendInAppNotification: true,
        shouldSendEmail: false,
      });

      const toCurrency = parentTransaction?.metadata?.to;
      const fromCurrency = parentTransaction?.metadata?.from;
      const amountInMainUnit = CurrencyUtility.formatCurrencyAmountToMainUnit(amountInSmallestUnit, toCurrency);
      const feeInMainUnit = CurrencyUtility.formatCurrencyAmountToMainUnit(
        parentTransaction?.metadata?.usd_fee,
        toCurrency,
      );
      const rateInMainUnit = CurrencyUtility.formatCurrencyAmountToMainUnit(
        parentTransaction?.metadata?.rate,
        toCurrency,
      );
      const localAmountInMainUnit = CurrencyUtility.formatCurrencyAmountToMainUnit(
        parentTransaction?.amount,
        parentTransaction?.asset,
      );
      const walletAddress = parentTransaction?.metadata?.destination_wallet_address;

      // Send success email
      await this.mailerService.send(
        new WalletExchangeSuccessMail(user, {
          fromCurrency: fromCurrency,
          toCurrency: toCurrency,
          toCountry: 'US',
          accountId: fiatWalletTransaction.fiat_wallet_id,
          availableDate: DateTime.fromJSDate(new Date(transaction.created_at)).toLocaleString(DATE_TIME_FORMAT),
          description: transaction.description,
          orderNumber: transaction.reference,
          senderName: user.first_name + ' ' + user.last_name,
          recipientName: user.first_name + ' ' + user.last_name,
          recipientLocation: user?.country?.name,
          exchangeRate: CurrencyUtility.formatCurrencyAmountToLocaleString(rateInMainUnit, fromCurrency),
          formattedFee: CurrencyUtility.formatCurrencyAmountToLocaleString(feeInMainUnit, toCurrency),
          transactionId: transaction.id,
          transactionDate: DateTime.fromJSDate(new Date(transaction.created_at)).toLocaleString(DATE_TIME_FORMAT),
          formattedAmount: CurrencyUtility.formatCurrencyAmountToLocaleString(
            localAmountInMainUnit,
            parentTransaction?.asset,
          ),
          formattedLocalAmount: CurrencyUtility.formatCurrencyAmountToLocaleString(amountInMainUnit, toCurrency),
          formattedTotal: CurrencyUtility.formatCurrencyAmountToLocaleString(
            Number(amountInMainUnit) + Number(feeInMainUnit),
            toCurrency,
          ),
          walletAddress: walletAddress,
        }),
      );
    });

    this.logger.log(`Successfully completed exchange transaction ${transaction.id}`);
  }

  // update transaction status
  public async updateInReviewTransactionStatus(
    transactionId: string,
    data: UpdateInReviewTransactionStatusDto,
  ): Promise<TransactionModel> {
    this.logger.log(`Updating status for transaction ID: ${transactionId}, new status: ${data.status}`);

    try {
      this.logger.log(`Fetching transaction by ID: ${transactionId}`);
      const transaction = await this.transactionRepository.findById(transactionId);

      if (!transaction) {
        this.logger.warn(`Transaction with ID ${transactionId} not found`);
        throw new NotFoundException(`Transaction with ID ${transactionId} not found`);
      }

      this.logger.log(`Checking if transaction is an NGN transaction`);
      if (transaction.asset !== SUPPORTED_CURRENCIES.NGN.code) {
        this.logger.warn('Transaction is not an ng transaction');
        throw new BadRequestException('Transaction is not an ng transaction');
      }

      this.logger.log(`Checking if transaction is already completed`);
      if (transaction.status === TransactionStatus.COMPLETED) {
        this.logger.warn('Transaction is already completed');
        throw new BadRequestException('Transaction is already completed');
      }

      this.logger.log(`Checking if status is set to review`);
      if (transaction.status !== TransactionStatus.REVIEW) {
        this.logger.warn('Transaction must be in review status');
        throw new BadRequestException('Transaction must be in review status');
      }

      // for now, we can only update the status to failed.
      if (data.status !== TransactionStatus.FAILED) {
        this.logger.warn('Transaction can only be updated to failed status');
        throw new BadRequestException('Transaction can only be updated to failed status');
      }

      let updatedTransaction: TransactionModel;
      if (data.status?.toLowerCase() === TransactionStatus.FAILED.toLowerCase()) {
        this.logger.log(`Updating transaction status for transaction ID ${transactionId} to status: ${data.status}`);

        // get the money from the escrow
        const escrowAmount = await this.fiatWalletEscrowService.getEscrowAmount(transactionId);

        updatedTransaction = await this.transactionRepository.transaction(async (trx) => {
          const updatedTransaction = await this.transactionRepository.update(
            transactionId,
            {
              status: TransactionStatus.FAILED,
              failure_reason: data.failure_reason || transaction.failure_reason,
              failed_at: DateTime.now().toSQL(),
            },
            { trx },
          );

          if (escrowAmount > 0) {
            const refundTransaction = await this.createRefundTransaction(transactionId, trx);

            if (!refundTransaction) {
              this.logger.warn(`Failed to create refund transaction for transaction ID: ${transactionId}`);
              throw new InternalServerErrorException('Failed to create refund transaction');
            }
          }

          return updatedTransaction;
        });

        // release the money from the escrow
        await this.fiatWalletEscrowService.releaseMoneyFromEscrow(transactionId);
      }

      this.logger.log(`Successfully updated transaction status for ID: ${transactionId}`);
      return updatedTransaction;
    } catch (error) {
      this.logger.error(`Failed to update transaction status ${transactionId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to update transaction status');
    }
  }

  private async createRefundTransaction(transactionId: string, trx: Transaction): Promise<TransactionModel> {
    this.logger.log(`Starting refund transaction creation for transaction ID: ${transactionId}`);

    // we need to find the transaction and the fiat wallet transaction in the same transaction.
    const transaction = await this.transactionRepository.findById(transactionId);
    if (!transaction) {
      this.logger.warn(`Transaction with ID ${transactionId} not found`);
      throw new NotFoundException(`Transaction with ID ${transactionId} not found`);
    }

    // we need to find the fiat wallet transaction in the same transaction.
    this.logger.log(
      `Fetched transaction. Now fetching related fiat wallet transaction for transaction ID: ${transactionId}`,
    );
    const fiatWalletTransaction = await this.fiatWalletTransactionService.findOne({ transaction_id: transactionId });
    if (!fiatWalletTransaction) {
      this.logger.warn(`Fiat wallet transaction with ID ${transactionId} not found`);
      throw new NotFoundException(`Fiat wallet transaction with ID ${transactionId} not found`);
    }

    // we need to find the fiat wallet in the same transaction.
    this.logger.log(
      `Fetched fiat wallet transaction. Fetching fiat wallet for user_id: ${transaction.user_id}, asset: ${transaction.asset}`,
    );
    const fiatWallet = await this.fiatWalletService.getUserWallet(transaction.user_id, transaction.asset);

    // we need to calculate the balance before and after the refund.
    const balanceBefore = Number(fiatWallet.balance);
    const balanceAfter = add(balanceBefore, Number(transaction.amount));

    this.logger.log(`Balances calculated. balance_before: ${balanceBefore}, balance_after: ${balanceAfter}`);

    // we need to generate a reference for the refund transaction.
    const reference = UtilsService.generateTransactionReference();
    this.logger.log(`Generated reference: ${reference}`);

    this.logger.log(`Creating refund transaction record inside transaction`);
    // we need to create the refund transaction in the same transaction.
    const refundTransaction = await this.transactionRepository.create(
      {
        user_id: transaction.user_id,
        parent_transaction_id: transaction.id,
        asset: transaction.asset,
        amount: Number(transaction.amount),
        status: TransactionStatus.PENDING,
        transaction_type: TransactionType.REFUND,
        category: TransactionCategory.FIAT,
        transaction_scope: TransactionScope.INTERNAL,
        reference: reference,
        description: `Refund of ${transaction.amount} to your ${transaction.asset} wallet`,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        metadata: transaction.metadata,
        external_reference: transaction.external_reference,
      },
      trx,
    );
    this.logger.log(`Created refund transaction with ID: ${refundTransaction.id}`);

    // we need to create the fiat wallet transaction in the same transaction.
    this.logger.log(`Creating fiat wallet transaction for refund`);
    const refundFiatTransaction = await this.fiatWalletTransactionService.create(
      transaction.user_id,
      {
        transaction_id: refundTransaction.id,
        amount: Number(transaction.amount),
        currency: transaction.asset,
        status: TransactionStatus.COMPLETED,
        fiat_wallet_id: fiatWalletTransaction.fiat_wallet_id,
        transaction_type: FiatWalletTransactionType.REFUND,
        provider_reference: reference,
        description: `Refund of ${transaction.amount} to your ${transaction.asset} wallet`,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        provider_metadata: {
          source_user_id: transaction.user_id,
          source_currency: transaction.asset,
          destination_user_id: transaction.user_id,
          destination_currency: transaction.asset,
        },
      },
      trx,
    );
    this.logger.log(`Created fiat wallet refund transaction with ID: ${refundFiatTransaction.id}`);

    // we need to update the fiat wallet balance in the same transaction.
    this.logger.log(`Updating fiat wallet balance for wallet ID: ${fiatWallet.id}`);
    await this.fiatWalletService.updateBalance(
      fiatWallet.id,
      Number(transaction.amount),
      refundTransaction.id,
      FiatWalletTransactionType.REFUND,
      TransactionStatus.COMPLETED,
      {
        fiat_wallet_transaction_id: refundFiatTransaction.id,
      },
      trx,
    );
    this.logger.log(`Fiat wallet balance updated for wallet ID: ${fiatWallet.id}`);

    // we need to update the refund transaction status to completed in the same transaction.
    this.logger.log(
      `Updating refund transaction status to COMPLETED for refund transaction ID: ${refundTransaction.id}`,
    );
    await this.updateStatus(refundTransaction.id, TransactionStatus.COMPLETED, {}, trx, {
      shouldSendEmail: false,
      shouldSendPushNotification: true,
      shouldSendInAppNotification: true,
    });
    this.logger.log(
      `Refund transaction status updated to COMPLETED for refund transaction ID: ${refundTransaction.id}`,
    );

    this.logger.log(
      `Refund transaction successfully created for transaction ID: ${transactionId} with refund transaction ID: ${refundTransaction.id}`,
    );
    return refundTransaction;
  }
}
