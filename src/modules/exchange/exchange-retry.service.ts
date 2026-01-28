import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { add, divide, floor, multiply, subtract } from 'mathjs';
import { ExchangeAdapter } from '../../adapters/exchange/exchange.adapter';
import {
  BankStatus,
  ExchangeChannelRampType,
  ExchangeChannelStatus,
  ExchangeChannelType,
  ExchangeCreatePayOutRequestPayload,
  ExchangeCreatePayOutRequestPayloadSender,
  GetBanksResponse,
  GetExchangeChannelsResponse,
} from '../../adapters/exchange/exchange.interface';
import { KYCAdapter } from '../../adapters/kyc/kyc-adapter';
import { IdentityDocType } from '../../adapters/kyc/kyc-adapter.interface';
import { EnvironmentService } from '../../config/environment/environment.service';
import { FiatWalletConfig, FiatWalletConfigProvider } from '../../config/fiat-wallet.config';
import { CurrencyUtility, SUPPORTED_CURRENCIES } from '../../currencies/currencies';
import {
  TransactionCategory,
  TransactionModel,
  TransactionScope,
  TransactionStatus,
  TransactionType,
} from '../../database';
import { FiatWalletTransactionType } from '../../database/models/fiatWalletTransaction/fiatWalletTransaction.interface';
import { UserModel } from '../../database/models/user';
import { VirtualAccountModel, VirtualAccountType } from '../../database/models/virtualAccount';
import { UtilsService } from '../../utils/utils.service';
import { UserRepository } from '../auth/user/user.repository';
import { FiatWalletService } from '../fiatWallet/fiatWallet.service';
import { FiatWalletTransactionRepository } from '../fiatWalletTransactions/fiatWalletTransactions.repository';
import { FiatWalletTransactionService } from '../fiatWalletTransactions/fiatWalletTransactions.service';
import { RateRepository } from '../rate/rate.repository';
import { RateConfigRepository } from '../rateConfig/rateConfig.repository';
import { TransactionRepository } from '../transaction/transaction.repository';
import { TransactionService } from '../transaction/transaction.service';
import { VirtualAccountService } from '../virtualAccount/virtualAccount.service';
import { RetryExchangeResponseDto } from './dto/retryExchange.dto';

@Injectable()
export class ExchangeRetryService {
  private readonly logger = new Logger(ExchangeRetryService.name);

  // Paga bank identifiers by environment
  private readonly PAGA_BANK_CONFIG = {
    production: { code: '327', ref: 'e5d96690-40d3-48f4-a745-b9e74566edc4', name: 'Paga' },
    development: { code: '221', ref: '3d4d08c1-4811-4fee-9349-a302328e55c1', name: 'Stanbic' },
  };

  private readonly TEST_ACCOUNT_NUMBER = '1111111111';

  /**
   * Get Paga bank configuration based on environment
   */
  private get pagaBankConfig(): { code: string; ref: string; name: string } {
    return EnvironmentService.isProduction() ? this.PAGA_BANK_CONFIG.production : this.PAGA_BANK_CONFIG.development;
  }

  private fiatWalletConfig: FiatWalletConfig;

  @Inject(TransactionRepository)
  private readonly transactionRepository: TransactionRepository;

  @Inject(TransactionService)
  private readonly transactionService: TransactionService;

  @Inject(FiatWalletTransactionRepository)
  private readonly fiatWalletTransactionRepository: FiatWalletTransactionRepository;

  @Inject(FiatWalletTransactionService)
  private readonly fiatWalletTransactionService: FiatWalletTransactionService;

  @Inject(VirtualAccountService)
  private readonly virtualAccountService: VirtualAccountService;

  @Inject(ExchangeAdapter)
  private readonly exchangeAdapter: ExchangeAdapter;

  @Inject(UserRepository)
  private readonly userRepository: UserRepository;

