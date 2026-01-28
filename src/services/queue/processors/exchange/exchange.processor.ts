import { BadRequestException, Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DateTime } from 'luxon';
import { ExchangeAdapter } from '../../../../adapters/exchange/exchange.adapter';
import {
  BankStatus,
  ExchangeChannelRampType,
  ExchangeChannelStatus,
  ExchangeChannelType,
  ExchangeCreatePayOutRequestPayload,
  ExchangeCreatePayOutRequestPayloadSender,
  GetBanksResponse,
  GetExchangeChannelsResponse,
} from '../../../../adapters/exchange/exchange.interface';
import { FiatWalletAdapter } from '../../../../adapters/fiat-wallet/fiat-wallet.adapter';
import { FiatWalletWithdrawalRequestPayload } from '../../../../adapters/fiat-wallet/fiat-wallet.adapter.interface';
import { KYCAdapter } from '../../../../adapters/kyc/kyc-adapter';
import { IdentityDocType } from '../../../../adapters/kyc/kyc-adapter.interface';
import { EnvironmentService } from '../../../../config/environment/environment.service';
import { FiatWalletConfigProvider } from '../../../../config/fiat-wallet.config';
import { RateTransactionType } from '../../../../database';
import { FiatWalletTransactionModel } from '../../../../database/models/fiatWalletTransaction';
import { PlatformServiceKey } from '../../../../database/models/platformStatus/platformStatus.interface';
import { TransactionModel, TransactionStatus } from '../../../../database/models/transaction';
import { UserModel } from '../../../../database/models/user';
import { VirtualAccountModel, VirtualAccountType } from '../../../../database/models/virtualAccount';
import { UserRepository } from '../../../../modules/auth/user/user.repository';
import { FiatWalletTransactionRepository } from '../../../../modules/fiatWalletTransactions/fiatWalletTransactions.repository';
import { RateService } from '../../../../modules/rate/rate.service';
import { TransactionRepository } from '../../../../modules/transaction';
import { VirtualAccountRepository } from '../../../../modules/virtualAccount/virtualAccount.repository';
import { EventEmitterEventsEnum } from '../../../eventEmitter/eventEmitter.interface';
import { EventEmitterService } from '../../../eventEmitter/eventEmitter.service';
import { QueueService } from '../../queue.service';

export interface ExchangeJobData {
  userId: string;
  participantCode: string;
  sourceTransaction: TransactionModel;
  amount: number;
  destinationCountryCode: string;
  virtualAccount: VirtualAccountModel;
  sourceFiatWalletTransaction: FiatWalletTransactionModel;
  rateId: string;
}

@Injectable()
export class ExchangeProcessor {
  private readonly PAGA_BANK_CODE: string = '327';
  private readonly PAGA_BANK_REF: string = 'e5d96690-40d3-48f4-a745-b9e74566edc4';
  private readonly PAGA_BANK_NAME: string = 'Paga';

  private readonly PAGA_BANK_CODE_DEV: string = '221';
  private readonly PAGA_BANK_REF_DEV: string = '3d4d08c1-4811-4fee-9349-a302328e55c1';
  private readonly PAGA_BANK_NAME_DEV: string = 'Stanbic';

  private readonly logger = new Logger(ExchangeProcessor.name);
  private readonly queueName = 'exchange';
  private readonly MAX_CONCURRENT_EXCHANGES = 2;
  private readonly TEST_ACCOUNT_NUMBER = '1111111111';
  private processorsRegistered = false;

  @Inject(QueueService)
  private readonly queueService: QueueService;
  @Inject(FiatWalletAdapter)
  private readonly fiatWalletAdapter: FiatWalletAdapter;
  @Inject(ExchangeAdapter)
  private readonly exchangeAdapter: ExchangeAdapter;
  @Inject(TransactionRepository)
  private readonly transactionRepository: TransactionRepository;
  @Inject(FiatWalletTransactionRepository)
  private readonly fiatWalletTransactionRepository: FiatWalletTransactionRepository;
  @Inject(UserRepository)
  private readonly userRepository: UserRepository;
  @Inject(KYCAdapter)
  private readonly kycAdapter: KYCAdapter;

  @Inject(FiatWalletConfigProvider)
  private readonly fiatWalletConfig: FiatWalletConfigProvider;

  @Inject(EventEmitterService)
  private readonly eventEmitterService: EventEmitterService;

  @Inject(VirtualAccountRepository)
  private readonly virtualAccountRepository: VirtualAccountRepository;

