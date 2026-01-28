import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { add, divide, multiply, subtract } from 'mathjs';
import { Transaction } from 'objection';
import { ExchangeAdapter } from '../../../../adapters/exchange/exchange.adapter';
import {
  ExchangeChannelType,
  ExchangeCreatePayInRequestPayload,
} from '../../../../adapters/exchange/exchange.interface';
import { KYCAdapter } from '../../../../adapters/kyc/kyc-adapter';
import { GetKycDetailsResponse, IdentityDocType } from '../../../../adapters/kyc/kyc-adapter.interface';
import { WaasAdapter } from '../../../../adapters/waas/waas.adapter';
import { EnvironmentService } from '../../../../config';
import {
  EXCHANGE_EXPIRATION_TIME_IN_MINUTES,
  YELLOWCARD_COLLECTION_SUCCESS_CRYPTO_CURRENCY,
  YELLOWCARD_COLLECTION_SUCCESS_CRYPTO_NETWORK,
  YELLOWCARD_COLLECTION_SUCCESS_WALLET_ADDRESS,
} from '../../../../constants/constants';
import { CurrencyUtility, SUPPORTED_CURRENCIES } from '../../../../currencies';
import {
  FiatWalletModel,
  FiatWalletTransactionModel,
  FiatWalletTransactionType,
  RateTransactionType,
  TransactionCategory,
  TransactionModel,
  TransactionScope,
  TransactionStatus,
  TransactionType,
  UserModel,
} from '../../../../database';
import { ExchangeRateModel } from '../../../../database/models/exchangeRate';
import { VirtualAccountType } from '../../../../database/models/virtualAccount';
import { LockerService } from '../../../../services/locker/locker.service';
import {
  ExecuteNgToUSDExchangeJobData,
  ExecuteNgUsdExchangeProcessor,
} from '../../../../services/queue/processors/exchange/execute-ng-usd-exchange.processor';
import { UtilsService } from '../../../../utils/utils.service';
import { UserRepository } from '../../../auth/user/user.repository';
import { DepositAddressService } from '../../../depositAddress/depositAddress.service';
import { FiatWalletService } from '../../../fiatWallet';
import { FiatWalletEscrowService } from '../../../fiatWallet/fiatWalletEscrow.service';
import { FiatWalletTransactionRepository } from '../../../fiatWalletTransactions/fiatWalletTransactions.repository';
import { FiatWalletTransactionService } from '../../../fiatWalletTransactions/fiatWalletTransactions.service';
import { PagaLedgerAccountService } from '../../../pagaLedgerAccount/pagaLedgerAccount.service';
import { RateRepository } from '../../../rate/rate.repository';
import { RateService } from '../../../rate/rate.service';
import { RateConfigRepository } from '../../../rateConfig/rateConfig.repository';
import { TransactionRepository } from '../../../transaction';
import { TransactionService } from '../../../transaction/transaction.service';
import { UserTierService } from '../../../userTier';
import { VirtualAccountService } from '../../../virtualAccount';
import { ExchangeFiatWalletDto } from '../../dto/exchange-fiat-wallet.dto';
import { InitiateExchangeDto } from '../../dto/initiateExchange.dto';
import { NgToUsdExchangeEscrowService } from './ng-to-usd-exchange.escrow.service';

@Injectable()
export class NgToUsdExchangeService {
  public readonly LOCK_TTL_MS = 30000;
  public readonly LOCK_RETRY_COUNT = 5;
  public readonly LOCK_RETRY_DELAY_MS = 500;

  private readonly logger = new Logger(NgToUsdExchangeService.name);

  @Inject(LockerService)
  public readonly lockerService: LockerService;

  @Inject(UserTierService)
  private readonly userTierService: UserTierService;

  @Inject(RateRepository)
  private readonly rateRepository: RateRepository;

  @Inject(TransactionRepository)
  public readonly transactionRepository: TransactionRepository;

  @Inject(FiatWalletTransactionRepository)
  public readonly fiatWalletTransactionRepository: FiatWalletTransactionRepository;

  @Inject(FiatWalletService)
  public readonly fiatWalletService: FiatWalletService;

  @Inject(TransactionService)
  public readonly transactionService: TransactionService;

  @Inject(FiatWalletTransactionService)
  public readonly fiatWalletTransactionService: FiatWalletTransactionService;

  @Inject(forwardRef(() => ExecuteNgUsdExchangeProcessor))
  private readonly executeNgUsdExchangeProcessor: ExecuteNgUsdExchangeProcessor;

  @Inject(ExchangeAdapter)
  public readonly exchangeAdapter: ExchangeAdapter;

  @Inject(DepositAddressService)
  private readonly depositAddressService: DepositAddressService;

  @Inject(KYCAdapter)
  private readonly kycAdapter: KYCAdapter;

  @Inject(UserRepository)
  private readonly userRepository: UserRepository;

  @Inject(FiatWalletEscrowService)
  public readonly fiatWalletEscrowService: FiatWalletEscrowService;

  @Inject(RateConfigRepository)
  private readonly rateConfigRepository: RateConfigRepository;

  @Inject(PagaLedgerAccountService)
  private readonly pagaLedgerAccountService: PagaLedgerAccountService;

  @Inject(VirtualAccountService)
  private readonly virtualAccountService: VirtualAccountService;

  @Inject(WaasAdapter)
  public readonly waasAdapter: WaasAdapter;

  @Inject(RateService)
  public readonly rateService: RateService;