  @Inject(KYCAdapter)
  private readonly kycAdapter: KYCAdapter;

  @Inject(FiatWalletConfigProvider)
  private readonly fiatWalletConfigProvider: FiatWalletConfigProvider;

  @Inject(RateRepository)
  private readonly rateRepository: RateRepository;

  @Inject(RateConfigRepository)
  private readonly rateConfigRepository: RateConfigRepository;

  @Inject(FiatWalletService)
  private readonly fiatWalletService: FiatWalletService;

  async onModuleInit() {
    this.fiatWalletConfig = this.fiatWalletConfigProvider.getConfig();
  }

  /**
   * Retry a failed USD to NGN exchange transaction.
   * Creates a new virtual account and re-submits the payout request to YellowCard only.
   * The USD has already been sent to YellowCard - we just need them to send NGN to a new account.
   */
  async retryExchange(parentTransactionId: string): Promise<RetryExchangeResponseDto> {
    this.logger.log(`Starting exchange retry for parent transaction: ${parentTransactionId}`);

    // Step 1: Validate and get the parent USD transaction
    const parentTransaction = await this.validateAndGetParentTransaction(parentTransactionId);

    // Step 2: Create a NEW virtual account for this retry
    const newVirtualAccount = await this.createNewVirtualAccountForRetry(parentTransaction);

    // Step 3: Get destination country code
    const destinationCountryCode =
      parentTransaction.metadata?.destination_country_code || SUPPORTED_CURRENCIES.NGN.countryCode;

    // Step 4: Get YellowCard channels and banks
    const { withdrawChannel, withdrawBank } = await this.getYellowCardChannelAndBank(destinationCountryCode);

    // Step 5: Get the USD amount in main unit from the parent transaction
    const usdAmountInMainUnit = Number(parentTransaction.amount) / 100; // Convert from cents to dollars

    // Step 6: Generate new transaction reference for YellowCard
    const newTransactionRef = UtilsService.generateTransactionReference();

    // Step 7: Create YellowCard payout request with new virtual account
    // Note: We only re-submit to YellowCard. The USD was already sent from ZeroHash in the original transaction.
    const payOutResponse = await this.createYellowCardPayoutRequest(
      parentTransaction.user_id,
      this.getBankAccountAndName(newVirtualAccount),
      withdrawChannel,
      withdrawBank,
      newTransactionRef,
      destinationCountryCode,
      usdAmountInMainUnit,
    );

    if (!payOutResponse) {
      throw new BadRequestException('Failed to create YellowCard payout request');
    }

    this.logger.log(`YellowCard payout request created with sequence ref: ${payOutResponse.sequenceRef}`);

    // Step 8: Handle the NGN child transaction - update to RECONCILE if FAILED, or create if not exists
    await this.handleNgnChildTransaction(parentTransaction, payOutResponse.sequenceRef);

    // Step 9: Update parent transaction metadata with new YellowCard references (no status change)
    await this.transactionRepository.update(parentTransaction.id, {
      reference: payOutResponse.sequenceRef,
      metadata: {
        ...parentTransaction.metadata,
        retry_count: (parentTransaction.metadata?.retry_count || 0) + 1,
        retry_at: DateTime.now().toISO(),
        retry_yellowcard_ref: payOutResponse.ref,
        retry_yellowcard_sequence_ref: payOutResponse.sequenceRef,
        retry_new_virtual_account_id: newVirtualAccount.id,
        retry_new_virtual_account_number: newVirtualAccount.account_number,
        retry_destination_wallet_address: payOutResponse.cryptoInfo?.walletAddress,
        destination_provider_ref: payOutResponse.ref,
        previous_provider_refs: [...(parentTransaction.metadata?.previous_provider_refs || []), payOutResponse.ref],
        destination_provider_request_ref: payOutResponse.providerRef,
      },
    });

    this.logger.log(
      `Exchange retry successful for parent transaction ${parentTransactionId}. New YellowCard sequence ref: ${payOutResponse.sequenceRef}`,
    );

    return {
      message: 'Exchange retry initiated successfully',
      parent_transaction_id: parentTransactionId,
      new_account_number: newVirtualAccount.account_number,
      new_sequence_ref: payOutResponse.sequenceRef,
    };
  }