  @Inject(RateService)
  private readonly rateService: RateService;

  private defaultFiatWalletProvider: string;
  private defaultUnderlyingCurrency: string;

  constructor() {
    if (!EnvironmentService.isProduction()) {
      this.PAGA_BANK_CODE = this.PAGA_BANK_CODE_DEV;
      this.PAGA_BANK_REF = this.PAGA_BANK_REF_DEV;
      this.PAGA_BANK_NAME = this.PAGA_BANK_NAME_DEV;
    }
  }

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
   * Validate exchange job data
   */
  private validateExchangeJobData(jobData: ExchangeJobData): void {
    if (!jobData) {
      throw new BadRequestException('Exchange job data is required');
    }
    if (!jobData.userId) {
      throw new BadRequestException('User ID is required');
    }
    if (!jobData.participantCode) {
      throw new BadRequestException('Participant code is required');
    }
    if (!jobData.sourceTransaction) {
      throw new BadRequestException('Source transaction is required');
    }
    if (!jobData.sourceTransaction.id) {
      throw new BadRequestException('Source transaction ID is required');
    }
    if (!jobData.sourceTransaction.reference) {
      throw new BadRequestException('Source transaction reference is required');
    }
    if (!jobData.amount || jobData.amount <= 0) {
      throw new BadRequestException('Valid amount greater than 0 is required');
    }
    if (!jobData.destinationCountryCode) {
      throw new BadRequestException('Destination country code is required');
    }
    if (!jobData.virtualAccount) {
      throw new BadRequestException('Virtual account is required');
    }
    if (!jobData.virtualAccount.account_number) {
      throw new BadRequestException('Virtual account number is required');
    }
    if (!jobData.virtualAccount.account_name) {
      throw new BadRequestException('Virtual account name is required');
    }
  }

  /**
   * Register queue processors (called when first job is queued)
   */
  private registerProcessors() {
    if (this.processorsRegistered) return;

    this.queueService.processJobs<ExchangeJobData>(
      this.queueName,
      'exchange',
      this.processExchange.bind(this),
      this.MAX_CONCURRENT_EXCHANGES,
    );

    this.processorsRegistered = true;
    this.logger.log('Exchange processors registered');
  }

