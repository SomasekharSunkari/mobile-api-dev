import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { ExternalAccountAdapter, RiskSignalResponse } from '../../adapters/external-account';
import { LinkBankAccountAdapter } from '../../adapters/link-bank-account/link-bank-account.adapter';
import {
  CreateTokenRequest,
  CreateTokenResponse,
} from '../../adapters/link-bank-account/link-bank-account.adapter.interface';
import { EnvironmentService } from '../../config';
import { CurrencyUtility } from '../../currencies/currencies';
import { ExternalAccountStatus } from '../../database/models/externalAccount/externalAccount.interface';
import { ExternalAccountModel } from '../../database/models/externalAccount/externalAccount.model';
import { FiatWalletTransactionType } from '../../database/models/fiatWalletTransaction/fiatWalletTransaction.interface';
import {
  TransactionCategory,
  TransactionScope,
  TransactionStatus,
  TransactionType,
} from '../../database/models/transaction';
import { UserModel } from '../../database/models/user/user.model';
import { ExternalAccountKycException } from '../../exceptions/external_account_kyc_exception';
import { ServiceUnavailableException } from '../../exceptions/service_unavailable_exception';
import { LockerService } from '../../services/locker/locker.service';
import { RedisCacheService } from '../../services/redis/redis-cache.service';
import { AccessTokenService } from '../auth/accessToken';
import { UserService } from '../auth/user/user.service';

import { PROVIDERS } from '../../constants/constants';
import { UtilsService } from '../../utils/utils.service';
import { CountryRepository } from '../country/country.repository';
import { FiatWalletService } from '../fiatWallet/fiatWallet.service';
import { FiatWalletTransactionRepository } from '../fiatWalletTransactions/fiatWalletTransactions.repository';
import { FiatWalletTransactionService } from '../fiatWalletTransactions/fiatWalletTransactions.service';
import { TierConfigService } from '../tierConfig/tierConfig.service';
import { TransactionSumService } from '../transaction-sum/transaction-sum.service';
import { TransactionService } from '../transaction/transaction.service';

import { BankAccountUnlinkedMail } from '../../notifications/mails/bank_account_unlinked_mail';
import {
  ExecuteWalletJobData,
  ExecuteWalletProcessor,
} from '../../services/queue/processors/execute-wallet/execute-wallet.processor';
import { MailerService } from '../../services/queue/processors/mailer/mailer.service';
import { KycVerificationService } from '../auth/kycVerification/kycVerification.service';
import { IN_APP_NOTIFICATION_TYPE } from '../inAppNotification/inAppNotification.enum';
import { InAppNotificationService } from '../inAppNotification/inAppNotification.service';
import { TransactionMonitoringService } from '../transaction-monitoring/transaction-monitoring.service';
import { UserTierService } from '../userTier';
import { TransferDto } from './dto/transfer.dto';
import { ExternalAccountFilterInterface, SignalEvaluationResponse } from './external-account.interface';
import { ExternalAccountRepository } from './external-account.repository';

@Injectable()
export class ExternalAccountService {
  private readonly logger = new Logger(ExternalAccountService.name);

  @Inject(LinkBankAccountAdapter)
  private readonly linkBankAccountAdapter: LinkBankAccountAdapter;
  @Inject(RedisCacheService)
  private readonly redisCacheService: RedisCacheService;
  @Inject(ExternalAccountRepository)
  private readonly externalAccountRepository: ExternalAccountRepository;
  @Inject(ExternalAccountAdapter)
  private readonly externalAccountAdapter: ExternalAccountAdapter;
  @Inject(TransactionService)
  private readonly transactionService: TransactionService;
  @Inject(FiatWalletService)
  private readonly fiatWalletService: FiatWalletService;
  @Inject(FiatWalletTransactionService)
  private readonly fiatWalletTransactionService: FiatWalletTransactionService;
  @Inject(FiatWalletTransactionRepository)
  private readonly fiatWalletTransactionRepository: FiatWalletTransactionRepository;
  @Inject(LockerService)
  private readonly lockerService: LockerService;
  @Inject(ExecuteWalletProcessor)
  private readonly executeWalletProcessor: ExecuteWalletProcessor;
  @Inject(AccessTokenService)
  private readonly accessTokenService: AccessTokenService;

  @Inject(TierConfigService)
  private readonly tierConfigService: TierConfigService;

  @Inject(TransactionSumService)
  private readonly transactionSumService: TransactionSumService;

  @Inject(UserService)
  private readonly userService: UserService;

  @Inject(CountryRepository)
  private readonly countryRepository: CountryRepository;

  @Inject(MailerService)
  private readonly mailerService: MailerService;

  @Inject(InAppNotificationService)
  private readonly inAppNotificationService: InAppNotificationService;

  @Inject(TransactionMonitoringService)
  private readonly transactionMonitoringService: TransactionMonitoringService;

  @Inject(KycVerificationService)
  private readonly kycVerificationService: KycVerificationService;
  @Inject(UserTierService)
  private readonly userTierService: UserTierService;

