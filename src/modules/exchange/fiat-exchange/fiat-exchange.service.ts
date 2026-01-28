import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { subtract } from 'mathjs';
import { Transaction } from 'objection';
import { FiatWalletConfigProvider } from '../../../config/fiat-wallet.config';
import { CurrencyUtility, SUPPORTED_CURRENCIES } from '../../../currencies';
import {
  FiatWalletTransactionModel,
  FiatWalletTransactionType,
  RateTransactionType,
  TransactionCategory,
  TransactionModel,
  TransactionScope,
  TransactionStatus,
  TransactionType,
} from '../../../database';
import { UserModel } from '../../../database/models/user/user.model';
import { VirtualAccountType } from '../../../database/models/virtualAccount';
import { LockerService } from '../../../services/locker/locker.service';
import { ExchangeJobData, ExchangeProcessor } from '../../../services/queue/processors/exchange/exchange.processor';
import { UtilsService } from '../../../utils/utils.service';
import { KycVerificationService } from '../../auth/kycVerification/kycVerification.service';
import { ExternalAccountService } from '../../externalAccount/external-account.service';
import { FiatWalletService } from '../../fiatWallet/fiatWallet.service';
import { FiatWalletTransactionService } from '../../fiatWalletTransactions/fiatWalletTransactions.service';
import { RateRepository } from '../../rate/rate.repository';
import { RateService } from '../../rate/rate.service';
import { TransactionService } from '../../transaction/transaction.service';
import { UserTierService } from '../../userTier/userTier.service';
import { VirtualAccountService } from '../../virtualAccount';
import { VirtualAccountRepository } from '../../virtualAccount/virtualAccount.repository';
import { ExchangeFiatWalletDto } from '../dto/exchange-fiat-wallet.dto';
import { NewNgToUsdExchangeService } from './ng-to-usd-exchange.service/new-ng-to-usd-exchange.service';
import { NgToUsdExchangeService } from './ng-to-usd-exchange.service/ng-to-usd-exchange.service';

@Injectable()
export class FiatExchangeService implements OnModuleInit {
  private readonly LOCK_TTL_MS = 30000;
  private readonly LOCK_RETRY_COUNT = 5;
  private readonly LOCK_RETRY_DELAY_MS = 500;

  @Inject(KycVerificationService)
  private readonly kycVerificationService: KycVerificationService;

  @Inject(FiatWalletConfigProvider)
  private readonly fiatWalletConfig: FiatWalletConfigProvider;

  @Inject(ExternalAccountService)
  private readonly externalAccountService: ExternalAccountService;

  @Inject(FiatWalletService)
  private readonly fiatWalletService: FiatWalletService;

  @Inject(FiatWalletTransactionService)
  private readonly fiatWalletTransactionService: FiatWalletTransactionService;

  @Inject(TransactionService)
  private readonly transactionService: TransactionService;

  @Inject(LockerService)
  private readonly lockerService: LockerService;

  @Inject(VirtualAccountRepository)
  private readonly virtualAccountRepository: VirtualAccountRepository;

  @Inject(ExchangeProcessor)
  private readonly exchangeProcessor: ExchangeProcessor;

  @Inject(RateRepository)
  private readonly rateRepository: RateRepository;

  @Inject(RateService)
  private readonly rateService: RateService;

  @Inject(forwardRef(() => NgToUsdExchangeService))
  private readonly ngToUsdExchangeService: NgToUsdExchangeService;

  @Inject(UserTierService)
  private readonly userTierService: UserTierService;

  @Inject(NewNgToUsdExchangeService)
  private readonly newNgToUsdExchangeService: NewNgToUsdExchangeService;

  @Inject(VirtualAccountService)
  private readonly virtualAccountService: VirtualAccountService;

  private readonly logger = new Logger(FiatExchangeService.name);

  private defaultFiatWalletProvider: string;
  private defaultUnderlyingCurrency: string;

  async onModuleInit() {
    // Get fiat wallet config
    const config = this.fiatWalletConfig.getConfig();
    this.defaultFiatWalletProvider = config.default_usd_fiat_wallet_provider;
    this.defaultUnderlyingCurrency = config.default_underlying_currency;

    if (!this.defaultFiatWalletProvider) {
      throw new InternalServerErrorException('Default fiat wallet provider not configured');
    }
    if (!this.defaultUnderlyingCurrency) {
      throw new InternalServerErrorException('Default underlying currency not configured');
    }
  }