  /**
   * Process the exchange operation in background
   */
  private async processExchange({ data: jobData }: { data: ExchangeJobData }): Promise<void> {
    // validate job data
    this.validateExchangeJobData(jobData);

    const {
      userId,
      participantCode,
      sourceTransaction,
      amount,
      destinationCountryCode,
      virtualAccount,
      sourceFiatWalletTransaction,
      rateId,
    } = jobData;

    try {
      // get withdrawal channels
      const channels = await this.exchangeAdapter.getChannels({ countryCode: destinationCountryCode });

      if (!channels || !Array.isArray(channels) || channels.length === 0) {
        throw new BadRequestException(`No channels found for ${destinationCountryCode}`);
      }

      const withdrawChannel = channels.find(
        (channel) =>
          channel.status === ExchangeChannelStatus.ACTIVE && channel.rampType === ExchangeChannelRampType.WITHDRAW,
      );

      if (!withdrawChannel) {
        throw new BadRequestException(`No active withdrawal channel found for ${destinationCountryCode}`);
      }

      // Get withdrawal banks for the channel
      const banks = await this.exchangeAdapter.getBanks({ countryCode: destinationCountryCode });

      console.log('YELLOWCARD_BANKS_LIST', JSON.stringify(banks, null, 2));

      if (!banks || !Array.isArray(banks) || banks.length === 0) {
        throw new BadRequestException(`No banks found for ${destinationCountryCode}`);
      }

      // Specifically select Paga bank for withdrawals (search by name, code, or ref)
      const pagaBank = banks.find(
        (bank) =>
          bank.status?.toLowerCase() === BankStatus.ACTIVE.toLowerCase() &&
          (bank.name?.toLowerCase().includes(this.PAGA_BANK_NAME.toLowerCase()) ||
            bank.code?.toLowerCase() === this.PAGA_BANK_CODE.toLowerCase() ||
            bank.ref?.toLowerCase() === this.PAGA_BANK_REF.toLowerCase()),
      );

      if (!pagaBank?.name?.toLowerCase().includes(this.PAGA_BANK_NAME.toLowerCase())) {
        throw new BadRequestException('Paga bank not found or inactive');
      }

      // Verify Paga supports the withdrawal channel
      if (!pagaBank.channelRefs?.includes(withdrawChannel.ref)) {
        throw new BadRequestException('Channel not found: Paga does not support the withdrawal channel');
      }

      const withdrawBank = pagaBank;

      this.logger.log(`Virtual account details: ${JSON.stringify(virtualAccount)}`);

      // validate the rate
      await this.rateService.validateRateOrThrow(rateId, amount, RateTransactionType.BUY);

      // Create YellowCard payout request to get wallet address and payment details
      const payOutResponse = await this.createYellowCardPayoutRequest(
        userId,
        this.getBankAccountAndName(virtualAccount),
        withdrawChannel,
        withdrawBank,
        sourceTransaction.reference,
        destinationCountryCode,
        amount, // amount in USD, this is the amount that will be withdrawn from the source wallet in USD main unit
      );

      if (!payOutResponse) {
        this.logger.error('Failed to create YellowCard payout request');
        this.eventEmitterService.emit(EventEmitterEventsEnum.SERVICE_STATUS_FAILURE, {
          serviceKey: PlatformServiceKey.CURRENCY_EXCHANGE,
          reason: 'Failed to create YellowCard payout request',
        });

        throw new BadRequestException('Failed to create YellowCard payout request');
      }

      // Extract wallet address from the response
      const yellowCardWalletAddress = payOutResponse.cryptoInfo?.walletAddress;

      if (!yellowCardWalletAddress) {
        this.logger.error('YellowCard wallet address not found in payout response');
        this.eventEmitterService.emit(EventEmitterEventsEnum.SERVICE_STATUS_FAILURE, {
          serviceKey: PlatformServiceKey.CURRENCY_EXCHANGE,
          reason: 'YellowCard wallet address not found in payout response',
        });

        throw new BadRequestException('YellowCard wallet address not found in payout response');
      }

      this.logger.log(`YellowCard wallet address: ${yellowCardWalletAddress}`);

      // Get withdrawal quote to fetch fees using YellowCard wallet address
      const withdrawalRequestPayload: FiatWalletWithdrawalRequestPayload = {
        transactionRef: sourceTransaction.reference,
        withdrawalAddress: yellowCardWalletAddress,
        providerUserRef: participantCode,
        amount: amount.toString(),
        asset: this.defaultUnderlyingCurrency,
      };

      /**
       * This submits the withdrawal request to the fiat wallet provider (ZH)
       */
      const withdrawalRequest = await this.fiatWalletAdapter.createWithdrawalRequest(
        withdrawalRequestPayload,
        this.defaultFiatWalletProvider,
      );

      // Update source transaction with external reference if available

      await this.transactionRepository.update(sourceTransaction.id, {
        status: TransactionStatus.PROCESSING,
        external_reference: withdrawalRequest.providerRef,
        reference: payOutResponse.sequenceRef,
        metadata: {
          ...sourceTransaction.metadata,
          destination_provider_ref: payOutResponse.ref,
          destination_provider_request_ref: withdrawalRequest.providerRef, // this is the ID shared between
          //YellowCard and Zerohash
          source_withdrawal_request_ref: withdrawalRequest.clientWithdrawalRequestRef,
          destination_wallet_address: yellowCardWalletAddress,
          shared_blockchain_transaction_ref: withdrawalRequest.blockchainTransactionRef,
        },
      });

      await this.fiatWalletTransactionRepository.update(sourceFiatWalletTransaction.id, {
        status: TransactionStatus.PROCESSING,
        provider_request_ref: withdrawalRequest.providerRef,
      });

      this.eventEmitterService.emit(EventEmitterEventsEnum.SERVICE_STATUS_SUCCESS, {
        serviceKey: PlatformServiceKey.CURRENCY_EXCHANGE,
      });

      // Update source fiat wallet transaction with external reference if available
    } catch (error) {
      this.logger.error(`Exchange failed: ${error.message}`, error.stack);

      this.eventEmitterService.emit(EventEmitterEventsEnum.SERVICE_STATUS_FAILURE, {
        serviceKey: PlatformServiceKey.CURRENCY_EXCHANGE,
        reason: error.message,
      });

      const { failureReason, userFriendlyMessage } = this.parseExchangeError(error);

      // Update source transaction status
      await this.transactionRepository.update(sourceTransaction.id, {
        status: TransactionStatus.FAILED,
        failure_reason: failureReason,
      });

      await this.fiatWalletTransactionRepository.update(sourceFiatWalletTransaction.id, {
        status: TransactionStatus.FAILED,
      });

      // Schedule deletion of exchange virtual account on failure (7 days from now)
      if (virtualAccount?.type === VirtualAccountType.EXCHANGE_ACCOUNT && virtualAccount?.id) {
        const DELETION_DELAY_DAYS = 7;
        const scheduledDeletionAt = DateTime.now().plus({ days: DELETION_DELAY_DAYS }).toJSDate();

        await this.virtualAccountRepository.update(virtualAccount.id, {
          scheduled_deletion_at: scheduledDeletionAt,
        });

        this.logger.log(
          `Scheduled deletion of exchange virtual account ${virtualAccount.account_number} for ${scheduledDeletionAt.toISOString()}. Reason: ${failureReason}`,
        );
      }

      // For permanent failures (like Paga being unavailable), don't retry - just return
      // This prevents BullMQ from retrying jobs that will never succeed
      if (this.isPermanentFailure(error.message)) {
        this.logger.warn(`Permanent failure detected, not retrying: ${error.message}`);
        return;
      }

      // For transient failures, throw to allow BullMQ retry
      throw new BadRequestException(userFriendlyMessage);
    }
  }