  @Inject(NgToUsdExchangeEscrowService)
  public readonly ngToUsdExchangeEscrowService: NgToUsdExchangeEscrowService;

  async initializeNgToUSDExchange(
    userId: string,
    payload: InitiateExchangeDto,
    options?: {
      destinationWalletAddress?: { address: string; currency: string; network: string };
    },
  ) {
    this.logger.debug(
      `NG=>USD Exchange: Initializing exchange for user ${userId} with payload ${JSON.stringify(payload)}`,
    );

    const lockKey = this.generateLockKey(userId, payload.from, payload.to);
    const transactionReference = UtilsService.generateTransactionReference();

    return await this.lockerService.withLock(
      lockKey,
      async () => {
        try {
          // validate if the rate is to buy dollar
          const rate = await this.validateRateIsToBuyDollarOrThrow(payload.rate_id);

          const rateInMainUnit = CurrencyUtility.formatCurrencyAmountToMainUnit(rate.rate, payload.from);

          await this.validateUserLimitsOrThrow(userId, payload.from, payload.amount);

          const userWithProfile = await this.getUserCountryAndProfileOrThrow(userId);

          await this.fiatWalletService.checkIfUserHasEnoughBalanceOrThrow(
            userWithProfile.id,
            payload.amount,
            payload.from,
          );

          const { activeChannel, activeNetwork } = await this.getActiveDepositChannelOrThrow(
            payload.from,
            userWithProfile,
          );

          if (payload.amount < activeChannel.min) {
            throw new BadRequestException(`Amount is less than the minimum amount of ${activeChannel.min}`);
          }

          if (payload.amount > activeChannel.max) {
            throw new BadRequestException(`Amount is greater than the maximum amount of ${activeChannel.max}`);
          }

          // validate the rate
          await this.rateService.validateRateOrThrow(payload.rate_id, payload.amount, RateTransactionType.SELL);

          const minimumLocalAmount = activeChannel.min;
          const maximumLocalAmount = activeChannel.max;

          // Use provided destination address (for card funding) or default to user's crypto wallet
          const destinationWalletAddress =
            options?.destinationWalletAddress || (await this.getUserWalletAddressOrFail(userWithProfile));

          // store the transaction reference in redis
          const transactionData: Record<string, any> = {
            transactionReference,
            activeChannelRef: activeChannel.ref,
            activeNetworkRef: activeNetwork.ref,
            transferType: activeChannel.rampType as unknown as ExchangeChannelType,
            fromCurrency: payload.from,
            amount: payload.amount,
            from: payload.from,
            to: payload.to,
            destinationWalletAddress: destinationWalletAddress.address,
            rate: rate,
            minimumLocalAmount: minimumLocalAmount,
            maximumLocalAmount: maximumLocalAmount,
            expirationTime: DateTime.now().plus({ minutes: EXCHANGE_EXPIRATION_TIME_IN_MINUTES }).toSQL(),
            rateInMainUnit: rateInMainUnit,
          };
          await this.ngToUsdExchangeEscrowService.storeTransactionData(transactionReference, transactionData);

          const payInRequest = await this.createPayInRequest({
            localAmount: payload.amount,
            user: userWithProfile,
            parentTransactionId: transactionReference,
            activeChannelRef: activeChannel.ref,
            activeNetworkRef: activeNetwork.ref,
            transferType: activeChannel.rampType as unknown as ExchangeChannelType,
            fromCurrency: payload.from,
            destinationWalletAddress: destinationWalletAddress, // Rain (card funding) or user wallet (regular exchange)
          });
          console.log('🚀 ~~ NgToUsdExchangeService ~~ initializeNgToUSDExchange ~~ payInRequest:', payInRequest);

          const totalFeeLocal = add(payInRequest.feeLocal, payInRequest.networkFeeLocal, payInRequest.partnerFeeLocal);
          const totalFeeUSD = add(payInRequest.feeUSD, payInRequest.networkFeeUSD, payInRequest.partnerFeeUSD);

          const amountToReceiveUSD = Number(payInRequest.receiverCryptoInfo.cryptoAmount);

          const amountToPayLocal = subtract(payload.amount, totalFeeLocal);
          const totalAmountToPayLocal = add(amountToPayLocal, totalFeeLocal);

          // add the fees to the parent transaction and parent fiat transaction
          this.logger.debug(
            `NG=>USD Exchange: updating transactions with fees for parent transaction ${transactionReference} with total fee local ${totalFeeLocal} and total fee USD ${totalFeeUSD} for user ${userWithProfile.username}`,
          );
          const ngnWithdrawalFee = await this.calculateNgnWithdrawalFee(payload.amount);
          const ngnWithdrawalFeeInUSD = divide(ngnWithdrawalFee, rateInMainUnit);

          return {
            sourceTransactionId: transactionReference,
            localAmount: amountToPayLocal,
            amountToReceiveUSD,
            totalAmountToPayLocal: add(totalAmountToPayLocal, ngnWithdrawalFee),
            feeUSD: add(totalFeeUSD, ngnWithdrawalFeeInUSD),
            feeLocal: add(totalFeeLocal, ngnWithdrawalFee),
            minimumLocalAmount,
            maximumLocalAmount,
            expirationTime: DateTime.now().plus({ minutes: EXCHANGE_EXPIRATION_TIME_IN_MINUTES }).toSQL(),
            rateInMainUnit,
            payInRequest,
          };
        } catch (error) {
          this.logger.error(
            `NG=>USD Exchange: Failed to initialize exchange for user ${userId} with payload ${JSON.stringify(payload)}: ${error.message}`,
          );

          const storedTransactionData =
            await this.ngToUsdExchangeEscrowService.getTransactionData(transactionReference);

          if (storedTransactionData) {
            // remove the transaction reference from redis
            await this.ngToUsdExchangeEscrowService.removeTransactionData(transactionReference);
          }
          throw new InternalServerErrorException(error?.message);
        }
      },
      {
        ttl: this.LOCK_TTL_MS,
        retryCount: this.LOCK_RETRY_COUNT,
        retryDelay: this.LOCK_RETRY_DELAY_MS,
      },
    );
  }