  async createLinkToken(user: UserModel, androidPackageName?: string): Promise<CreateTokenResponse> {
    // SECURITY CHECK: Validate user tier level before creating link token
    const currentTier = await this.userTierService.getUserCurrentTier(user.id);

    if (!currentTier || currentTier.level < 1) {
      throw new BadRequestException('Please complete your KYC verification to link your bank account.');
    }

    // Also check Zerohash participant status
    const existingExternalAccount = (await this.externalAccountRepository.query().findOne({
      user_id: user.id,
      provider: PROVIDERS.ZEROHASH,
    })) as ExternalAccountModel;

    if (!existingExternalAccount) {
      throw new BadRequestException('No link account found');
    }

    if (!existingExternalAccount?.participant_code) {
      throw new BadRequestException(
        'Zerohash ExternalAccount must exist with participant_code before creating a bank account link token',
      );
    }

    if (existingExternalAccount.provider_kyc_status !== 'approved') {
      throw new BadRequestException(
        'User must have Zerohash participant APPROVED before creating a bank account link token',
      );
    }

    // Check if the existing external account already has an approved linked bank account
    if (
      existingExternalAccount.linked_provider === PROVIDERS.PLAID &&
      existingExternalAccount.status === ExternalAccountStatus.APPROVED
    ) {
      throw new BadRequestException(
        'You already have a linked account. Unlink it first to add a new one — only one account can be linked at a time.',
      );
    }

    // Check if the existing external account has a pending disconnect status
    if (
      existingExternalAccount.linked_provider === PROVIDERS.PLAID &&
      existingExternalAccount.status === ExternalAccountStatus.PENDING_DISCONNECT
    ) {
      throw new BadRequestException(
        'Your bank account connection needs to be updated and will expire soon. Please update your account authorization to continue using your linked bank account.',
      );
    }

    // Check if the existing external account requires login (credentials expired/invalid)
    if (
      existingExternalAccount.linked_provider === PROVIDERS.PLAID &&
      existingExternalAccount.status === ExternalAccountStatus.ITEM_LOGIN_REQUIRED
    ) {
      throw new BadRequestException(
        'Your bank account credentials have expired. Please update your account authorization or unlink your current account to add a new one.',
      );
    }

    await user.$fetchGraph('[userProfile]');
    await user.$fetchGraph('[country]');

    const profile = user.userProfile;

    // Validate required user data for Plaid link token creation
    if (!profile) {
      throw new BadRequestException(
        'User profile is required to create a link token. Please complete your profile first.',
      );
    }

    if (!user.country) {
      throw new BadRequestException('User country information is required to create a link token.');
    }

    if (!profile.dob || !profile.address_line1 || !profile.city || !profile.state_or_province || !profile.postal_code) {
      throw new BadRequestException(
        'Complete profile information is required (date of birth, address, city, state, postal code) to create a link token.',
      );
    }

    try {
      const request: CreateTokenRequest = {
        clientName: 'OneDosh',
        language: 'en',
        user: {
          userRef: user.id,
          fullName: `${user.first_name} ${user.last_name}`,
          email: user.email,
          phone: user.phone_number,
          dob: DateTime.fromJSDate(new Date(profile.dob)).toISODate(),
          address: {
            street: profile.address_line2 ? `${profile.address_line1} ${profile.address_line2}` : profile.address_line1,
            city: profile.city,
            region: profile.state_or_province,
            postalCode: profile.postal_code,
            country: user.country.code.toUpperCase(),
          },
        },
      };
      if (androidPackageName) {
        request.androidPackageName = androidPackageName;
      }

      this.logger.debug(`Creating link token for user ${user.id} in country ${user.country.code}`);
      const linkToken = await this.linkBankAccountAdapter.createLinkToken(request, user.country.code);

      let linkAccessUrl: string;

      if (EnvironmentService.isDevelopment()) {
        linkAccessUrl = await this.getLinkAccessUrl(user, linkToken.token);
      }

      return {
        ...linkToken,
        link_access_url: linkAccessUrl,
      };
    } catch (err) {
      this.logger.error('Could not create link token', err);
      throw new InternalServerErrorException('Could not create link token');
    }
  }

  async create(data: Partial<ExternalAccountModel>): Promise<ExternalAccountModel> {
    const { user_id, provider } = data;

    if (!user_id || !provider) {
      throw new BadRequestException('Missing required fields: user_id or provider');
    }

    // Only check for duplicates if participant_code is provided (not for placeholder records)
    if (data.participant_code) {
      const existingExternalAccount = await this.externalAccountRepository.findOne({
        user_id,
        participant_code: data.participant_code,
        provider,
      });

      if (existingExternalAccount) {
        throw new ConflictException('External account already exists for this user, participant, and provider');
      }
    }

    try {
      // Get or create user's USD fiat wallet and assign its ID to the external account
      const usdWallet = await this.fiatWalletService.getUserWallet(user_id, 'USD');

      const externalAccountData = {
        ...data,
        fiat_wallet_id: usdWallet.id,
      };

      const externalAccount = await this.externalAccountRepository.create(externalAccountData);

      return this.externalAccountRepository.getPublicValues(externalAccount) as ExternalAccountModel;
    } catch (error) {
      this.logger.error(error);
      throw new InternalServerErrorException('Could not create external account');
    }
  }

  async findOne(filter: Partial<ExternalAccountModel>) {
    const externalAccount = await this.externalAccountRepository.findOne(filter);

    if (!externalAccount) {
      throw new NotFoundException('External account not found');
    }

    return externalAccount;
  }

  async update(
    filter: ExternalAccountFilterInterface,
    data: Partial<ExternalAccountModel>,
  ): Promise<ExternalAccountModel> {
    const existingExternalAccount = await this.findOne({ id: filter.id });

    if (!existingExternalAccount) {
      throw new NotFoundException('External account not found');
    }

    if (filter.userId && existingExternalAccount.user_id !== filter.userId) {
      throw new ForbiddenException("You cannot update another user's external account");
    }

    return this.externalAccountRepository.update({ id: filter.id }, data);
  }

  async delete(filter: Partial<ExternalAccountModel>): Promise<void> {
    const existingExternalAccount = await this.findOne(filter);

    if (!existingExternalAccount) {
      throw new NotFoundException('External account not found');
    }

    await this.externalAccountRepository.delete(existingExternalAccount.id);
  }

  async getExternalAccounts(user: UserModel): Promise<any> {
    return await this.externalAccountRepository
      .query()
      .select(ExternalAccountModel.publicProperty())
      .where('user_id', user.id)
      .whereNot('status', 'pending');
  }

  async getExternalAccount(user: UserModel, externalAccountId: string): Promise<ExternalAccountModel> {
    const externalAccount = await this.externalAccountRepository.findById(externalAccountId);

    if (!externalAccount) {
      throw new NotFoundException('Account not found');
    }

    if (externalAccount.user_id !== user.id) {
      throw new BadRequestException('Forbidden Resource');
    }

    return externalAccount as ExternalAccountModel;
  }

  /**
   * Validates provider KYC status is approved
   * @throws ExternalAccountKycException if provider_kyc_status not approved
   */
  private validateProviderKycStatus(
    externalAccount: ExternalAccountModel,
    userId: string,
    transactionType: string,
  ): void {
    const providerKycStatus = externalAccount.provider_kyc_status?.toLowerCase();
    if (providerKycStatus !== 'approved') {
      this.logger.warn(
        `${transactionType} blocked for user ${userId}: provider_kyc_status=${providerKycStatus}, external_account_id=${externalAccount.id}`,
      );
      throw new ExternalAccountKycException(providerKycStatus || 'unknown');
    }
  }

  /**
   * Gets external account by user_id and provider, validates provider_kyc_status is approved
   * @throws NotFoundException if external account not found
   * @throws BadRequestException if participant_code missing
   * @throws ExternalAccountKycException if provider_kyc_status not approved
   */
  async getExternalAccountForTransaction(userId: string, provider: string): Promise<ExternalAccountModel> {
    const externalAccount = await this.externalAccountRepository.findOne({
      user_id: userId,
      provider,
    });

    if (!externalAccount) {
      throw new NotFoundException('External account not found. Please complete your account setup.');
    }

    if (!externalAccount.participant_code) {
      throw new BadRequestException('External account is not properly configured.');
    }

    this.validateProviderKycStatus(externalAccount, userId, 'Transaction');

    return externalAccount;
  }

  /**
   * Check if the transaction amount exceeds user's tier limits
   * Delegates to UserTierService for centralized limit validation
   * Uses database transaction to prevent TOCTOU vulnerabilities
   */
  private async checkLimits(
    user: UserModel,
    amount: number,
    currency: string,
    transactionType: FiatWalletTransactionType,
  ): Promise<void> {
    // Use Redis locks for atomic limit checking (handled within validateLimit)
    const amountInSmallestUnit = CurrencyUtility.formatCurrencyAmountToSmallestUnit(amount, currency);
    // Use Redis locks for atomic limit checking (handled within validateLimit)
    await this.userTierService.validateLimit(user.id, amountInSmallestUnit, currency, transactionType);
  }