  /**
   * Validate the parent transaction and return it if valid
   */
  private async validateAndGetParentTransaction(parentTransactionId: string): Promise<TransactionModel> {
    const parentTransaction = await this.transactionRepository.findById(parentTransactionId);

    if (!parentTransaction) {
      throw new NotFoundException(`Parent transaction with ID ${parentTransactionId} not found`);
    }

    if (parentTransaction.transaction_type !== TransactionType.EXCHANGE) {
      throw new BadRequestException(
        `Transaction ${parentTransactionId} is not an exchange transaction. Type: ${parentTransaction.transaction_type}`,
      );
    }

    if (parentTransaction.asset?.toUpperCase() !== SUPPORTED_CURRENCIES.USD.code) {
      throw new BadRequestException(
        `Transaction ${parentTransactionId} is not a USD transaction. Asset: ${parentTransaction.asset}`,
      );
    }

    return parentTransaction as TransactionModel;
  }

  /**
   * Handle the NGN child transaction - update to RECONCILE if FAILED, or create if not exists
   */
  private async handleNgnChildTransaction(parentTransaction: TransactionModel, sequenceRef: string): Promise<void> {
    // Find existing NGN child transaction
    const ngnChildTransaction = await this.transactionRepository.findOne({
      parent_transaction_id: parentTransaction.id,
      asset: SUPPORTED_CURRENCIES.NGN.code,
    });

    if (!ngnChildTransaction) {
      this.logger.log(`No existing NGN child transaction found for parent ${parentTransaction.id}. Creating new one.`);
      await this.createIncomingNgnTransaction(parentTransaction, sequenceRef);
      return;
    }

    const currentStatus = ngnChildTransaction.status?.toLowerCase();

    // If the child transaction is FAILED, update to RECONCILE
    if (currentStatus === TransactionStatus.FAILED.toLowerCase()) {
      this.logger.log(`Updating NGN child transaction ${ngnChildTransaction.id} from FAILED to RECONCILE`);

      await this.transactionRepository.update(ngnChildTransaction.id, {
        status: TransactionStatus.RECONCILE,
        metadata: {
          ...ngnChildTransaction.metadata,
          retry_initiated_at: DateTime.now().toISO(),
          previous_status: ngnChildTransaction.status,
        },
      });

      // Also update the fiat wallet transaction if exists
      const fiatWalletTransaction = await this.fiatWalletTransactionRepository.findOne({
        transaction_id: ngnChildTransaction.id,
      });

      if (fiatWalletTransaction) {
        await this.fiatWalletTransactionRepository.update(fiatWalletTransaction.id, {
          status: TransactionStatus.RECONCILE,
          provider_metadata: {
            ...fiatWalletTransaction.provider_metadata,
            retry_initiated_at: DateTime.now().toISO(),
            previous_status: fiatWalletTransaction.status,
          },
        });
      }

      return;
    }

    // If the child transaction is in a non-failed state, log and proceed
    if (
      currentStatus === TransactionStatus.COMPLETED.toLowerCase() ||
      currentStatus === TransactionStatus.PROCESSING.toLowerCase() ||
      currentStatus === TransactionStatus.PENDING.toLowerCase()
    ) {
      this.logger.warn(
        `NGN child transaction ${ngnChildTransaction.id} is in ${currentStatus} status. Proceeding with retry anyway as requested.`,
      );
    }
  }