  /**
   * Initiates a fiat-to-fiat currency exchange transaction between user wallets.
   *
   * This function orchestrates the complete exchange flow by performing validation checks,
   * creating source transactions, and delegating the actual exchange processing to a background queue.
   *
   * Flow:
   * 1. Validates the exchange currency pair (currently only USD -> NGN is supported)
   * 2. Verifies user's KYC verification status is complete
   * 3. Acquires a distributed lock (using user ID and currency pair) to prevent concurrent exchange operations
   * 4. Within the lock:
   *    - Validates user has an external account with the default fiat wallet provider
   *    - Validates user has a virtual account for receiving funds
   *    - Creates source transaction records (Transaction and FiatWalletTransaction) with status INITIATED
   *    - Deducts the exchange amount from the source wallet balance
   *    - Retrieves and validates the exchange rate from the provided rate_id
   * 5. Constructs an ExchangeJobData payload containing:
   *    - User ID and participant code
   *    - Source transaction reference
   *    - Exchange amount and destination country code
   *    - Virtual account details
   * 6. Queues the exchange job to ExchangeProcessor for asynchronous background processing
   *
   * The ExchangeProcessor handles the actual exchange execution including:
   * - Initiating withdrawal from source wallet via fiat wallet provider
   * - Handling webhook callbacks to confirm transaction status
   * - Crediting destination wallet upon successful exchange
   * - Managing transaction state updates and error handling
   *
   * @param user - The authenticated user initiating the exchange
   * @param exchangeDto - Exchange parameters containing from/to currencies, amount, and rate_id
   * @returns Promise resolving to exchange initiation status including transaction reference and job ID for tracking
   * @throws BadRequestException if currency pair unsupported, KYC incomplete, or external account not found
   * @throws ConflictException if user has a pending exchange transaction
   * @throws InternalServerErrorException if job queue fails or configuration is missing
   */
  async exchange(
    user: UserModel,
    exchangeDto: ExchangeFiatWalletDto,
  ): Promise<{
    status: string;
    transactionRef: string;
    message: string;
    jobId: string | number;
  }> {
    const { from, to, amount } = exchangeDto;

    this.logger.log(`Processing exchange: ${amount} ${from} to ${to} for user ${user.username}`);

    // KYC verification check for USD transactions
    await this.validateKycVerification(user.id);

    // Validate daily exchange limit
    const amountInSmallestUnit = CurrencyUtility.formatCurrencyAmountToSmallestUnit(amount, from);
    await this.userTierService.validateLimit(user.id, amountInSmallestUnit, from, FiatWalletTransactionType.EXCHANGE);

    // IF from is NGN and to is USD, then we need to exchange NGN to USD
    if (
      from?.toLowerCase() === SUPPORTED_CURRENCIES.NGN.code.toLowerCase() &&
      to?.toLowerCase() === SUPPORTED_CURRENCIES.USD.code.toLowerCase() &&
      exchangeDto.transaction_id
    ) {
      return await this.ngToUsdExchangeService.executeExchange(user, exchangeDto);
    }

    // IF from is NGN and to is USD, then we need to exchange NGN to USD
    if (
      from?.toLowerCase() === SUPPORTED_CURRENCIES.NGN.code.toLowerCase() &&
      to?.toLowerCase() === SUPPORTED_CURRENCIES.USD.code.toLowerCase() &&
      !exchangeDto.transaction_id
    ) {
      this.logger.error(
        `User ${user.id} is trying to exchange NGN to USD without a transaction ID. This is not allowed.`,
      );
      throw new InternalServerErrorException(
        'Please Update to the latest version of the app to continue with this feature',
      );

      // return await this.newNgToUsdExchangeService.executeExchange(user, exchangeDto);
    }

    // Create a lock key based on user ID and transaction type to prevent concurrent exchanges
    const lockKey = this.generateLockKey(user.id, from, to);

    return await this.lockerService.withLock(
      lockKey,
      async () => {
        // Validate the rate
        await this.rateService.validateRateOrThrow(exchangeDto.rate_id, amount, RateTransactionType.BUY);

        const externalAccount = await this.externalAccountService.getExternalAccountForTransaction(
          user.id,
          this.defaultFiatWalletProvider,
        );

        // Wrap all database operations in a transaction to ensure atomicity
        // If any operation fails, all created records will be rolled back
        return await this.rateRepository.transaction(async (trx) => {
          const { sourceTransaction, sourceFiatWalletTransaction } = await this.createSourceTransactions(
            user.id,
            externalAccount.participant_code,
            {
              from,
              to,
              amount,
              rateId: exchangeDto.rate_id,
            },
            trx,
          );

          // Create virtual account with the source transaction ID as transaction_id
          // This allows multiple exchange accounts per user - one for each exchange
          const virtualAccount = await this.getValidatedVirtualAccount(
            user.id,
            VirtualAccountType.EXCHANGE_ACCOUNT,
            sourceTransaction.id,
            trx,
          );

          // Get withdrawal channels for the destination country (based on target currency)
          const destinationCountryCode = CurrencyUtility.getCurrencyCountryCode(to);
          if (!destinationCountryCode) {
            throw new BadRequestException(`Unsupported destination currency: ${to}`);
          }

          const jobData: ExchangeJobData = {
            userId: user.id,
            participantCode: externalAccount.participant_code,
            sourceTransaction: sourceTransaction,
            amount, // amount in USD, this is the amount that will be withdrawn from the source wallet in USD main unit
            destinationCountryCode: destinationCountryCode,
            virtualAccount,
            sourceFiatWalletTransaction: sourceFiatWalletTransaction,
            rateId: exchangeDto.rate_id,
          };

          // Queue the exchange job for background processing
          const job = await this.exchangeProcessor.queueExchange(jobData);

          if (!job?.id) {
            throw new InternalServerErrorException('Failed to initiate exchange transaction');
          }

          return {
            status: 'processing',
            transactionRef: sourceTransaction.id,
            message: 'Exchange transaction initiated successfully',
            jobId: job.id,
          };
        });
      },
      { ttl: this.LOCK_TTL_MS, retryCount: this.LOCK_RETRY_COUNT, retryDelay: this.LOCK_RETRY_DELAY_MS },
    );
  }