  /**
   * Check if user has any active transactions of a specific type
   * Active statuses: PENDING, PROCESSING, INITIATED, REVIEW
   * @throws ConflictException if active transaction exists
   */
  private async checkForActiveTransaction(userId: string, transactionType: FiatWalletTransactionType): Promise<void> {
    const existingTransaction = await this.fiatWalletTransactionRepository
      .query()
      .where({ user_id: userId, transaction_type: transactionType })
      .whereIn('status', [
        TransactionStatus.PENDING,
        TransactionStatus.PROCESSING,
        TransactionStatus.INITIATED,
        TransactionStatus.REVIEW,
      ])
      .first();

    if (existingTransaction) {
      throw new ConflictException(
        'You already have a pending transaction for this account. Please wait for it to complete.',
      );
    }
  }

  async deposit(user: UserModel, transferRequest: TransferDto): Promise<any> {
    this.logger.debug(`Processing deposit request for user ${user.id}`);

    // KYC verification check for USD transactions
    const kycVerification = await this.kycVerificationService.findByUserId(user.id);
    if (!kycVerification?.provider_ref) {
      throw new BadRequestException('KYC verification required for USD transactions');
    }

    // Check tier limits before processing
    await this.checkLimits(user, transferRequest.amount, transferRequest.currency, FiatWalletTransactionType.DEPOSIT);

    // Use lock service to prevent multiple transactions for the same user at the same time
    const lockKey = `deposit-request:${user.id}:${transferRequest.external_account_id}`;

    return this.lockerService.withLock(lockKey, async () => {
      try {
        // PARALLEL DATA FETCHING
        const [externalAccount] = await Promise.all([
          this.externalAccountRepository.findOne({
            id: transferRequest.external_account_id,
            user_id: user.id,
          }),
          user.$fetchGraph('[country]'),
          this.checkForActiveTransaction(user.id, FiatWalletTransactionType.DEPOSIT),
        ]);

        // VALIDATIONS
        if (!externalAccount) {
          throw new NotFoundException('External account not found');
        }

        // Validate provider KYC status
        this.validateProviderKycStatus(externalAccount, user.id, 'Deposit');

        // Validate that we have the required Plaid linking information
        if (!externalAccount.linked_access_token || !externalAccount.linked_account_ref) {
          throw new BadRequestException('Account is not linked');
        }

        // Validate external account status - allow APPROVED and PENDING_DISCONNECT
        const allowedStatuses = [ExternalAccountStatus.APPROVED, ExternalAccountStatus.PENDING_DISCONNECT];
        if (!allowedStatuses.includes(externalAccount.status)) {
          throw new BadRequestException(
            `Account is not available for transactions. Status: ${externalAccount.status}. Please reconnect your bank account.`,
          );
        }

        const countryCode = user.country.code;

        // SIGNAL EVALUATION AND QUOTE FETCHING
        this.logger.log('Proceeding with signal evaluation and quote fetching');
        this.logger.debug(
          `Using Plaid account ID: ${externalAccount.linked_account_ref} ` +
            `for external account ref: ${externalAccount.external_account_ref}`,
        );

        // For deposits, operation is always 'buy' (buying stablecoin with fiat)
        const operation = 'buy';

        // Parallel execution of signal evaluation and quote request
        let signalResponse: RiskSignalResponse;
        let requestFundingQuoteResponse: any;

        try {
          [signalResponse, requestFundingQuoteResponse] = await Promise.all([
            this.externalAccountAdapter.evaluateRiskSignal(
              {
                token: externalAccount.linked_access_token,
                accountRef: externalAccount.linked_account_ref,
                amount: transferRequest.amount,
                currency: transferRequest.currency,
              },
              countryCode,
            ),
            this.externalAccountAdapter.requestQuote(
              {
                providerUserRef: externalAccount.participant_code,
                targetCurrency: transferRequest.currency,
                sourceCurrency: EnvironmentService.getValue('DEFAULT_UNDERLYING_CURRENCY'),
                operation: operation,
                amount: transferRequest.amount.toString(),
                quoteExpiry: '1m',
              },
              countryCode,
            ),
          ]);
        } catch (error) {
          if (error instanceof ServiceUnavailableException) {
            // Re-throw with deposit-specific message for fund endpoint
            throw new ServiceUnavailableException('Your deposit could not be completed. Please try again later.');
          }
          // For other errors, re-throw as-is
          throw error;
        }

        const result = signalResponse.ruleset.result;
        const ruleset = signalResponse.ruleset.rulesetKey;
        this.logger.log(
          `Signal evaluation completed: ${result} (ruleset: ${ruleset}, requestId: ${signalResponse.requestRef})`,
        );
        this.logger.log(`Funding quote received: ${requestFundingQuoteResponse.quoteRef}`);

        // Handle signal evaluation result
        if (result === 'ACCEPT') {
          // WALLET AND TRANSACTION CREATION

          // Get user's fiat wallet to record balance changes
          const fiatWallet = await this.fiatWalletService.getUserWallet(user.id, transferRequest.currency);
          const balanceBefore = Number(fiatWallet.balance); // Already in cents (smallest unit)
          const transactionAmount = CurrencyUtility.formatCurrencyAmountToSmallestUnit(
            transferRequest.amount,
            transferRequest.currency,
          );

          // For deposits, always use DEPOSIT transaction types
          const transactionType = TransactionType.DEPOSIT;
          const fiatWalletTransactionType = FiatWalletTransactionType.DEPOSIT;

          // Generate unique transaction reference
          const transactionReference = UtilsService.generateTransactionReference();

          // Create initial transaction record with essential quote details
          // NOTE: Only essential fields stored to prevent RAM exhaustion from large metadata
          const transaction = await this.transactionService.create(user.id, {
            reference: transactionReference,
            external_reference: null, // Will be set during execution
            asset: transferRequest.currency,
            amount: transactionAmount,
            balance_before: balanceBefore,
            balance_after: balanceBefore, // Will be updated later when transaction completes
            transaction_type: transactionType,
            category: TransactionCategory.FIAT,
            transaction_scope: TransactionScope.EXTERNAL,
            status: TransactionStatus.PENDING,
            metadata: {
              fiat_wallet_id: fiatWallet.id,
              signal_evaluation: this.buildSignalEvaluationResponse(signalResponse),
              quote: {
                quoteRef: requestFundingQuoteResponse.quoteRef,
                amount: requestFundingQuoteResponse.amount,
                rate: requestFundingQuoteResponse.rate,
                expiresAt: requestFundingQuoteResponse.expiresAt,
              },
              transfer_type: transferRequest.transfer_type,
            },
            description: transferRequest.description || 'External account deposit',
          });

          this.logger.log(
            `Transaction created with ID: ${transaction.id} for quote: ${requestFundingQuoteResponse.quoteRef}`,
          );

          // Create corresponding fiat wallet transaction
          const fiatWalletTransaction = await this.fiatWalletTransactionService.create(user.id, {
            transaction_id: transaction.id,
            fiat_wallet_id: fiatWallet.id,
            transaction_type: fiatWalletTransactionType,
            amount: transactionAmount,
            balance_before: balanceBefore,
            balance_after: balanceBefore, // Will be updated when transaction completes
            currency: transferRequest.currency,
            status: TransactionStatus.PENDING,
            provider: externalAccount.provider,
            provider_quote_ref: requestFundingQuoteResponse.quoteRef, // Store quote ID for trade webhook matching
            source: externalAccount.bank_name,
            destination: 'USD Fiat Wallet',
            description: transferRequest.description || 'External account deposit',
            external_account_id: externalAccount.id, // Link to the external account used
          });

          this.logger.log(`Fiat wallet transaction created with ID: ${fiatWalletTransaction.id}`);

          // TRANSACTION MONITORING
          this.logger.debug('Submitting transaction for monitoring');
          const monitoringResult = await this.transactionMonitoringService.monitorDeposit({
            fiatWalletTransactionId: fiatWalletTransaction.id,
          });

          if (monitoringResult.reviewStatus === 'onHold') {
            // Update transaction status to REVIEW
            await this.transactionService.updateStatus(transaction.id, TransactionStatus.REVIEW, {
              failure_reason: monitoringResult.failureReason,
            });

            // Update fiat wallet transaction status to REVIEW
            await this.fiatWalletTransactionService.updateStatus(fiatWalletTransaction.id, TransactionStatus.REVIEW, {
              failure_reason: monitoringResult.failureReason,
            });

            return {
              success: false,
              message: 'Fund request submitted for review',
              transaction_id: transaction.id,
              status: 'review',
            };
          }

          if (monitoringResult.reviewAnswer !== 'GREEN') {
            throw new BadRequestException('Transaction could not be processed due to monitoring requirements');
          }

          this.logger.log(`Transaction ${transaction.id} approved by monitoring, proceeding with execution`);

          // Prepare job data for queue
          const jobData: ExecuteWalletJobData = {
            transactionId: transaction.id,
            fundingRequest: {
              providerUserRef: externalAccount.participant_code,
              quoteRef: requestFundingQuoteResponse.quoteRef,
              achSignedAgreement: Math.floor(Date.now() / 1000),
              externalAccountRef: externalAccount.external_account_ref,
              description: 'deposit',
            },
            countryCode,
          };

          return await this.executeDeposit(jobData, signalResponse);
        } else {
          // Both REVIEW and REROUTE are treated as rejection for MVP
          return {
            status: 'failed',
            signalEvaluation: this.buildSignalEvaluationResponse(signalResponse),
            message: 'Fund request declined',
          };
        }
      } catch (error) {
        this.logger.error('Deposit request failed', error);
        throw error;
      }
    });
  }