  /**
   * Creates the incoming NGN transaction when retrying USD to NGN exchange.
   * Follows the pattern from zerohash-webhook.service.ts createIncomingNgnTransaction
   */
  private async createIncomingNgnTransaction(
    parentTransaction: TransactionModel,
    sequenceRef: string,
  ): Promise<TransactionModel | null> {
    try {
      this.logger.log('Creating incoming NGN transaction for retry', {
        sequenceRef,
        parentTransactionId: parentTransaction.id,
      });

      if (!parentTransaction.metadata?.rate_id) {
        this.logger.warn('Exchange rate not found in parent transaction metadata');
        return null;
      }

      const exchangeRate = await this.rateRepository.findOne({
        id: parentTransaction.metadata.rate_id,
      });

      if (!exchangeRate) {
        this.logger.warn('Exchange rate not found');
        return null;
      }

      const usdAmountInMainUnit = CurrencyUtility.formatCurrencyAmountToMainUnit(
        parentTransaction.amount,
        SUPPORTED_CURRENCIES.USD.code,
      );

      const providerName = this.exchangeAdapter.getProviderName();

      const rateConfig = await this.rateConfigRepository.findOne({
        provider: providerName,
      });

      if (rateConfig && !rateConfig.isActive) {
        this.logger.warn(
          `[ExchangeRetryService] STEP 3 FAILED - Rate config is inactive for provider: ${providerName}`,
        );
        return;
      }

      if (!rateConfig) {
        this.logger.warn('Rate config not found');
        return null;
      }

      const grossNgnAmount = multiply(exchangeRate.rate, usdAmountInMainUnit);

      // Calculate fees in USD first, then convert to NGN
      const partnerFee = this.calculateFeeInNgn(
        usdAmountInMainUnit,
        rateConfig.fiatExchange.partner_fee?.value || 0,
        rateConfig.fiatExchange.partner_fee?.is_percentage,
        exchangeRate.rate,
      );
      const disbursementFee = this.calculateFeeInNgn(
        usdAmountInMainUnit,
        rateConfig.fiatExchange.disbursement_fee?.value || 0,
        rateConfig.fiatExchange.disbursement_fee?.is_percentage,
        exchangeRate.rate,
      );

      // Calculate the ngn amount (floor to avoid fractional kobo)
      const koboAmount = floor(Number(subtract(grossNgnAmount, add(disbursementFee, partnerFee))));

      const fiatWallet = await this.fiatWalletService.getUserWallet(
        parentTransaction.user_id,
        SUPPORTED_CURRENCIES.NGN.code,
      );

      const balanceBefore = Number(fiatWallet.balance);
      const balanceAfter = add(balanceBefore, koboAmount);

      const childTransaction = await this.transactionRepository.transaction(async (trx) => {
        // Create new transaction
        const transaction = await this.transactionService.create(
          parentTransaction.user_id,
          {
            transaction_type: TransactionType.EXCHANGE,
            category: TransactionCategory.FIAT,
            transaction_scope: TransactionScope.INTERNAL,
            status: TransactionStatus.INITIATED,
            amount: koboAmount,
            asset: SUPPORTED_CURRENCIES.NGN.code,
            balance_before: balanceBefore,
            balance_after: balanceAfter,
            reference: UtilsService.generateTransactionReference(),
            metadata: {
              rate: exchangeRate.rate,
              rate_id: exchangeRate.id,
              shared_blockchain_transaction_ref: parentTransaction.metadata?.shared_blockchain_transaction_ref,
              created_by_provider: 'exchange_retry',
            },
            parent_transaction_id: parentTransaction.id,
            description: `Exchanged USD to NGN`,
            external_reference: sequenceRef,
          },
          trx,
        );

        await this.fiatWalletTransactionService.create(
          parentTransaction.user_id,
          {
            transaction_id: transaction.id,
            amount: koboAmount,
            currency: SUPPORTED_CURRENCIES.NGN.code,
            status: TransactionStatus.PROCESSING,
            fiat_wallet_id: fiatWallet.id,
            transaction_type: FiatWalletTransactionType.EXCHANGE,
            provider_reference: sequenceRef,
            balance_before: balanceBefore,
            balance_after: balanceAfter,
            provider_metadata: {
              source_currency: SUPPORTED_CURRENCIES.USD.code,
            },
            source: `USD Wallet`,
            destination: `NGN Wallet`,
            description: `OnRamp USD to NGN (Retry)`,
            provider: this.exchangeAdapter.getProviderName(),
          },
          trx,
        );

        return transaction;
      });

      this.logger.log('Created incoming NGN transaction for retry', { transactionId: childTransaction.id });

      return childTransaction;
    } catch (error) {
      this.logger.error('Error creating incoming NGN transaction for retry', error);
      return null;
    }
  }