  async executeExchange(
    user: UserModel,
    payload: ExchangeFiatWalletDto,
  ): Promise<{
    status: string;
    transactionRef: string;
    message: string;
    jobId: string | number;
  }> {
    // Create a lock key based on user ID and transaction type to prevent concurrent exchanges
    const lockKey = this.generateExecuteExchangeLockKey(user.id, payload.transaction_id);

    return await this.lockerService.withLock(
      lockKey,
      async () => {
        try {
          this.logger.debug(
            `NG=>USD Exchange: Executing exchange for user ${user.username} with payload ${JSON.stringify(payload)}`,
          );

          // get the transaction data from redis
          const transactionData = await this.ngToUsdExchangeEscrowService.getTransactionData(payload.transaction_id);

          if (!transactionData) {
            throw new BadRequestException('Transaction data not found');
          }

          this.logger.debug(`NG=>USD Exchange: Getting validated virtual account for user ${user.username}`);
          const virtualAccount = await this.virtualAccountService.findOrCreateVirtualAccount(
            user.id,
            {
              fiat_wallet_id: null,
              transaction_id: payload.transaction_id,
            },
            VirtualAccountType.MAIN_ACCOUNT,
          );

          if (!virtualAccount) {
            throw new BadRequestException('failed to create exchange virtual account');
          }

          if (!virtualAccount.account_number) {
            throw new BadRequestException('Virtual account number is missing');
          }

          if (!virtualAccount.account_name) {
            throw new BadRequestException('Virtual account name is missing');
          }

          const jobData: ExecuteNgToUSDExchangeJobData = {
            transactionReference: payload.transaction_id,
            accountNumber: virtualAccount.account_number,
            rateId: transactionData.rate?.id,
            userId: user.id,
          };

          this.logger.debug(
            `NG=>USD Exchange: Queueing exchange job for transaction ${transactionData.transactionReference} for user ${user.username} with job data ${JSON.stringify(jobData)}`,
          );
          // Queue the exchange job for background processing
          const job = await this.executeNgUsdExchangeProcessor.queueExecuteNgToUSDExchange(jobData);

          if (!job?.id) {
            throw new InternalServerErrorException('Failed to initiate exchange transaction');
          }

          return {
            status: 'processing',
            transactionRef: transactionData.transactionReference,
            message: 'Exchange transaction initiated successfully',
            jobId: job.id,
          };
        } catch (error) {
          this.logger.error('Failed to execute exchange for user: ', user.id, error.message, error.stack);
          await this.updateSourceTransactionsToFailed(payload.transaction_id, error.message);
          throw new InternalServerErrorException(error?.message);
        }
      },
      { ttl: this.LOCK_TTL_MS, retryCount: this.LOCK_RETRY_COUNT, retryDelay: this.LOCK_RETRY_DELAY_MS },
    );
  }

  public async validateUserLimitsOrThrow(userId: string, from: string, amount: number) {
    this.logger.debug(
      `Validating user limits for user ${userId} with amount ${amount} and from ${from}`,
      'NgToUsdExchangeService.validateUserLimitsOrThrow',
    );
    const userLimits = await this.userTierService.getAssetLimits(userId, from);

    if (!userLimits) {
      this.logger.error(
        `User limits not found for user ${userId} with amount ${amount} and from ${from}`,
        'NgToUsdExchangeService.validateUserLimitsOrThrow',
      );
      throw new BadRequestException('User limits not found');
    }

    if (amount < userLimits.minimum_transaction_amount) {
      this.logger.error(
        `Amount is less than the minimum amount of ${userLimits.minimum_transaction_amount} for user ${userId} with amount ${amount} and from ${from}`,
        'NgToUsdExchangeService.validateUserLimitsOrThrow',
      );
      throw new BadRequestException(
        `Amount is less than the minimum amount of ${userLimits.minimum_transaction_amount}`,
      );
    }

    if (amount > userLimits.maximum_transaction_amount) {
      this.logger.error(
        `Amount is greater than the maximum amount of ${userLimits.maximum_transaction_amount} for user ${userId} with amount ${amount} and from ${from}`,
        'NgToUsdExchangeService.validateUserLimitsOrThrow',
      );
      throw new BadRequestException(
        `Amount is greater than the maximum amount of ${userLimits.maximum_transaction_amount}`,
      );
    }
  }

  private generateExecuteExchangeLockKey(userId: string, transactionId: string) {
    return `exchange:${userId}:${transactionId}`;
  }