  /**
   * Parse exchange error and extract failure reason and user-friendly message
   */
  private parseExchangeError(error: any): { failureReason: string; userFriendlyMessage: string } {
    let failureReason = 'Withdrawal request failed';
    let userFriendlyMessage = 'Exchange failed to initiate';

    if (error.response?.data?.errors) {
      const errors = error.response.data.errors;
      if (Array.isArray(errors) && errors.length > 0) {
        const errorMessage = errors[0];
        failureReason = errorMessage;
        userFriendlyMessage = errorMessage;
      }
    } else if (error.message) {
      failureReason = error.message;
      userFriendlyMessage = error.message;
    }

    // Handle insufficient balance separately
    if (failureReason.toLowerCase().includes('insufficient balance')) {
      failureReason = `Insufficient balance: ${failureReason}`;
      userFriendlyMessage = `Insufficient balance: ${failureReason}`;
    }

    return { failureReason, userFriendlyMessage };
  }

  /**
   * Check if the error is a permanent failure that should not be retried.
   * Permanent failures are business logic errors that won't resolve on retry.
   */
  private isPermanentFailure(errorMessage: string): boolean {
    const lowerMessage = errorMessage.toLowerCase();

    const permanentFailurePatterns = [
      'paga bank not found',
      'paga does not support',
      'no channels found',
      'no active withdrawal channel found',
      'no banks found',
      'channel not found',
      'user not found',
      'user country information is required',
      'user profile is required',
      'user kyc',
      'bvn information is required',
      'invalid underlying currency format',
    ];

    return permanentFailurePatterns.some((pattern) => lowerMessage.includes(pattern));
  }

  private async validateUserDetailsForExchange(userId: string) {
    const userWithDetails = await this.userRepository.findOne(
      { id: userId },
      {},
      { graphFetch: '[userProfile,country]' },
    );

    if (!userWithDetails) {
      throw new BadRequestException('User not found');
    }
    if (!userWithDetails.country) {
      throw new BadRequestException('User country information is required for exchange operations');
    }
    if (!userWithDetails.country.code) {
      throw new BadRequestException('User country code is required for exchange operations');
    }
    if (!userWithDetails.userProfile) {
      throw new BadRequestException('User profile is required for exchange operations');
    }
    if (!userWithDetails.userProfile.address_line1) {
      throw new BadRequestException('User address information is required for exchange operations');
    }
    if (!userWithDetails.userProfile.dob) {
      throw new BadRequestException('User date of birth information is required for exchange operations');
    }
    if (!userWithDetails.first_name) {
      throw new BadRequestException('User first name is required for exchange operations');
    }
    if (!userWithDetails.last_name) {
      throw new BadRequestException('User last name is required for exchange operations');
    }
    if (!userWithDetails.email) {
      throw new BadRequestException('User email is required for exchange operations');
    }
    if (!userWithDetails.phone_number) {
      throw new BadRequestException('User phone number is required for exchange operations');
    }

    return userWithDetails;
  }

  private async validateKycDetailsForExchange(userWithDetails: UserModel) {
    const kycDetails = await this.kycAdapter.getKycDetailsByUserId(userWithDetails.id);

    if (!kycDetails?.data) {
      throw new BadRequestException('User KYC details are required for exchange operations');
    }

    if (!kycDetails.data.idDocument?.number) {
      throw new BadRequestException('User KYC ID document number is required for exchange operations');
    }
    if (!kycDetails.data.idDocument?.type) {
      throw new BadRequestException('User KYC ID document type is required for exchange operations');
    }

    if (userWithDetails.country?.code === 'NG' && !kycDetails.data.idNumber) {
      throw new BadRequestException('BVN information is required for Nigerian users');
    }

    return kycDetails;
  }