  /**
   * Execute deposit by queuing the wallet transaction operation
   * This method handles the post-monitoring execution logic
   */
  private async executeDeposit(jobData: ExecuteWalletJobData, signalResponse: any): Promise<any> {
    this.logger.debug('Executing approved deposit transaction');

    // PARALLEL EXECUTION UPDATES AND QUEUE
    this.logger.debug('Marking transaction as processing and queuing fund wallet operation');

    // Parallel execution of transaction update, fiat wallet transaction lookup, and job queueing
    const [updatedTransaction, job, fiatWalletTransaction] = await Promise.all([
      // Mark transaction as processing
      this.transactionService.updateStatus(jobData.transactionId, TransactionStatus.PROCESSING, {
        provider_metadata: {
          queued_at: new Date().toISOString(),
          status: 'queued_for_execution',
        },
      }),
      // Queue the heavy execute wallet transaction operation for background processing
      this.executeWalletProcessor.queueExecuteWalletTransaction(jobData),
      // Find the fiat wallet transaction in parallel
      this.fiatWalletTransactionService.findOneOrNull({
        transaction_id: jobData.transactionId,
      }),
    ]);

    this.logger.log(
      `Transaction ${jobData.transactionId} marked as processing, queuing execute wallet transaction operation`,
    );
    this.logger.log(`Execute wallet transaction queued for transaction ${jobData.transactionId}, job ID: ${job.id}`);

    // Update the fiat wallet transaction to processing status if found
    if (fiatWalletTransaction) {
      try {
        await this.fiatWalletTransactionService.updateStatus(fiatWalletTransaction.id, TransactionStatus.PROCESSING, {
          // Keep the existing provider_reference (quote ID) for trade webhook matching
        });
        this.logger.log(`Fiat wallet transaction updated with ID: ${fiatWalletTransaction.id}`);
      } catch (error) {
        this.logger.warn(
          `Could not update fiat wallet transaction for transaction ID: ${jobData.transactionId}`,
          error,
        );
      }
    }

    return {
      status: 'processing',
      signalEvaluation: this.buildSignalEvaluationResponse(signalResponse),
      transactionRef: updatedTransaction.id,
      jobId: job.id,
      message: `Fund request is being processed`,
    };
  }

  /**
   * Check if a transaction status is immutable (cannot be changed)
   * FAILED is not included as it can be moved back to REVIEW for re-evaluation
   */
  private isTransactionStatusImmutable(status: TransactionStatus): boolean {
    return [
      TransactionStatus.PENDING,
      TransactionStatus.PROCESSING,
      TransactionStatus.COMPLETED,
      TransactionStatus.CANCELLED,
    ].includes(status);
  }