  public async updateTransactionsWithFees(
    parentTransaction: TransactionModel,
    fiatTransaction: FiatWalletTransactionModel,
    totalFee: number,
    totalFeeUSD: number,
    amountToReceiveUSD: number,
    amountToPayLocal: number,
    ngnWithdrawalFee: number,
  ) {
    const localFeeInSmallestUnit = CurrencyUtility.formatCurrencyAmountToSmallestUnit(
      Number(totalFee.toFixed(2)),
      parentTransaction.metadata.source_currency,
    );

    const localFeeInUSDInSmallestUnit = CurrencyUtility.formatCurrencyAmountToSmallestUnit(
      Number(totalFeeUSD.toFixed(2)),
      parentTransaction.metadata.destination_currency,
    );

    const ngnWithdrawalFeeInSmallestUnit = CurrencyUtility.formatCurrencyAmountToSmallestUnit(
      Number(ngnWithdrawalFee.toFixed(2)),
      SUPPORTED_CURRENCIES.NGN.code,
    );

    const balanceAfter = subtract(Number(parentTransaction.balance_after), Number(ngnWithdrawalFeeInSmallestUnit));

    await this.transactionRepository.transaction(async (trx) => {
      await this.transactionRepository.update(
        parentTransaction.id,
        {
          balance_after: balanceAfter,
          metadata: {
            ...parentTransaction.metadata,
            local_fee: localFeeInSmallestUnit,
            usd_fee: localFeeInUSDInSmallestUnit,
            usd_amount: amountToReceiveUSD,
            local_amount: amountToPayLocal,
          },
        },
        { trx },
      );

      await this.fiatWalletTransactionRepository.update(
        fiatTransaction.id,
        {
          balance_after: balanceAfter,
          provider_fee: localFeeInSmallestUnit,
          provider_metadata: {
            ...fiatTransaction.provider_metadata,
            local_fee: localFeeInSmallestUnit,
            usd_fee: localFeeInUSDInSmallestUnit,
          },
        },
        { trx },
      );
    });
  }

  public async validateRateIsToBuyDollarOrThrow(rateId: string) {
    const rate = await this.rateRepository.findOne({ id: rateId });
    if (!rate) {
      throw new BadRequestException('Rate not found or expired');
    }
    if (rate.buying_currency_code?.toLowerCase() !== SUPPORTED_CURRENCIES.USD.code.toLowerCase()) {
      throw new BadRequestException('Rate is not to buy dollar');
    }

    return rate;
  }

  public async createPayInRequest(options: {
    localAmount?: number;
    user: UserModel;
    parentTransactionId: string;
    activeChannelRef?: string;
    activeNetworkRef?: string;
    transferType?: ExchangeChannelType;
    fromCurrency?: string;
    forceAccept?: boolean;
    destinationWalletAddress?: { address: string; currency: string; network: string };
  }) {
    // create a lock key to lock this method

    const {
      user,
      parentTransactionId,
      activeChannelRef,
      activeNetworkRef,
      transferType,
      fromCurrency,
      forceAccept,
      localAmount,
      destinationWalletAddress: providedDestinationAddress,
    } = options;

    const lockKey = `exchange-service:${options.user.id}:create-pay-in-request`;

    return await this.lockerService.withLock(
      lockKey,
      async () => {
        this.logger.debug(
          `NG=>USD Exchange: creating pay in request for user ${user.username} with amount ${localAmount} from ${fromCurrency}`,
        );

        const { country } = await this.getUserCountryAndProfileOrThrow(user.id);
        // todo: will add this back later
        // const dob = await this.formatDob(userProfile.dob?.toString());

        // get the kyc details from sumsub
        const kycDetails = await this.getKycDetailsFromProviderOrThrow(user.id);

        // get the user NIN, (while in dev you can also get the passport number)
        // todo: will add this back later
        // const userNIN = this.getUserNINForOnlyNGUsers(kycDetails.data);

        // todo: will add this back later
        // const isUserNigerian = kycDetails.data.country?.toLowerCase() === 'nga';

        // get the destination wallet address (use provided one for card funding, or default to user's wallet)
        const destinationWalletAddress = providedDestinationAddress || (await this.getUserWalletAddressOrFail(user));
        console.log(
          '🚀 ~~ NgToUsdExchangeService ~~ createPayInRequest ~~ destinationWalletAddress:',
          destinationWalletAddress,
        );

        // create a pay in request
        this.logger.log('Creating pay in request for user: ', user.id);

        const payInRequestPayload: ExchangeCreatePayInRequestPayload = {
          localAmount: localAmount,
          channelRef: activeChannelRef,
          sender: {
            businessName: EnvironmentService.getValue('BUSINESS_NAME'),
            businessIdNumber: EnvironmentService.getValue('BUSINESS_CAC_NUMBER'),
            phone: EnvironmentService.getValue('BUSINESS_PHONE'),
            email: EnvironmentService.getValue('BUSINESS_EMAIL'),
          },
          transactionRef: parentTransactionId,
          customerType: 'institution',
          transferType: transferType,
          userId: user.id,
          networkRef: activeNetworkRef,
          forceAccept: forceAccept,
          receiver: {
            walletAddress: destinationWalletAddress.address,
            cryptoCurrency: destinationWalletAddress.currency,
            cryptoNetwork: destinationWalletAddress.network,
          },
          currencyCode: fromCurrency,
        };

        if (!EnvironmentService.isProduction()) {
          payInRequestPayload.receiver.walletAddress = YELLOWCARD_COLLECTION_SUCCESS_WALLET_ADDRESS;
          payInRequestPayload.receiver.cryptoCurrency = YELLOWCARD_COLLECTION_SUCCESS_CRYPTO_CURRENCY;
          payInRequestPayload.receiver.cryptoNetwork = YELLOWCARD_COLLECTION_SUCCESS_CRYPTO_NETWORK;
        }

        // if user is from Nigeria, add the bvn and nin to the pay in request
        if (country.code?.toUpperCase() === 'NG' && payInRequestPayload.customerType === 'retail') {
          payInRequestPayload.sender.additionalIdNumber = kycDetails.data?.idNumber;
          payInRequestPayload.sender.additionalIdType = IdentityDocType.BVN;
        }

        const payInRequest = await this.exchangeAdapter.createPayInRequest(payInRequestPayload);
        this.logger.log('NG=>USD Exchange: Pay in request created successfully for user: ', user.username);

        // send money to the bank details from the payInRequest
        return payInRequest;
      },
      { ttl: this.LOCK_TTL_MS, retryCount: this.LOCK_RETRY_COUNT, retryDelay: this.LOCK_RETRY_DELAY_MS },
    );
  }