  private async createYellowCardPayoutRequest(
    userId: string,
    bankAccountAndName: { accountNumber: string; accountName: string },
    withdrawChannel: GetExchangeChannelsResponse,
    withdrawBank: GetBanksResponse,
    transactionRef: string,
    destinationCountryCode: string,
    amount: number, // amount in USD, this is the amount that will be withdrawn from the source wallet in USD main unit
  ) {
    const userWithDetails = await this.validateUserDetailsForExchange(userId);

    const kycDetails = await this.validateKycDetailsForExchange(userWithDetails);
    const formatDob = (dob: string) => {
      return DateTime.fromJSDate(new Date(dob)).toFormat('MM/dd/yyyy');
    };

    // Build the payload using available data and KYC details
    this.logger.log(
      `Building payload with destinationCountryCode: ${destinationCountryCode}, channel: ${withdrawChannel.ref}, bank: ${withdrawBank.ref}`,
    );

    // Parse currency and network from DEFAULT_UNDERLYING_CURRENCY (e.g., "USDC.ETH")
    const currencyParts = this.defaultUnderlyingCurrency.split('.');

    if (currencyParts.length !== 2) {
      throw new InternalServerErrorException(
        `Invalid underlying currency format: ${this.defaultUnderlyingCurrency}. Expected format: CURRENCY.NETWORK`,
      );
    }

    const [cryptoCurrency, rawCryptoNetwork] = currencyParts;

    // Map network for YellowCard compatibility
    const cryptoNetwork = rawCryptoNetwork === 'ETH' ? 'ERC20' : rawCryptoNetwork;

    // Build sender object with conditional BVN for Nigerian users
    const senderInfo: ExchangeCreatePayOutRequestPayloadSender = {
      fullName: `${userWithDetails.first_name} ${userWithDetails.last_name}`,
      email: userWithDetails.email,
      phoneNumber: userWithDetails.phone_number,
      countryCode: userWithDetails.country.code,
      address: userWithDetails.userProfile.address_line1,
      idType: kycDetails.data.idDocument.type?.toUpperCase() as IdentityDocType,
      idNumber: kycDetails.data.idDocument.number,
      dob: formatDob(userWithDetails.userProfile.dob.toString()),
    };

    // Add BVN information only for Nigerian senders
    if (userWithDetails.country.code === 'NG') {
      senderInfo.additionalIdNumber = kycDetails.data.idNumber;
      senderInfo.additionalIdType = IdentityDocType.BVN;
    }

    const payOutRequestPayload: ExchangeCreatePayOutRequestPayload = {
      cryptoInfo: {
        cryptoAmount: amount,
        cryptoCurrency: cryptoCurrency,
        cryptoNetwork: cryptoNetwork,
      },
      channelRef: withdrawChannel.ref,
      transactionRef,
      narration: 'other',
      sender: senderInfo,
      destination: {
        accountNumber: bankAccountAndName.accountNumber,
        accountName: bankAccountAndName.accountName,
        bankRef: withdrawBank.ref,
        transferType: ExchangeChannelType.BANK,
      },
      userId: userWithDetails.id,
    };

    this.logger.log(`Payload created successfully: ${JSON.stringify(payOutRequestPayload)}`);

    // Create YellowCard payout request to get wallet address
    const payOutResponse = await this.exchangeAdapter.createPayOutRequest(payOutRequestPayload);
    this.logger.log(`YellowCard payout request created: ${JSON.stringify(payOutResponse)}`);

    console.log('Payout response from createYellowCardPayoutRequest', payOutResponse);
    return payOutResponse;
  }

  private getBankAccountAndName(virtualAccount: VirtualAccountModel): { accountNumber: string; accountName: string } {
    if (EnvironmentService.isProduction()) {
      return {
        accountNumber: virtualAccount.account_number,
        accountName: virtualAccount.account_name,
      };
    }

    return {
      accountNumber: this.TEST_ACCOUNT_NUMBER,
      accountName: virtualAccount.account_name,
    };
  }

  /**
   * Queue an exchange job
   */
  async queueExchange(data: ExchangeJobData): Promise<Job<ExchangeJobData>> {
    // Register processors on first use (when Redis is ready)
    this.registerProcessors();

    return this.queueService.addJob(this.queueName, 'exchange', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }
}