  /**
   * Validate KYC verification for user
   */
  private async validateKycVerification(userId: string): Promise<void> {
    const kycVerification = await this.kycVerificationService.findByUserId(userId);

    if (!kycVerification) {
      throw new BadRequestException('KYC verification required for exchange transactions');
    }

    if (!kycVerification.provider_ref) {
      throw new BadRequestException('KYC verification is incomplete. Please complete your verification to continue');
    }
  }

  /**
   * Generate lock key for exchange operation
   */
  private generateLockKey(userId: string, from: string, to: string): string {
    return `exchange:${userId}:${from}-${to}`;
  }

  /**
   * Get and validate virtual account
   * @param userId - The user ID
   * @param type - The virtual account type
   * @param transactionId - Optional transaction ID to identify the specific exchange
   * @param trx - Optional database transaction for atomicity
   */
  public async getValidatedVirtualAccount(
    userId: string,
    type: VirtualAccountType,
    transactionId?: string,
    trx?: Transaction,
  ) {
    const virtualAccount = await this.virtualAccountService.findOrCreateVirtualAccount(
      userId,
      {
        fiat_wallet_id: null,
        transaction_id: transactionId,
      },
      type,
      trx,
    );

    if (!virtualAccount) {
      throw new BadRequestException('failed to create exchange virtual account');
    }

    // Validate that the returned virtual account has the correct type
    if (virtualAccount.type !== type) {
      this.logger.error(
        `Virtual account type mismatch for user ${userId}. Expected: ${type}, Got: ${virtualAccount.type}`,
      );
      throw new BadRequestException(`Virtual account type mismatch. Expected ${type} but got ${virtualAccount.type}`);
    }

    if (!virtualAccount.account_number) {
      throw new BadRequestException('Virtual account number is missing');
    }

    if (!virtualAccount.account_name) {
      throw new BadRequestException('Virtual account name is missing');
    }

    return virtualAccount;
  }

  /**
   * Check for pending exchange transactions
   */
  private async checkPendingExchangeTransaction(userId: string): Promise<void> {
    const existingTransaction = await this.fiatWalletTransactionService.findOneOrNull({
      user_id: userId,
      transaction_type: FiatWalletTransactionType.EXCHANGE,
      status: TransactionStatus.PENDING,
      provider: this.defaultFiatWalletProvider,
    });

    if (existingTransaction) {
      throw new ConflictException(
        'You already have a pending exchange transaction. Please wait for it to complete or contact support.',
      );
    }
  }