  public async calculateNgnWithdrawalFee(amount: number): Promise<number> {
    const rateConfig = await this.rateConfigRepository.findOne({ provider: 'yellowcard' });
    if (!rateConfig) {
      return 0;
    }

    const ngnWithdrawalFee = rateConfig.ngnWithdrawalFee;
    if (!ngnWithdrawalFee) {
      return 0;
    }

    let fee = 0;

    if (ngnWithdrawalFee.is_percentage) {
      fee = multiply(amount, divide(ngnWithdrawalFee.value, 100));
    } else {
      fee = ngnWithdrawalFee.value;
    }

    if (fee > ngnWithdrawalFee.cap) {
      fee = ngnWithdrawalFee.cap;
    }

    return Number(fee.toFixed(2));
  }

  public async createAllSourceTransactionsOrThrow(options: {
    user: UserModel;
    receiverUser: UserModel;
    amount: number;
    from: string;
    to: string;
    activeChannelRef?: string;
    activeNetworkRef?: string;
    transferType?: ExchangeChannelType;
    destinationWalletAddress?: string;
    rate?: ExchangeRateModel;
    transactionReference: string;
    providerId: string;
    totalFee: number;
    totalFeeUSD: number;
    ngnWithdrawalFee: number;
    amountToReceiveUSD: number;
    amountToPayLocal;
  }) {
    const {
      user,
      receiverUser,
      amount,
      from,
      to,
      activeChannelRef,
      activeNetworkRef,
      transferType,
      destinationWalletAddress,
      rate,
      transactionReference,
      providerId,
      totalFee,
      totalFeeUSD,
      ngnWithdrawalFee,
      amountToReceiveUSD,
      amountToPayLocal,
    } = options;

    this.logger.debug(
      `NG=>USD Exchange: Creating all related transactions for user ${user.email} with amount ${amount} from ${from} to ${to}`,
    );
    const fromCurrency = from.toUpperCase();
    const toCurrency = to.toUpperCase();

    try {
      // Check if transaction with this reference already exists (idempotency check for job retries)
      const existingTransaction = await this.transactionRepository.findOne({ reference: transactionReference });
      if (existingTransaction) {
        this.logger.debug(
          `NG=>USD Exchange: Transaction with reference ${transactionReference} already exists, returning existing transactions`,
        );
        const existingFiatTransaction = await this.fiatWalletTransactionRepository.findOne({
          transaction_id: existingTransaction.id,
        });
        return {
          parentTransaction: existingTransaction,
          fiatTransaction: existingFiatTransaction,
        };
      }

      const initiatorNgWallet = await this.fiatWalletService.getUserWallet(user.id, fromCurrency);

      const amountInSmallestUnit = CurrencyUtility.formatCurrencyAmountToSmallestUnit(amount, fromCurrency);

      const localFeeInSmallestUnit = CurrencyUtility.formatCurrencyAmountToSmallestUnit(
        Number(totalFee.toFixed(2)),
        fromCurrency,
      );

      const localFeeInUSDInSmallestUnit = CurrencyUtility.formatCurrencyAmountToSmallestUnit(
        Number(totalFeeUSD.toFixed(2)),
        toCurrency,
      );

      const ngnWithdrawalFeeInSmallestUnit = CurrencyUtility.formatCurrencyAmountToSmallestUnit(
        Number(ngnWithdrawalFee.toFixed(2)),
        SUPPORTED_CURRENCIES.NGN.code,
      );

      const initiatorBalanceBefore = Number(initiatorNgWallet.balance);
      const initiatorBalanceAfter = subtract(
        initiatorBalanceBefore,
        add(amountInSmallestUnit, localFeeInSmallestUnit, ngnWithdrawalFeeInSmallestUnit),
      );

      const allRelatedTransactions = await this.transactionRepository.transaction(async (trx) => {
        // create the transaction for the initiator
        const parentTransaction = await this.transactionService.create(
          user.id,
          {
            amount: amountInSmallestUnit,
            asset: fromCurrency,
            status: TransactionStatus.INITIATED,
            balance_before: initiatorBalanceBefore,
            balance_after: initiatorBalanceAfter,
            reference: transactionReference,
            transaction_type: TransactionType.EXCHANGE,
            category: TransactionCategory.FIAT,
            transaction_scope: TransactionScope.INTERNAL,
            description: `Exchange from ${SUPPORTED_CURRENCIES[fromCurrency.toUpperCase()]?.walletName || fromCurrency + ' Wallet'}`,
            external_reference: providerId,
            metadata: {
              source_user_id: user.id,
              source_currency: fromCurrency,
              destination_user_id: receiverUser.id,
              destination_currency: toCurrency,
              destination_name: `${receiverUser.first_name} ${receiverUser.last_name}`,
              expires_at: DateTime.now().plus({ minutes: 10 }).toSQL(),
              active_channel_ref: activeChannelRef,
              active_network_ref: activeNetworkRef,
              transfer_type: transferType,
              destination_wallet_address: destinationWalletAddress,
              rate_id: rate?.id,
              rate: rate?.rate,
              from: fromCurrency,
              to: toCurrency,
              local_fee: localFeeInSmallestUnit,
              usd_fee: localFeeInUSDInSmallestUnit,
              usd_amount: amountToReceiveUSD,
              local_amount: amountToPayLocal,
            },
          },
          trx,
        );

        // create the fiat transaction for the user
        const fiatTransaction = await this.fiatWalletTransactionService.create(
          user.id,
          {
            amount: amountInSmallestUnit,
            currency: fromCurrency,
            status: TransactionStatus.INITIATED,
            fiat_wallet_id: initiatorNgWallet.id,
            transaction_id: parentTransaction.id,
            transaction_type: FiatWalletTransactionType.EXCHANGE,
            provider_reference: providerId,
            balance_before: initiatorBalanceBefore,
            balance_after: initiatorBalanceAfter,
            provider_metadata: {
              source_user_id: user.id,
              source_currency: fromCurrency,
              source_name: `${user.first_name} ${user.last_name}`,
              destination_user_id: receiverUser.id,
              destination_currency: toCurrency,
              destination_name: `${receiverUser.first_name} ${receiverUser.last_name}`,
              destination_wallet_address: destinationWalletAddress,
            },
            destination: `${receiverUser.first_name} ${receiverUser.last_name}`,
            source: `${user.first_name} ${user.last_name}`,
            description: `Exchange from ${SUPPORTED_CURRENCIES[fromCurrency.toUpperCase()]?.walletName || fromCurrency + ' Wallet'}`,
          },
          trx,
        );

        return {
          parentTransaction,
          fiatTransaction,
        };
      });

      this.logger.debug(
        `Created all related transactions for user ${user.email} with amount ${amount} from ${from} to ${to}`,
      );
      return allRelatedTransactions;
    } catch (error) {
      this.logger.error(
        `Failed to create all related transactions for user ${user.email}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(error?.message);
    }
  }

  async updateSourceTransactionsToFailed(parentTransactionId: string, errorMessage: string) {
    this.logger.debug(
      `Update source transactions to failed: Updating source transactions to failed for parent transaction ${parentTransactionId} with error message ${errorMessage}`,
    );

    // Truncate error message to fit varchar(255) column
    const truncatedErrorMessage = errorMessage?.substring(0, 255) || '';

    // CHECK IF THE PARENT TRANSACTION IS ALREADY EXISTS
    const parentTransaction = await this.transactionRepository.findOne({ id: parentTransactionId });

    if (!parentTransaction) {
      return;
    }

    // CHECK IF THE TRANSACTION IS ALREADY FAILED
    if (parentTransaction.status?.toLowerCase() === TransactionStatus.FAILED.toLowerCase()) {
      return;
    }

    // CHECK IF THE PARENT TRANSACTION IS ALREADY COMPLETED
    if (parentTransaction.status?.toLowerCase() === TransactionStatus.COMPLETED.toLowerCase()) {
      return;
    }

    const fiatTransaction = await this.fiatWalletTransactionRepository.findOne({
      transaction_id: parentTransaction.id,
    });

    // UPDATE THE PARENT TRANSACTION AND THE FIAT TRANSACTION TO FAILED
    await this.transactionRepository.transaction(async (trx) => {
      await this.transactionService.updateStatus(
        parentTransaction.id,
        TransactionStatus.FAILED,
        {
          failure_reason: truncatedErrorMessage,
        },
        trx,
      );

      await this.fiatWalletTransactionService.updateStatus(
        fiatTransaction.id,
        TransactionStatus.FAILED,
        {
          failure_reason: truncatedErrorMessage,
        },
        trx,
      );
    });

    // CHECK IF THERE IS ANY AMOUNT LEFT IN THE ESCROW
    const escrowAmount = await this.fiatWalletEscrowService.getEscrowAmount(parentTransaction.id);

    if (escrowAmount > 0) {
      // get the fiat wallet
      const fiatWallet = await this.fiatWalletService.getUserWallet(
        parentTransaction.user_id,
        fiatTransaction.currency,
      );

      // create a new transaction and fiat transaction for the refund
      await this.createRefundTransactionAndFiatTransaction(
        escrowAmount,
        parentTransaction.user_id,
        fiatTransaction.currency,
        fiatWallet,
      );

      await this.fiatWalletEscrowService.releaseMoneyFromEscrow(parentTransaction.id);
    }
  }

  private async createRefundTransactionAndFiatTransaction(
    escrowAmount: number,
    userId: string,
    currency: string,
    fiatWallet: FiatWalletModel,
  ) {
    const ngWaasProvider = this.waasAdapter.getProvider();

    await this.transactionRepository.transaction(async (trx) => {
      const reference = UtilsService.generateTransactionReference();

      // get the user's account number from the fiat wallet
      if (ngWaasProvider.getProviderName()?.toLowerCase() !== 'paga') {
        // get the user's account number from the fiat wallet
        const virtualAccount = await this.virtualAccountService.findOneByUserIdOrThrow(userId, trx);

        await this.pagaLedgerAccountService.depositMoney(
          {
            accountNumber: virtualAccount.account_number,
            amount: escrowAmount,
            referenceNumber: reference,
            fee: 0,
            currency: SUPPORTED_CURRENCIES.NGN.code,
            description: `Refund of ${escrowAmount} to your ${currency} wallet`,
          },
          trx,
        );
      }

      const refundTransaction = await this.transactionService.create(
        userId,
        {
          amount: escrowAmount,
          asset: currency,
          transaction_type: TransactionType.REFUND,
          category: TransactionCategory.FIAT,
          transaction_scope: TransactionScope.INTERNAL,
          reference: reference,
          description: `Refund of ${escrowAmount} to your ${currency} wallet`,
          balance_before: Number(fiatWallet.balance),
          balance_after: add(Number(fiatWallet.balance), escrowAmount),
          metadata: {
            source_user_id: userId,
            source_currency: currency,
            destination_user_id: userId,
            destination_currency: currency,
          },
        },
        trx,
      );

      const refundFiatTransaction = await this.fiatWalletTransactionService.create(
        userId,
        {
          transaction_id: refundTransaction.id,
          amount: escrowAmount,
          currency: currency,
          status: TransactionStatus.COMPLETED,
          fiat_wallet_id: fiatWallet.id,
          transaction_type: FiatWalletTransactionType.REFUND,
          provider_reference: refundTransaction.reference,
          description: `Refund of ${escrowAmount} to your ${currency} wallet`,
          balance_before: Number(fiatWallet.balance),
          balance_after: add(Number(fiatWallet.balance), escrowAmount),
          provider_metadata: {
            source_user_id: userId,
            source_currency: currency,
            destination_user_id: userId,
            destination_currency: currency,
          },
        },
        trx,
      );

      await this.fiatWalletService.updateBalance(
        fiatWallet.id,
        escrowAmount,
        refundTransaction.id,
        FiatWalletTransactionType.REFUND,
        TransactionStatus.COMPLETED,
        {
          fiat_wallet_transaction_id: refundFiatTransaction.id,
        },
        trx,
      );

      await this.transactionService.updateStatus(refundTransaction.id, TransactionStatus.COMPLETED, {}, trx);
    });
  }

  public async validateTransactionToExecuteExchangeOrThrow(transactionId: string, user: UserModel) {
    this.logger.debug(`Validating transaction ${transactionId} for user ${user.email}`);
    const transaction = await this.transactionRepository.findOne(
      { id: transactionId },
      {},
      { graphFetch: '[fiatWalletTransaction]' },
    );
    if (!transaction) {
      throw new BadRequestException('Transaction not found');
    }
    if (transaction.status?.toLowerCase() === TransactionStatus.COMPLETED.toLowerCase()) {
      throw new BadRequestException('Transaction is already completed');
    }
    if (transaction.status?.toLowerCase() === TransactionStatus.FAILED.toLowerCase()) {
      throw new BadRequestException('Transaction is already failed');
    }
    if (transaction.status?.toLowerCase() === TransactionStatus.CANCELLED.toLowerCase()) {
      throw new BadRequestException('Transaction is already cancelled');
    }

    if (transaction.transaction_type?.toLowerCase() !== TransactionType.EXCHANGE.toLowerCase()) {
      throw new BadRequestException('Transaction is not an exchange transaction');
    }

    if (transaction.user_id !== user.id) {
      throw new BadRequestException('Transaction is not for the user');
    }

    if (transaction.status?.toLowerCase() !== TransactionStatus.INITIATED.toLowerCase()) {
      throw new BadRequestException('Transaction is not initiated');
    }

    // check if the transaction has expired
    const expiresAt = DateTime.fromSQL(transaction.metadata?.expires_at);
    if (expiresAt < DateTime.now()) {
      throw new BadRequestException('Transaction has expired');
    }

    return transaction;
  }

  async deductFundsFromUser(
    parentTransaction: TransactionModel,
    fiatTransaction: FiatWalletTransactionModel,
    amountInSmallestUnit: number,
    trx?: Transaction,
  ) {
    // Deduct the funds from the user's balance
    await this.fiatWalletService.updateBalance(
      fiatTransaction.fiat_wallet_id,
      -amountInSmallestUnit,
      parentTransaction.id,
      FiatWalletTransactionType.EXCHANGE,
      TransactionStatus.PENDING,
      {
        fiat_wallet_transaction_id: fiatTransaction.id,
      },
      trx,
    );

    // Move the money to redis store
    await this.fiatWalletEscrowService.moveMoneyToEscrow(parentTransaction.id, amountInSmallestUnit);
  }

  private getUserNINForOnlyNGUsers(kycDetails: GetKycDetailsResponse) {
    this.logger.debug(
      `Getting user NIN for only NG users: ${JSON.stringify(kycDetails, null, 2)}`,
      'NgToUsdExchangeService.getUserNINForOnlyNGUsers',
    );
    const nin = kycDetails.additionalIdDocuments.find(
      (document) => document.type?.toLowerCase() === IdentityDocType.NIN.toLowerCase(),
    );

    // we throw this error here because yellowcard only accepts NIN for now and the user is not a nigerian.
    if (!nin && EnvironmentService.isProduction() && kycDetails.country?.toLowerCase() === 'nga') {
      this.logger.error(
        `User has no NIN, please Finish your KYC to continue: ${JSON.stringify(kycDetails, null, 2)}`,
        'NgToUsdExchangeService.getUserNINForOnlyNGUsers',
      );
      throw new BadRequestException('User has no NIN, please Finish your KYC to continue');
    }

    return nin?.number || kycDetails.idDocument.number;
  }

  public async getUserWalletAddressOrFail(
    user: UserModel,
  ): Promise<{ address: string; currency: string; network: string }> {
    this.logger.debug(
      `Getting user wallet address for user ${user.email}`,
      'NgToUsdExchangeService.getUserWalletAddressOrFail',
    );
    const depositAddress = await this.depositAddressService.getDepositAddresses(user);

    if (depositAddress.length === 0) {
      this.logger.error(
        `User has no deposit address, please add a deposit address to continue: ${JSON.stringify(user, null, 2)}`,
        'NgToUsdExchangeService.getUserWalletAddressOrFail',
      );
      throw new BadRequestException('User has no deposit address, please add a deposit address to continue');
    }

    const underlyingCryptoAsset = EnvironmentService.isProduction()
      ? EnvironmentService.getValue('DEFAULT_UNDERLYING_CURRENCY')
      : 'USDC.ETH';

    if (!underlyingCryptoAsset) {
      this.logger.error(
        `Default underlying currency not found, please contact support: ${JSON.stringify(user, null, 2)}`,
        'NgToUsdExchangeService.getUserWalletAddressOrFail',
      );
      throw new BadRequestException('Default underlying currency not found, please contact support');
    }

    // get the address from the deposit address
    const address = depositAddress.find((address) => {
      return address.asset?.toLowerCase() === underlyingCryptoAsset.toLowerCase();
    });

    if (!address?.address) {
      this.logger.error(
        `User has no deposit address for the default underlying currency: ${JSON.stringify(user, null, 2)}`,
        'NgToUsdExchangeService.getUserWalletAddressOrFail',
      );
      throw new BadRequestException('User has no deposit address for the default underlying currency');
    }

    // split the address to get the network
    const [cryptoAsset, network] = address.asset?.split('.') || [];

    this.logger.debug(
      `NG=>USD Exchange: getting user wallet address for user ${user.email} with address ${address.address}`,
    );

    return {
      address: address.address,
      currency: cryptoAsset,
      network: network || 'ERC20',
    };
  }

  private async formatDob(dob: string) {
    return DateTime.fromJSDate(new Date(dob)).toFormat('mm/dd/yyyy');
  }

  private async getKycDetailsFromProviderOrThrow(userId: string) {
    this.logger.debug(
      `Getting KYC details from provider for user ${userId}`,
      'NgToUsdExchangeService.getKycDetailsFromProviderOrThrow',
    );
    const kycDetails = await this.kycAdapter.getKycDetailsByUserId(userId);
    if (!kycDetails) {
      throw new BadRequestException('User has not done kyc, please complete your kyc to continue');
    }
    return kycDetails;
  }

  public async getActiveDepositChannelOrThrow(countryCode: string, user?: UserModel) {
    try {
      //LATER: SPEAK WITH THE DEV TEAM AND PRODUCT TEAM TO LET PAGA BE THE DEFAULT ACTIVE CHANNEL FOR NIGERIA

      this.logger.debug(`Getting active deposit channel for ${countryCode}, for user ${user?.email}`);
      const channels = await this.exchangeAdapter.getChannels({
        countryCode: CurrencyUtility.getCurrencyCountryCode(countryCode),
      });

      const networks = await this.exchangeAdapter.getBanks({
        countryCode: CurrencyUtility.getCurrencyCountryCode(countryCode),
      });

      if (!channels) {
        throw new BadRequestException('No active deposit channel found for the country');
      }

      if (!networks) {
        throw new BadRequestException('No active bank found for the country');
      }

      const activeChannel = channels.find((channel) => channel.status === 'active' && channel.rampType === 'deposit');

      const activeNetwork = networks.find(
        (network) => network.status === 'active' && network.channelRefs?.includes(activeChannel?.ref),
      );

      if (channels.length === 0) {
        throw new BadRequestException('No active deposit channel found for the country');
      }

      if (networks.length === 0) {
        throw new BadRequestException('No active bank found for the country');
      }

      this.logger.debug(
        `Fetched active deposit channel for ${countryCode}, for user ${user?.email}: ${activeChannel?.ref}`,
      );
      return { activeChannel, activeNetwork };
    } catch (error) {
      this.logger.error(
        `Failed to get active deposit channel for ${countryCode}, for user ${user?.email}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(error?.message);
    }
  }

  public async getUserCountryAndProfileOrThrow(userId: string) {
    this.logger.debug(
      `Getting user country and profile for user ${userId}`,
      'NgToUsdExchangeService.getUserCountryAndProfileOrThrow',
    );
    const user: UserModel = await this.userRepository.findOne(
      { id: userId },
      {},
      { graphFetch: '[userProfile,country]' },
    );
    if (!user) {
      throw new BadRequestException('User not found');
    }
    return user;
  }

  /**
   * Generate lock key for exchange operation
   */
  public generateLockKey(userId: string, from: string, to: string): string {
    return `exchange:${userId}:${from}-${to}`;
  }
}