  /**
   * Create a new virtual account for the retry.
   * We generate a unique transaction_id suffix to ensure a new account is created.
   */
  private async createNewVirtualAccountForRetry(parentTransaction: TransactionModel): Promise<VirtualAccountModel> {
    this.logger.log(`Creating new virtual account for retry with transaction_id: ${parentTransaction.id}`);

    const newVirtualAccount = await this.virtualAccountService.create(
      parentTransaction.user_id,
      { transaction_id: parentTransaction.id },
      VirtualAccountType.EXCHANGE_ACCOUNT,
    );

    this.logger.log(
      `Created new virtual account: ${newVirtualAccount.account_number} for user ${parentTransaction.user_id}`,
    );

    return newVirtualAccount;
  }

  /**
   * Get YellowCard withdrawal channel and bank for the destination country
   */
  private async getYellowCardChannelAndBank(destinationCountryCode: string): Promise<{
    withdrawChannel: GetExchangeChannelsResponse;
    withdrawBank: GetBanksResponse;
  }> {
    // Get withdrawal channels
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

    // Get banks
    const banks = await this.exchangeAdapter.getBanks({ countryCode: destinationCountryCode });

    if (!banks || !Array.isArray(banks) || banks.length === 0) {
      throw new BadRequestException(`No banks found for ${destinationCountryCode}`);
    }

    // Find Paga bank using consolidated config
    const { code: bankCode, ref: bankRef, name: bankName } = this.pagaBankConfig;
    const pagaBank = banks.find(
      (bank) =>
        bank.status?.toLowerCase() === BankStatus.ACTIVE.toLowerCase() &&
        (bank.name?.toLowerCase().includes(bankName.toLowerCase()) ||
          bank.code?.toLowerCase() === bankCode.toLowerCase() ||
          bank.ref?.toLowerCase() === bankRef.toLowerCase()),
    );

    if (!pagaBank?.name?.toLowerCase().includes(bankName.toLowerCase())) {
      throw new BadRequestException('Paga bank not found or inactive');
    }

    // Verify Paga supports the withdrawal channel
    if (!pagaBank.channelRefs?.includes(withdrawChannel.ref)) {
      throw new BadRequestException('Channel not found: Paga does not support the withdrawal channel');
    }

    return { withdrawChannel, withdrawBank: pagaBank };
  }

  /**
   * Helper to validate required fields and throw BadRequestException if missing
   */
  private validateRequiredField(value: unknown, fieldName: string): void {
    if (!value) {
      throw new BadRequestException(`${fieldName} is required for exchange operations`);
    }
  }

  /**
   * Calculate fee in NGN from USD amount
   * Handles both percentage and fixed fee calculations
   */
  private calculateFeeInNgn(usdAmount: number, feeValue: number, isPercentage: boolean, exchangeRate: number): number {
    const feeInUsd = isPercentage ? multiply(usdAmount, divide(feeValue, 100)) : feeValue;
    return multiply(feeInUsd, exchangeRate);
  }