  /**
   * Validate wallet and balance for exchange
   */
  private async validateWalletAndBalance(
    userId: string,
    currency: string,
    amount: number,
  ): Promise<{
    sourceBalanceBefore: number;
    transactionAmount: number;
    sourceBalanceAfter: number;
    sourceWalletId: string;
  }> {
    await this.checkPendingExchangeTransaction(userId);

    const sourceWallet = await this.fiatWalletService.getUserWallet(userId, currency);

    if (!sourceWallet) {
      throw new BadRequestException(`Wallet not found for currency ${currency}`);
    }

    const sourceBalanceBefore = Number(sourceWallet.balance);

    if (Number.isNaN(sourceBalanceBefore)) {
      this.logger.error(
        `Invalid wallet balance format for user ${userId} with provider ${this.defaultFiatWalletProvider}`,
      );
      throw new InternalServerErrorException('Invalid wallet balance format');
    }

    if (sourceBalanceBefore < 0) {
      this.logger.error(
        `Negative wallet balance detected for user ${userId} with provider ${this.defaultFiatWalletProvider}`,
      );
      throw new InternalServerErrorException('Invalid wallet state');
    }

    const transactionAmount = CurrencyUtility.formatCurrencyAmountToSmallestUnit(amount, currency);

    if (Number.isNaN(transactionAmount) || transactionAmount <= 0) {
      throw new BadRequestException('Invalid transaction amount');
    }

    const sourceBalanceAfter = subtract(sourceBalanceBefore, transactionAmount);

    if (sourceBalanceBefore < transactionAmount) {
      this.logger.error(`Insufficient balance for user ${userId} with provider ${this.defaultFiatWalletProvider}`);
      throw new BadRequestException('Insufficient balance for exchange');
    }

    return {
      sourceBalanceBefore,
      transactionAmount,
      sourceBalanceAfter: Number(sourceBalanceAfter),
      sourceWalletId: sourceWallet.id,
    };
  }

  /**
   * Create source transaction and fiat wallet transaction
   * @param userId - The user ID
   * @param participantCode - The participant code from external account
   * @param exchangeOptions - Exchange options containing currencies, amount, and rate ID
   * @param trx - Optional database transaction for atomicity
   */
  private async createSourceTransactions(
    userId: string,
    participantCode: string,
    exchangeOptions: {
      from: string;
      to: string;
      amount: number;
      rateId: string;
    },
    trx?: Transaction,
  ): Promise<{
    sourceTransaction: TransactionModel;
    sourceFiatWalletTransaction: FiatWalletTransactionModel;
  }> {
    const clientWithdrawalRequestId = UtilsService.generateTransactionReference();

    const { from, to, amount, rateId } = exchangeOptions;

    const { sourceBalanceBefore, transactionAmount, sourceBalanceAfter, sourceWalletId } =
      await this.validateWalletAndBalance(userId, from, amount);

    // Get exchange rates to calculate NGN amount
    const exchangeRate = await this.rateRepository.findOne({
      id: rateId,
    });

    if (!exchangeRate) {
      throw new BadRequestException('Exchange rate not found');
    }

    if (!exchangeRate.rate || exchangeRate.rate <= 0) {
      throw new BadRequestException('Invalid exchange rate');
    }

    if (!exchangeRate.provider) {
      throw new InternalServerErrorException('Exchange rate provider is missing');
    }

    const transaction = await this.transactionService.create(
      userId,
      {
        transaction_type: TransactionType.EXCHANGE,
        category: TransactionCategory.FIAT,
        transaction_scope: TransactionScope.INTERNAL,
        status: TransactionStatus.INITIATED,
        amount: transactionAmount,
        asset: from,
        balance_before: sourceBalanceBefore,
        balance_after: sourceBalanceAfter,
        reference: `${clientWithdrawalRequestId}-OUT`,
        external_reference: null,
        description: `Exchange from ${SUPPORTED_CURRENCIES[from.toUpperCase()]?.walletName || from + ' Wallet'}`,
        metadata: {
          from_currency: from,
          to_currency: to,
          original_amount: amount,
          participant_code: participantCode,
          rate: exchangeRate.rate,
          provider_rate: exchangeRate.provider_rate,
          rate_id: exchangeRate.id,
        },
      },
      trx,
    );
    // Create source fiat wallet transaction (debit)
    const sourceFiatWalletTransaction = await this.fiatWalletTransactionService.create(
      userId,
      {
        transaction_id: transaction.id,
        fiat_wallet_id: sourceWalletId,
        transaction_type: FiatWalletTransactionType.EXCHANGE,
        amount: -transactionAmount, // Negative for debit
        balance_before: sourceBalanceBefore,
        balance_after: sourceBalanceAfter, // Keep same as balance_before until webhook confirms
        currency: from,
        status: TransactionStatus.INITIATED,
        provider: this.defaultFiatWalletProvider,
        provider_reference: null, // Will be populated with withdrawal ID from /withdrawals/requests response
        description: `Exchange from ${SUPPORTED_CURRENCIES[from.toUpperCase()]?.walletName || from + ' Wallet'}`,
        source: `${from} Wallet`,
        destination: `${to} Wallet`,
        provider_metadata: {
          exchange_type: 'source',
          participant_code: participantCode,
          rate: exchangeRate.rate,
          provider_rate: exchangeRate.provider_rate,
          rate_id: exchangeRate.id,
          expected_amount: transactionAmount,
          rate_provider: exchangeRate.provider,
          exchange_rate_ref: exchangeRate.provider_rate_ref,
        },
      },
      trx,
    );

    return { sourceTransaction: transaction, sourceFiatWalletTransaction };
  }
}