  /**
   * Continue deposit execution from webhook approval
   * Reconstructs job data from stored transaction and executes the deposit
   */
  async continueDepositFromWebhook(fiatWalletTransactionId: string): Promise<void> {
    this.logger.log(`Continuing deposit from webhook approval for fiat wallet transaction: ${fiatWalletTransactionId}`);

    try {
      // Get the fiat wallet transaction
      const fiatWalletTransaction = await this.fiatWalletTransactionService.findById(fiatWalletTransactionId);
      if (!fiatWalletTransaction) {
        throw new Error(`Fiat wallet transaction not found: ${fiatWalletTransactionId}`);
      }

      // Cannot update transactions in immutable states
      if (this.isTransactionStatusImmutable(fiatWalletTransaction.status)) {
        this.logger.warn(
          `Cannot continue deposit - fiat wallet transaction ${fiatWalletTransactionId} is in immutable status: ${fiatWalletTransaction.status}`,
        );
        return;
      }

      // Only continue if it's in REVIEW status (can come from FAILED state)
      if (fiatWalletTransaction.status !== TransactionStatus.REVIEW) {
        this.logger.warn(
          `Cannot continue deposit - fiat wallet transaction ${fiatWalletTransactionId} is not in REVIEW status, current status: ${fiatWalletTransaction.status}`,
        );
        return;
      }

      // Get the main transaction
      await fiatWalletTransaction.$fetchGraph('transaction');
      const transaction = fiatWalletTransaction.transaction;
      if (!transaction) {
        throw new Error(`Transaction not found: ${fiatWalletTransaction.transaction_id}`);
      }

      // Get user and external account to reconstruct job data
      const user = await this.userService.findByUserId(fiatWalletTransaction.user_id);
      const externalAccount = await this.externalAccountRepository.findOne({ user_id: fiatWalletTransaction.user_id });

      if (!externalAccount) {
        throw new Error(`External account not found for user: ${fiatWalletTransaction.user_id}`);
      }

      // Reconstruct job data from stored transaction data
      const jobData: ExecuteWalletJobData = {
        transactionId: transaction.id,
        fundingRequest: {
          providerUserRef: externalAccount.participant_code,
          quoteRef: fiatWalletTransaction.provider_quote_ref, // From stored quote reference
          achSignedAgreement: Math.floor(Date.now() / 1000),
          externalAccountRef: externalAccount.external_account_ref,
          description: 'deposit',
        },
        countryCode: user.country?.code,
      };

      // Get stored data from transaction metadata
      const transactionMetadata = transaction.metadata;
      const signalResponse = transactionMetadata.signal_evaluation;

      // Fetch a fresh quote since the original may have expired during monitoring review
      const transferRequest = {
        currency: fiatWalletTransaction.currency,
        amount: CurrencyUtility.formatCurrencyAmountToMainUnit(
          Number(fiatWalletTransaction.amount),
          fiatWalletTransaction.currency,
        ),
        transfer_type: transactionMetadata.transfer_type,
      };

      this.logger.log(`Fetching fresh quote for webhook-resumed deposit - original quote may have expired`);
      const freshQuoteResponse = await this.fetchQuote(externalAccount, transferRequest, user.country?.code || 'US');
      this.logger.log(`Fresh quote obtained: ${freshQuoteResponse.quoteRef}`);

      // Update job data with fresh quote
      jobData.fundingRequest.quoteRef = freshQuoteResponse.quoteRef;

      // Update fiat wallet transaction with fresh quote reference for webhook tracking
      await this.fiatWalletTransactionRepository.update(fiatWalletTransactionId, {
        provider_quote_ref: freshQuoteResponse.quoteRef,
      });

      // Continue with deposit execution using stored signal evaluation and fresh quote
      // Note: signalResponse is already processed, no need to transform it again
      await this.executeDeposit(jobData, signalResponse);

      this.logger.log(`Successfully continued deposit for fiat wallet transaction: ${fiatWalletTransactionId}`);
    } catch (error) {
      this.logger.error(
        `Failed to continue deposit from webhook for fiat wallet transaction ${fiatWalletTransactionId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Fail deposit from webhook rejection
   * Updates transaction statuses to FAILED
   */
  async failDepositFromWebhook(fiatWalletTransactionId: string, rejectionReason: string): Promise<void> {
    this.logger.log(`Failing deposit from webhook rejection for fiat wallet transaction: ${fiatWalletTransactionId}`);

    try {
      // Get the fiat wallet transaction
      const fiatWalletTransaction = await this.fiatWalletTransactionService.findById(fiatWalletTransactionId);
      if (!fiatWalletTransaction) {
        throw new Error(`Fiat wallet transaction not found: ${fiatWalletTransactionId}`);
      }

      // Cannot update transactions in immutable states
      if (this.isTransactionStatusImmutable(fiatWalletTransaction.status)) {
        this.logger.warn(
          `Cannot fail deposit - fiat wallet transaction ${fiatWalletTransactionId} is in immutable status: ${fiatWalletTransaction.status}`,
        );
        return;
      }

      // Only fail if it's in REVIEW status (or can transition from FAILED back to FAILED for additional reasons)
      if (
        fiatWalletTransaction.status !== TransactionStatus.REVIEW &&
        fiatWalletTransaction.status !== TransactionStatus.FAILED
      ) {
        this.logger.warn(
          `Cannot fail deposit - fiat wallet transaction ${fiatWalletTransactionId} is not in REVIEW or FAILED status, current status: ${fiatWalletTransaction.status}`,
        );
        return;
      }

      // Append to existing failure reason if it exists
      const existingReason = fiatWalletTransaction.failure_reason;
      const failureReason = existingReason
        ? `${existingReason}; Transaction monitoring rejection: ${rejectionReason}`
        : `Transaction monitoring rejection: ${rejectionReason}`;

      // Update both transaction and fiat wallet transaction to FAILED
      await Promise.all([
        this.transactionService.updateStatus(fiatWalletTransaction.transaction_id, TransactionStatus.FAILED, {
          failure_reason: failureReason,
        }),
        this.fiatWalletTransactionService.updateStatus(fiatWalletTransactionId, TransactionStatus.FAILED, {
          failure_reason: failureReason,
        }),
      ]);

      this.logger.log(`Successfully failed deposit for fiat wallet transaction: ${fiatWalletTransactionId}`);
    } catch (error) {
      this.logger.error(
        `Failed to reject deposit from webhook for fiat wallet transaction ${fiatWalletTransactionId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Put deposit back on hold from webhook
   * Updates transaction statuses to REVIEW only if not already COMPLETED
   */
  async holdDepositFromWebhook(fiatWalletTransactionId: string): Promise<void> {
    this.logger.log(`Putting deposit on hold from webhook for fiat wallet transaction: ${fiatWalletTransactionId}`);

    try {
      // Get the fiat wallet transaction
      const fiatWalletTransaction = await this.fiatWalletTransactionService.findById(fiatWalletTransactionId);
      if (!fiatWalletTransaction) {
        throw new Error(`Fiat wallet transaction not found: ${fiatWalletTransactionId}`);
      }

      // Cannot update transactions in immutable states
      if (this.isTransactionStatusImmutable(fiatWalletTransaction.status)) {
        this.logger.warn(
          `Cannot hold deposit - fiat wallet transaction ${fiatWalletTransactionId} is in immutable status: ${fiatWalletTransaction.status}`,
        );
        return;
      }

      // Can hold transactions in REVIEW or FAILED status (FAILED can be moved to REVIEW for re-evaluation)
      if (
        fiatWalletTransaction.status !== TransactionStatus.REVIEW &&
        fiatWalletTransaction.status !== TransactionStatus.FAILED
      ) {
        this.logger.warn(
          `Cannot hold deposit - fiat wallet transaction ${fiatWalletTransactionId} is not in REVIEW or FAILED status, current status: ${fiatWalletTransaction.status}`,
        );
        return;
      }

      // Append to existing failure reason if it exists
      const existingReason = fiatWalletTransaction.failure_reason;
      const holdReason = existingReason
        ? `${existingReason}; Transaction monitoring hold`
        : 'Transaction monitoring hold';

      // Update both transaction and fiat wallet transaction to REVIEW
      await Promise.all([
        this.transactionService.updateStatus(fiatWalletTransaction.transaction_id, TransactionStatus.REVIEW, {
          failure_reason: holdReason,
        }),
        this.fiatWalletTransactionService.updateStatus(fiatWalletTransactionId, TransactionStatus.REVIEW, {
          failure_reason: holdReason,
        }),
      ]);

      this.logger.log(`Successfully put deposit on hold for fiat wallet transaction: ${fiatWalletTransactionId}`);
    } catch (error) {
      this.logger.error(
        `Failed to put deposit on hold from webhook for fiat wallet transaction ${fiatWalletTransactionId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Fetch a fresh quote from the external account adapter
   * This method can be used both in initial deposit flow and webhook continuation
   */
  private async fetchQuote(
    externalAccount: ExternalAccountModel,
    transferRequest: any,
    countryCode: string,
  ): Promise<any> {
    this.logger.debug(`Fetching fresh quote for participant: ${externalAccount.participant_code}`);

    const operation = transferRequest.transfer_type === 'debit' ? 'buy' : 'sell';

    return await this.externalAccountAdapter.requestQuote(
      {
        providerUserRef: externalAccount.participant_code,
        targetCurrency: transferRequest.currency,
        sourceCurrency: EnvironmentService.getValue('DEFAULT_UNDERLYING_CURRENCY'),
        operation: operation,
        amount: transferRequest.amount.toString(),
        quoteExpiry: '1m',
      },
      countryCode,
    );
  }

  async withdraw(user: UserModel, transferRequest: TransferDto): Promise<any> {
    this.logger.debug(`Processing withdrawal request for user ${user.id}`);

    // KYC verification check for USD transactions
    const kycVerification = await this.kycVerificationService.findByUserId(user.id);
    if (!kycVerification?.provider_ref) {
      throw new BadRequestException('KYC verification required for USD transactions');
    }

    // Check tier limits before processing
    await this.checkLimits(
      user,
      transferRequest.amount,
      transferRequest.currency,
      FiatWalletTransactionType.WITHDRAWAL,
    );

    // Use lock service to prevent multiple transactions for the same user at the same time
    const lockKey = `withdraw-request:${user.id}:${transferRequest.external_account_id}`;

    return this.lockerService.withLock(lockKey, async () => {
      try {
        // PARALLEL DATA FETCHING
        const [externalAccount] = await Promise.all([
          this.externalAccountRepository.findOne({
            id: transferRequest.external_account_id,
            user_id: user.id,
          }),
          user.$fetchGraph('[country]'),
          this.checkForActiveTransaction(user.id, FiatWalletTransactionType.WITHDRAWAL),
        ]);

        // VALIDATIONS
        if (!externalAccount) {
          throw new NotFoundException('External account not found');
        }

        // Validate provider KYC status
        this.validateProviderKycStatus(externalAccount, user.id, 'Withdrawal');

        // Validate that we have the required Plaid linking information
        if (!externalAccount.linked_access_token || !externalAccount.linked_account_ref) {
          throw new BadRequestException('Account is not linked');
        }

        // Validate external account status - allow APPROVED and PENDING_DISCONNECT
        const allowedStatuses = [ExternalAccountStatus.APPROVED, ExternalAccountStatus.PENDING_DISCONNECT];
        if (!allowedStatuses.includes(externalAccount.status)) {
          throw new BadRequestException(
            `Account is not available for transactions. Status: ${externalAccount.status}. Please reconnect your bank account.`,
          );
        }

        const countryCode = user.country.code;

        // QUOTE FETCHING (no risk signal for withdrawals)
        this.logger.log('Proceeding with quote fetching for withdrawal (skipping risk signal evaluation)');

        // For withdrawals, operation is always 'sell' (selling stablecoin for fiat)
        const operation = 'sell';

        const requestFundingQuoteResponse = await this.externalAccountAdapter.requestQuote(
          {
            providerUserRef: externalAccount.participant_code,
            targetCurrency: transferRequest.currency,
            sourceCurrency: EnvironmentService.getValue('DEFAULT_UNDERLYING_CURRENCY'),
            operation: operation,
            amount: transferRequest.amount.toString(),
            quoteExpiry: '1m',
          },
          countryCode,
        );

        this.logger.log('Withdrawal quote received: ' + requestFundingQuoteResponse.quoteRef);

        // WALLET AND TRANSACTION CREATION

        // Get user's fiat wallet to record balance changes
        const fiatWallet = await this.fiatWalletService.getUserWallet(user.id, transferRequest.currency);
        const balanceBefore = Number(fiatWallet.balance); // Already in cents (smallest unit)
        const transactionAmount = CurrencyUtility.formatCurrencyAmountToSmallestUnit(
          transferRequest.amount,
          transferRequest.currency,
        );

        // Check if user has sufficient balance for withdrawal
        if (balanceBefore < transactionAmount) {
          throw new BadRequestException('Insufficient balance for withdrawal');
        }

        // For withdrawals, always use WITHDRAWAL transaction types
        const transactionType = TransactionType.WITHDRAWAL;
        const fiatWalletTransactionType = FiatWalletTransactionType.WITHDRAWAL;

        // Generate unique transaction reference
        const transactionReference = UtilsService.generateTransactionReference();

        // Create initial transaction record with essential quote details
        // NOTE: Only essential fields stored to prevent RAM exhaustion from large metadata
        const transaction = await this.transactionService.create(user.id, {
          reference: transactionReference,
          external_reference: null, // Will be set during execution
          asset: transferRequest.currency,
          amount: -transactionAmount, // Negative for withdrawal
          balance_before: balanceBefore,
          balance_after: balanceBefore, // Will be updated later when transaction completes
          transaction_type: transactionType,
          category: TransactionCategory.FIAT,
          transaction_scope: TransactionScope.EXTERNAL,
          status: TransactionStatus.PENDING,
          metadata: {
            fiat_wallet_id: fiatWallet.id,
            quote: {
              quoteRef: requestFundingQuoteResponse.quoteRef,
              amount: requestFundingQuoteResponse.amount,
              rate: requestFundingQuoteResponse.rate,
              expiresAt: requestFundingQuoteResponse.expiresAt,
            },
            transfer_type: transferRequest.transfer_type,
          },
          description: transferRequest.description || 'External account withdrawal',
        });

        this.logger.log(
          `Transaction created with ID: ${transaction.id} for quote: ${requestFundingQuoteResponse.quoteRef}`,
        );

        // Create corresponding fiat wallet transaction
        const fiatWalletTransaction = await this.fiatWalletTransactionService.create(user.id, {
          transaction_id: transaction.id,
          fiat_wallet_id: fiatWallet.id,
          transaction_type: fiatWalletTransactionType,
          amount: -transactionAmount, // Negative for withdrawal
          balance_before: balanceBefore,
          balance_after: balanceBefore, // Will be updated when transaction completes
          currency: transferRequest.currency,
          status: TransactionStatus.PENDING,
          provider: externalAccount.provider,
          provider_quote_ref: requestFundingQuoteResponse.quoteRef, // Store quote ID for trade webhook matching
          source: 'USD Fiat Wallet',
          destination: externalAccount.bank_name,
          description: transferRequest.description || 'External account withdrawal',
          external_account_id: externalAccount.id, // Link to the external account used
        });

        this.logger.log(`Fiat wallet transaction created with ID: ${fiatWalletTransaction.id}`);

        // EXECUTE TRANSACTION VIA QUEUE (same as deposits)
        this.logger.debug('Executing transaction via queue');

        // Prepare job data for queue
        const jobData: ExecuteWalletJobData = {
          transactionId: transaction.id,
          fundingRequest: {
            providerUserRef: externalAccount.participant_code,
            quoteRef: requestFundingQuoteResponse.quoteRef,
            achSignedAgreement: Math.floor(Date.now() / 1000),
            externalAccountRef: externalAccount.external_account_ref,
            description: 'withdrawal',
          },
          countryCode,
        };

        // PARALLEL EXECUTION UPDATES AND QUEUE
        this.logger.debug('Marking transaction as processing and queuing fund wallet operation');

        // Parallel execution of transaction update, fiat wallet transaction update, and job queueing
        const [updatedTransaction, job] = await Promise.all([
          // Mark transaction as processing
          this.transactionService.updateStatus(transaction.id, TransactionStatus.PROCESSING, {
            provider_metadata: {
              queued_at: new Date().toISOString(),
              status: 'queued_for_execution',
            },
          }),
          // Queue the heavy execute wallet transaction operation for background processing
          this.executeWalletProcessor.queueExecuteWalletTransaction(jobData),
          // Update fiat wallet transaction status to processing in parallel
          this.fiatWalletTransactionService.updateStatus(fiatWalletTransaction.id, TransactionStatus.PROCESSING, {
            provider_metadata: {
              queued_at: new Date().toISOString(),
              status: 'queued_for_execution',
            },
          }),
        ]);

        this.logger.log(
          `Transaction ${transaction.id} marked as processing, queuing execute wallet transaction operation`,
        );
        this.logger.log(`Execute wallet transaction queued for transaction ${transaction.id}, job ID: ${job.id}`);
        this.logger.log(`Fiat wallet transaction updated with ID: ${fiatWalletTransaction.id}`);

        return {
          status: 'processing',
          signalEvaluation: null, // No signal evaluation for withdrawals
          transactionRef: updatedTransaction.id,
          message: `Withdrawal transaction created and executed. Quote: ${requestFundingQuoteResponse.quoteRef}. Amount: ${requestFundingQuoteResponse.amount} ${transferRequest.currency}`,
        };
      } catch (error) {
        this.logger.error('Withdrawal request failed', error);
        throw error;
      }
    });
  }

  private buildSignalEvaluationResponse(signalResponse: RiskSignalResponse): SignalEvaluationResponse {
    // If already processed (webhook flow), return as-is
    if (signalResponse && 'result' in signalResponse && !signalResponse.ruleset) {
      return signalResponse as SignalEvaluationResponse;
    }

    // For raw signal responses from initial deposit flow
    return {
      result: signalResponse.ruleset.result,
      rulesetKey: signalResponse.ruleset.rulesetKey,
      requestRef: signalResponse.requestRef,
      scores: this.buildScoresResponse(signalResponse.scores),
    };
  }

  private buildScoresResponse(scores: RiskSignalResponse['scores']): SignalEvaluationResponse['scores'] {
    return {
      bankInitiatedReturnRisk: scores.bankInitiatedReturnRisk,
      customerInitiatedReturnRisk: scores.customerInitiatedReturnRisk,
    };
  }

  private async getLinkAccessUrl(user: UserModel, linkToken: string): Promise<string> {
    const tokenData = await this.accessTokenService.create(
      {
        id: user.id,
        email: user.email,
        phone_number: user.phone_number,
      },
      undefined,
      true,
    );
    return `http://localhost:9000/views/plaid/link?linkToken=${linkToken}&accessToken=${tokenData.decodedToken.access_token}`;
  }

  /**
   * Get or create a link token for updating bank account credentials
   */
  async getLinkTokenUpdate(user: UserModel, androidPackageName?: string): Promise<CreateTokenResponse> {
    this.logger.debug(`Getting link token update for user ${user.id}`);

    try {
      // Check if there's a valid token in Redis
      const redisKey = `link_token_update:${user.id}:plaid`;
      const cachedTokenData = await this.redisCacheService.get<any>(redisKey);

      if (cachedTokenData?.token) {
        this.logger.debug(`Found cached link token for user ${user.id}`);
        return {
          token: cachedTokenData.token,
          expiration: cachedTokenData.expiration,
          requestRef: cachedTokenData.requestRef,
        };
      }

      // No valid cached token, find Plaid external account
      const externalAccount = (await this.externalAccountRepository.query().findOne({
        user_id: user.id,
        linked_provider: 'plaid',
      })) as ExternalAccountModel;

      if (!externalAccount) {
        throw new NotFoundException('External account not found');
      }

      if (!externalAccount?.linked_access_token) {
        throw new NotFoundException('No Plaid external account found that requires updating');
      }

      // Check if the account status allows for updates
      const allowedUpdateStatuses = [
        ExternalAccountStatus.PENDING_DISCONNECT,
        ExternalAccountStatus.ITEM_LOGIN_REQUIRED,
      ];

      if (!allowedUpdateStatuses.includes(externalAccount.status)) {
        throw new BadRequestException(
          `Bank account with status '${externalAccount.status}' cannot be updated. Please contact support or unlink the account and relink a new account.`,
        );
      }

      // Generate new update link token
      const createTokenRequest: CreateTokenRequest = {
        clientName: 'OneDosh',
        language: 'en',
        user: {
          userRef: user.id,
        },
        accessToken: externalAccount.linked_access_token, // This makes it update mode
      };
      if (androidPackageName) {
        createTokenRequest.androidPackageName = androidPackageName;
      }

      const updateLinkResponse = await this.linkBankAccountAdapter.createLinkToken(createTokenRequest, 'US');

      // Store new token in Redis with 1-hour TTL
      await this.redisCacheService.set(
        redisKey,
        {
          token: updateLinkResponse.token,
          expiration: updateLinkResponse.expiration,
          requestRef: updateLinkResponse.requestRef,
          externalAccountId: externalAccount.id,
          itemId: externalAccount.linked_item_ref,
          createdAt: new Date().toISOString(),
        },
        3600,
      ); // 1 hour TTL

      this.logger.debug(`Created new link token update for user ${user.id}`);

      return updateLinkResponse;
    } catch (error) {
      this.logger.error(`Failed to get link token update for user ${user.id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a duplicate external account record before soft deletion
   */
  async createDuplicateRecord(originalAccount: ExternalAccountModel): Promise<ExternalAccountModel> {
    this.logger.debug(`Creating duplicate record for external account ${originalAccount.id}`);

    const duplicateData = {
      user_id: originalAccount.user_id,
      participant_code: originalAccount.participant_code,
      provider_kyc_status: originalAccount.provider_kyc_status,
      status: ExternalAccountStatus.PENDING,
      provider: originalAccount.provider,
    };

    const duplicateRecord = await this.create(duplicateData);
    this.logger.log(`Created duplicate external account ${duplicateRecord.id} for original ${originalAccount.id}`);

    return duplicateRecord;
  }

  /**
   * Close an external account - clears data, soft deletes, creates duplicate, and sends notifications
   * This is typically called by the webhook when ZeroHash confirms account closure
   */
  async closeExternalAccount(externalAccountId: string): Promise<void> {
    this.logger.log(`Closing external account ${externalAccountId}`);

    try {
      // Find the external account
      const externalAccount = (await this.externalAccountRepository.findById(
        externalAccountId,
      )) as ExternalAccountModel;

      if (!externalAccount) {
        throw new NotFoundException(`External account ${externalAccountId} not found`);
      }

      const user = await this.userService.findByUserId(externalAccount.user_id);

      if (!user) {
        throw new NotFoundException(`User ${externalAccount.user_id} not found`);
      }

      // Store bank details for notifications
      const bankDetails = {
        account_name: externalAccount.account_name,
        bank_name: externalAccount.bank_name,
        account_number: externalAccount.account_number,
        account_type: externalAccount.account_type,
      };

      // Update status to unlinked and reset sensitive data
      await this.update(
        { id: externalAccount.id },
        {
          status: ExternalAccountStatus.UNLINKED,
          linked_access_token: null,
          linked_processor_token: null,
          linked_item_ref: null,
          linked_account_ref: null,
          linked_provider: null,
          external_account_ref: null,
          participant_code: null,
          bank_ref: null,
          routing_number: null,
          nuban: null,
          swift_code: null,
          account_name: null,
          account_type: null,
          expiration_date: null,
          capabilities: null,
        },
      );

      this.logger.debug(`Updated external account ${externalAccount.id} status to unlinked`);

      // Soft-delete the old record (data preserved for auditing)
      await this.delete({ id: externalAccount.id });

      // Create duplicate record with pending status
      await this.createDuplicateRecord(externalAccount);

      this.logger.log(`Created duplicate external account for user ${user.id} after closure`);

      // Send email notification about the unlinking
      try {
        const emailNotification = new BankAccountUnlinkedMail(
          user as any as UserModel,
          bankDetails.account_name,
          bankDetails.bank_name,
          bankDetails.account_number,
        );

        await this.mailerService.send(emailNotification);

        this.logger.log(
          `Sent bank account unlinked notification email to ${user.email} for external account ${externalAccount.id}`,
        );
      } catch (emailError) {
        this.logger.error(`Failed to send bank account unlinked email to ${user.email}: ${emailError.message}`);
        // Don't throw - email failure shouldn't fail the closure
      }

      // Send in-app notification about the unlinking
      try {
        await this.inAppNotificationService.createNotification({
          user_id: user.id,
          type: IN_APP_NOTIFICATION_TYPE.ACCOUNT_UNLINKED,
          title: 'Bank Account Unlinked',
          message: `Your bank account ending in ${bankDetails.account_number || '****'} has been unlinked from OneDosh. You can re-link it anytime from your wallet.`,
          metadata: {
            bankName: bankDetails.bank_name,
            accountName: bankDetails.account_name,
            accountId: externalAccount.id,
            accountType: bankDetails.account_type,
          },
        });

        this.logger.log(
          `Created in-app notification for user ${user.id} regarding unlinked external account ${externalAccount.id}`,
        );
      } catch (notificationError) {
        this.logger.error(`Failed to create in-app notification for user ${user.id}: ${notificationError.message}`);
        // Don't throw - notification failure shouldn't fail the closure
      }

      this.logger.log(`Successfully closed external account ${externalAccountId}`);
    } catch (error) {
      this.logger.error(`Error closing external account ${externalAccountId}:`, error);
      throw error;
    }
  }

  /**
   * Unlink the user's connected bank account
   */
  async unlinkBankAccount(user: UserModel): Promise<{ success: boolean; message: string }> {
    this.logger.debug(`Starting unlinkBankAccount for user ${user.id}`);

    try {
      // Find the external account with linked provider (Plaid)
      const externalAccount = (await this.externalAccountRepository.query().findOne({
        user_id: user.id,
        linked_provider: PROVIDERS.PLAID,
      })) as ExternalAccountModel;

      if (!externalAccount) {
        throw new NotFoundException('No linked bank account found to unlink');
      }

      // Check for pending or processing USD fiat transactions
      const pendingTransactions = await this.fiatWalletTransactionRepository
        .query()
        .where({
          user_id: user.id,
          currency: 'USD',
        })
        .where((builder) => {
          builder.where('status', TransactionStatus.PENDING).orWhere('status', TransactionStatus.PROCESSING);
        })
        .whereNull('deleted_at')
        .first();

      if (pendingTransactions) {
        throw new BadRequestException(
          'Cannot unlink bank account while you have pending or processing USD transactions. Please wait for them to complete.',
        );
      }

      // Call Plaid to remove the item if we have the access token
      if (externalAccount.linked_access_token) {
        try {
          this.logger.debug(`Removing Plaid item for user ${user.id} using access token`);
          await this.linkBankAccountAdapter.unlinkAccount({ accessToken: externalAccount.linked_access_token }, 'US');
          this.logger.debug(`Successfully removed Plaid item for user ${user.id}`);
        } catch (plaidError) {
          this.logger.warn(`Failed to remove Plaid item for user ${user.id}: ${plaidError.message}`);
          // Continue with ZeroHash closure even if Plaid removal fails
        }
      }

      // Call ZeroHash to close the external account - the webhook will handle state updates
      if (externalAccount.external_account_ref && externalAccount.participant_code) {
        try {
          this.logger.debug(
            `Closing ZeroHash external account ${externalAccount.external_account_ref} for user ${user.id}`,
          );

          await this.linkBankAccountAdapter.closeAccount(
            {
              externalAccountRef: externalAccount.external_account_ref,
              participantCode: externalAccount.participant_code,
            },
            'US',
          );

          this.logger.debug(`Successfully closed ZeroHash external account for user ${user.id}`);
        } catch (zerohashError) {
          this.logger.error(`Failed to close ZeroHash external account for user ${user.id}: ${zerohashError.message}`);
          throw zerohashError;
        }
      }

      // Clear cached update token since the account is no longer valid
      const redisKey = `link_token_update:${user.id}:plaid`;
      await this.redisCacheService.del(redisKey);

      this.logger.log(`Successfully initiated unlink for user ${user.id}, external account ${externalAccount.id}`);

      return {
        success: true,
        message: 'Bank account unlink initiated successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to unlink bank account for user ${user.id}: ${error.message}`);
      throw error;
    }
  }
}