  /**
   * Validate user details required for exchange
   */
  private async validateUserDetailsForExchange(userId: string): Promise<UserModel> {
    const userWithDetails = await this.userRepository.findOne(
      { id: userId },
      {},
      { graphFetch: '[userProfile,country]' },
    );

    if (!userWithDetails) {
      throw new BadRequestException('User not found');
    }

    // Validate all required fields
    const requiredFields: [unknown, string][] = [
      [userWithDetails.country, 'User country information'],
      [userWithDetails.country?.code, 'User country code'],
      [userWithDetails.userProfile, 'User profile'],
      [userWithDetails.userProfile?.address_line1, 'User address information'],
      [userWithDetails.userProfile?.dob, 'User date of birth information'],
      [userWithDetails.first_name, 'User first name'],
      [userWithDetails.last_name, 'User last name'],
      [userWithDetails.email, 'User email'],
      [userWithDetails.phone_number, 'User phone number'],
    ];

    for (const [value, fieldName] of requiredFields) {
      this.validateRequiredField(value, fieldName);
    }

    return userWithDetails;
  }

  /**
   * Validate KYC details required for exchange
   */
  private async validateKycDetailsForExchange(userWithDetails: UserModel) {
    const kycDetails = await this.kycAdapter.getKycDetailsByUserId(userWithDetails.id);

    // Validate KYC required fields
    const requiredFields: [unknown, string][] = [
      [kycDetails?.data, 'User KYC details'],
      [kycDetails?.data?.idDocument?.number, 'User KYC ID document number'],
      [kycDetails?.data?.idDocument?.type, 'User KYC ID document type'],
    ];

    for (const [value, fieldName] of requiredFields) {
      this.validateRequiredField(value, fieldName);
    }

    // BVN is required for Nigerian users
    if (userWithDetails.country?.code === 'NG' && !kycDetails.data.idNumber) {
      throw new BadRequestException('BVN information is required for Nigerian users');
    }

    return kycDetails;
  }

  /**
   * Create YellowCard payout request
   */
  private async createYellowCardPayoutRequest(
    userId: string,
    bankAccountAndName: { accountNumber: string; accountName: string },
    withdrawChannel: GetExchangeChannelsResponse,
    withdrawBank: GetBanksResponse,
    transactionRef: string,
    destinationCountryCode: string,
    amount: number,
  ) {
    const userWithDetails = await this.validateUserDetailsForExchange(userId);
    const kycDetails = await this.validateKycDetailsForExchange(userWithDetails);

    const formatDob = (dob: string) => {
      return DateTime.fromJSDate(new Date(dob)).toFormat('MM/dd/yyyy');
    };

    this.logger.log(
      `Building retry payload with destinationCountryCode: ${destinationCountryCode}, channel: ${withdrawChannel.ref}, bank: ${withdrawBank.ref}`,
    );

    // Parse currency and network from DEFAULT_UNDERLYING_CURRENCY (e.g., "USDC.ETH")
    const currencyParts = this.fiatWalletConfig.default_underlying_currency.split('.');

    if (currencyParts.length !== 2) {
      throw new BadRequestException(
        `Invalid underlying currency format: ${this.fiatWalletConfig.default_underlying_currency}. Expected format: CURRENCY.NETWORK`,
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

    this.logger.log(`Retry payload created successfully: ${JSON.stringify(payOutRequestPayload)}`);

    const payOutResponse = await this.exchangeAdapter.createPayOutRequest(payOutRequestPayload);
    this.logger.log(`YellowCard retry payout request created: ${JSON.stringify(payOutResponse)}`);

    return payOutResponse;
  }

  /**
   * Get bank account details from virtual account, using test account in non-production
   */
  private getBankAccountAndName(virtualAccount: VirtualAccountModel): { accountNumber: string; accountName: string } {
    const accountNumber = EnvironmentService.isProduction() ? virtualAccount.account_number : this.TEST_ACCOUNT_NUMBER;

    return {
      accountNumber,
      accountName: virtualAccount.account_name,
    };
  }
}
