import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Job } from 'bullmq';
import { add, subtract } from 'mathjs';
import { ExchangeAdapter } from '../../../../adapters/exchange/exchange.adapter';
import {
  ExchangeChannelType,
  ExchangePayInRequest,
  ExchangePayInRequestBankInfo,
} from '../../../../adapters/exchange/exchange.interface';
import { WaasAdapter } from '../../../../adapters/waas/waas.adapter';
import { WaasTransactionStatus } from '../../../../adapters/waas/waas.adapter.interface';
import { EnvironmentService } from '../../../../config';
import { PAGA_DEVELOPMENT_BANK_ACCOUNT_NUMBER } from '../../../../constants/constants';
import { CurrencyUtility, SUPPORTED_CURRENCIES } from '../../../../currencies';
import { RateTransactionType } from '../../../../database';
import { CardTransactionStatus } from '../../../../database/models/cardTransaction/cardTransaction.interface';
import { TransactionStatus } from '../../../../database/models/transaction/transaction.interface';
import { NgToUsdExchangeEscrowService } from '../../../../modules/exchange/fiat-exchange/ng-to-usd-exchange.service/ng-to-usd-exchange.escrow.service';
import { NgToUsdExchangeService } from '../../../../modules/exchange/fiat-exchange/ng-to-usd-exchange.service/ng-to-usd-exchange.service';
import { FiatWalletService } from '../../../../modules/fiatWallet';
import { FiatWalletTransactionRepository } from '../../../../modules/fiatWalletTransactions/fiatWalletTransactions.repository';
import { FiatWalletTransactionService } from '../../../../modules/fiatWalletTransactions/fiatWalletTransactions.service';
import { PagaLedgerAccountService } from '../../../../modules/pagaLedgerAccount/pagaLedgerAccount.service';
import { PagaLedgerTransactionService } from '../../../../modules/pagaLedgerTransaction/pagaLedgerTransaction.service';
import { RateService } from '../../../../modules/rate/rate.service';
import { TransactionRepository } from '../../../../modules/transaction';
import { TransactionService } from '../../../../modules/transaction/transaction.service';
import { CardTransactionRepository } from '../../../../modules/card/repository/cardTransaction.repository';
import { VirtualAccountService } from '../../../../modules/virtualAccount/virtualAccount.service';
import { UtilsService } from '../../../../utils/utils.service';
import { QueueService } from '../../queue.service';

export interface ExecuteNgToUSDExchangeJobData {
  transactionReference: string;
  accountNumber: string;
  rateId: string;
  userId: string;
  isCardFunding?: boolean;
  cardTransactionId?: string;
  depositAddress?: string;
}

@Injectable()
export class ExecuteNgUsdExchangeProcessor {
  private readonly logger = new Logger(ExecuteNgUsdExchangeProcessor.name);
  private readonly queueName = 'execute-ng-usd-exchange';
  private processorsRegistered = false;

  @Inject(QueueService)
  private readonly queueService: QueueService;

  @Inject(ExchangeAdapter)
  private readonly exchangeAdapter: ExchangeAdapter;

  @Inject(TransactionService)
  private readonly transactionService: TransactionService;

  @Inject(FiatWalletTransactionService)
  private readonly fiatWalletTransactionService: FiatWalletTransactionService;

  @Inject(WaasAdapter)
  private readonly waasAdapter: WaasAdapter;

  @Inject(TransactionRepository)
  private readonly transactionRepository: TransactionRepository;

  @Inject(FiatWalletTransactionRepository)
  private readonly fiatWalletTransactionRepository: FiatWalletTransactionRepository;

  @Inject(forwardRef(() => NgToUsdExchangeService))
  private readonly ngToUsdExchangeService: NgToUsdExchangeService;

  @Inject(FiatWalletService)
  private readonly fiatWalletService: FiatWalletService;

  @Inject(PagaLedgerAccountService)
  private readonly pagaLedgerAccountService: PagaLedgerAccountService;

  @Inject(VirtualAccountService)
  private readonly virtualAccountService: VirtualAccountService;

  @Inject(PagaLedgerTransactionService)
  private readonly pagaLedgerTransactionService: PagaLedgerTransactionService;

  @Inject(RateService)
  private readonly rateService: RateService;

  @Inject(NgToUsdExchangeEscrowService)
  private readonly ngToUsdExchangeEscrowService: NgToUsdExchangeEscrowService;

  @Inject(CardTransactionRepository)
  private readonly cardTransactionRepository: CardTransactionRepository;

  private registerProcessor() {
    if (this.processorsRegistered) return;

    this.queueService.processJobs<ExecuteNgToUSDExchangeJobData>(
      this.queueName,
      'execute-ng-to-usd-exchange',
      this.processExecuteNgToUSDExchange.bind(this),
      2, // Max 2 concurrent execute ng to usd exchange operations
    );

    this.processorsRegistered = true;
    this.logger.log('Execute ng to usd exchange processors registered');
  }

  private async processExecuteNgToUSDExchange(job: Job<ExecuteNgToUSDExchangeJobData>): Promise<any> {
    const {
      transactionReference,
      accountNumber: jobAccountNumber,
      rateId,
      userId,
      isCardFunding,
      cardTransactionId,
      depositAddress,
    } = job.data;

    try {
      const transactionData = await this.ngToUsdExchangeEscrowService.getTransactionData(transactionReference);
      console.log(
        '🚀 ~~ ExecuteNgUsdExchangeProcessor ~~ processExecuteNgToUSDExchange ~~ transactionData:',
        transactionData,
      );

      if (!transactionData) {
        throw new BadRequestException('Transaction data not found');
      }

      const userWithProfile = await this.ngToUsdExchangeService.getUserCountryAndProfileOrThrow(userId);
      console.log(
        '🚀 ~~ ExecuteNgUsdExchangeProcessor ~~ processExecuteNgToUSDExchange ~~ userWithProfile:',
        userWithProfile,
      );

      const payInRequest = await this.exchangeAdapter.getPayInRequestByTransactionRef(transactionReference);
      console.log(
        '🚀 ~~ ExecuteNgUsdExchangeProcessor ~~ processExecuteNgToUSDExchange ~~ payInRequest:',
        payInRequest,
      );

      if (!payInRequest) {
        throw new BadRequestException('Pay in request not found');
      }

      const totalFeeLocal = add(payInRequest.feeLocal, payInRequest.networkFeeLocal, payInRequest.partnerFeeLocal);
      const totalFeeUSD = add(payInRequest.feeUSD, payInRequest.networkFeeUSD, payInRequest.partnerFeeUSD);
      const amountToReceiveUSD = Number(payInRequest.receiverCryptoInfo.cryptoAmount);

      if (isCardFunding) {
        this.logger.log(
          `[NGN_CARD_FUNDING] Step 4 - Exchange Processor: Processing card funding exchange - Transaction reference: ${transactionReference}`,
        );
        this.logger.log(
          `[NGN_CARD_FUNDING] Step 4 - Exchange Processor: Transaction data amount: ${transactionData.amount} kobo (${CurrencyUtility.formatCurrencyAmountToMainUnit(transactionData.amount, 'NGN')} NGN)`,
        );
        this.logger.log(
          `[NGN_CARD_FUNDING] Step 4 - Exchange Processor: Total fee (local/NGN): ${totalFeeLocal} kobo (${CurrencyUtility.formatCurrencyAmountToMainUnit(totalFeeLocal, 'NGN')} NGN)`,
        );
        this.logger.log(
          `[NGN_CARD_FUNDING] Step 4 - Exchange Processor: Total fee (USD): ${totalFeeUSD} cents (${CurrencyUtility.formatCurrencyAmountToMainUnit(totalFeeUSD, 'USD')} USD)`,
        );
        this.logger.log(
          `[NGN_CARD_FUNDING] Step 4 - Exchange Processor: Amount to receive (USD): ${amountToReceiveUSD} USD`,
        );
      }

      const amountToPayLocal = subtract(transactionData.amount, totalFeeLocal);

      if (isCardFunding) {
        this.logger.log(
          `[NGN_CARD_FUNDING] Step 4 - Exchange Processor: Amount to pay (local/NGN): ${amountToPayLocal} kobo (${CurrencyUtility.formatCurrencyAmountToMainUnit(amountToPayLocal, 'NGN')} NGN)`,
        );
      }

      const ngnWithdrawalFee = await this.ngToUsdExchangeService.calculateNgnWithdrawalFee(transactionData.amount);

      if (isCardFunding) {
        this.logger.log(
          `[NGN_CARD_FUNDING] Step 4 - Exchange Processor: NGN withdrawal fee (Paga): ${ngnWithdrawalFee} kobo (${CurrencyUtility.formatCurrencyAmountToMainUnit(ngnWithdrawalFee, 'NGN')} NGN)`,
        );
      }

      const destinationWalletAddress =
        isCardFunding && depositAddress ? depositAddress : transactionData.destinationWalletAddress;

      const amountWithFees = isCardFunding
        ? add(transactionData.amount, ngnWithdrawalFee)
        : add(
            CurrencyUtility.formatCurrencyAmountToMainUnit(
              Number(transactionData.amount),
              transactionData.fromCurrency,
            ),
            CurrencyUtility.formatCurrencyAmountToMainUnit(
              Number(transactionData.totalFee),
              transactionData.fromCurrency,
            ),
          );

      if (isCardFunding) {
        this.logger.log(
          `[NGN_CARD_FUNDING] Step 4 - Exchange Processor: Total amount with fees to debit from NGN wallet: ${amountWithFees} kobo (${CurrencyUtility.formatCurrencyAmountToMainUnit(amountWithFees, 'NGN')} NGN)`,
        );
        this.logger.log(
          `[NGN_CARD_FUNDING] Step 4 - Exchange Processor: Breakdown - Transaction amount: ${transactionData.amount} kobo + NGN withdrawal fee: ${ngnWithdrawalFee} kobo = Total: ${amountWithFees} kobo`,
        );
      }

      await this.fiatWalletService.checkIfUserHasEnoughBalanceOrThrow(
        userId,
        amountWithFees,
        transactionData.fromCurrency,
      );

      // todo: determine if the transaction is for card funding so we can display proper destination details
      await this.ngToUsdExchangeService.createAllSourceTransactionsOrThrow({
        user: userWithProfile,
        receiverUser: userWithProfile,
        amount: transactionData.amount,
        from: transactionData.from,
        to: transactionData.to,
        activeChannelRef: transactionData.activeChannelRef,
        activeNetworkRef: transactionData.activeNetworkRef,
        transferType: transactionData.transferType as unknown as ExchangeChannelType,
        destinationWalletAddress,
        rate: transactionData.rate,
        amountToPayLocal: amountToPayLocal,
        amountToReceiveUSD: amountToReceiveUSD,
        ngnWithdrawalFee: ngnWithdrawalFee,
        providerId: payInRequest.ref,
        totalFee: totalFeeLocal,
        totalFeeUSD: totalFeeUSD,
        transactionReference: transactionReference,
      });

      await this.rateService.validateRateOrThrow(rateId, transactionData.amount, RateTransactionType.SELL);

      if (!jobAccountNumber) {
        throw new BadRequestException('Account number is required for transfer');
      }

      const accountNumber = jobAccountNumber;

      let acceptRequestResponse: ExchangePayInRequest;
      try {
        this.logger.debug(
          `Execute ng to usd exchange: accepting pay in request for transaction ${transactionReference}`,
        );
        acceptRequestResponse = await this.exchangeAdapter.acceptPayInRequest({
          ref: payInRequest.ref,
        });
        console.log(
          '🚀 ~~ ExecuteNgUsdExchangeProcessor ~~ processExecuteNgToUSDExchange ~~ acceptRequestResponse:',
          acceptRequestResponse,
        );

        this.logger.debug(
          `Execute NG => USD exchange: accepted pay in request for transaction ${transactionReference} with response ${JSON.stringify(
            acceptRequestResponse,
          )}`,
        );

        this.logger.debug(
          `Execute NG => USD exchange: sending money to yellowcard for transaction ${transactionReference} with amount ${acceptRequestResponse.convertedAmount} and account number ${accountNumber} and bank info ${JSON.stringify(
            acceptRequestResponse.bankInfo,
          )}`,
        );
        if (isCardFunding) {
          this.logger.log(
            `[NGN_CARD_FUNDING] Step 4 - Exchange Processor: Sending NGN to YellowCard - Amount: ${acceptRequestResponse.convertedAmount} kobo (${CurrencyUtility.formatCurrencyAmountToMainUnit(acceptRequestResponse.convertedAmount, 'NGN')} NGN)`,
          );
        }
        await this.sendMoneyToYellowcard(
          acceptRequestResponse.convertedAmount,
          accountNumber,
          acceptRequestResponse.bankInfo,
          transactionReference,
        );
        if (isCardFunding) {
          this.logger.log(`[NGN_CARD_FUNDING] Step 4 - Exchange Processor: NGN transfer to YellowCard completed`);
        }

        if (isCardFunding) {
          const exchangeTransaction = await this.transactionService.findOne({ reference: transactionReference });
          if (exchangeTransaction) {
            await this.transactionService.updateStatus(
              exchangeTransaction.id,
              TransactionStatus.PENDING,
              {},
              undefined,
              {
                shouldSendEmail: false,
                shouldSendPushNotification: false,
                shouldSendInAppNotification: false,
              },
            );
          }

          if (cardTransactionId && exchangeTransaction) {
            await this.cardTransactionRepository.update(
              { id: cardTransactionId },
              {
                status: CardTransactionStatus.PENDING,
                parent_exchange_transaction_id: exchangeTransaction.id,
              },
            );
          }

          return {
            status: 'processing',
            cardTransactionId,
            exchangeTransactionRef: transactionReference,
            message: 'Exchange and card funding transactions set to pending. Waiting for webhooks.',
          };
        }
      } catch (error) {
        this.logger.error(`Failed to accept pay in request for transaction ${transactionReference}:`, error);
        const transaction = await this.transactionService.findOne({ reference: transactionReference });

        if (transaction?.status === TransactionStatus.COMPLETED || transaction?.status === TransactionStatus.FAILED) {
          this.logger.debug(
            `Execute ng to usd exchange: transaction ${transactionReference} already ${transaction.status}, skipping failure update`,
          );
          return;
        }

        await this.ngToUsdExchangeService.updateSourceTransactionsToFailed(transaction.id, error.message);
        throw new InternalServerErrorException(error.message);
      }
    } catch (error) {
      if (isCardFunding && cardTransactionId) {
        const errorMessage = error.message || 'Unknown error';
        const truncatedReason = errorMessage.length > 255 ? `${errorMessage.substring(0, 252)}...` : errorMessage;
        await this.cardTransactionRepository.update(
          { id: cardTransactionId },
          { status: CardTransactionStatus.DECLINED, declined_reason: truncatedReason },
        );
      }
      throw error;
    }
  }

  private async sendMoneyToYellowcard(
    amount: number,
    senderAccountNumber: string,
    bankInfo: ExchangePayInRequestBankInfo,
    transactionReference: string,
  ) {
    const bankList = await this.waasAdapter.getBankList();
    const bank = bankList.find((bank) => {
      return bank.bankName?.toLowerCase()?.includes(bankInfo.name?.toLowerCase());
    });

    if (!bank) {
      throw new BadRequestException('Bank not found');
    }

    // deduct the funds from the user
    const transaction = await this.transactionService.findOne({ reference: transactionReference });
    const fiatTransaction = await this.fiatWalletTransactionService.findOne({ transaction_id: transaction.id });

    // check if the user has enough balance
    const userWallet = await this.fiatWalletService.getUserWallet(transaction.user_id, transaction.metadata?.from);
    if (!userWallet) {
      throw new BadRequestException('User wallet not found');
    }

    const amountInSmallestUnit = CurrencyUtility.formatCurrencyAmountToSmallestUnit(amount, transaction.metadata?.from);
    const ngWithdrawalFee = await this.ngToUsdExchangeService.calculateNgnWithdrawalFee(amount);
    const amountToWithdrawalTotalInSmallestUnit = add(
      amountInSmallestUnit,
      CurrencyUtility.formatCurrencyAmountToSmallestUnit(ngWithdrawalFee, SUPPORTED_CURRENCIES.NGN.code),
    );

    // Idempotency check: skip deduction if transaction is already completed (retry scenario)
    if (transaction.status === TransactionStatus.COMPLETED) {
      this.logger.debug(
        `Execute NG => USD exchange: transaction ${transactionReference} already completed, skipping fund deduction`,
      );
    } else {
      // this deducts the funds from the user and also moves the money to redis store
      await this.ngToUsdExchangeService.deductFundsFromUser(
        transaction,
        fiatTransaction,
        amountToWithdrawalTotalInSmallestUnit,
      );
    }

    let recieverAccountNumber = bankInfo.accountNumber;

    if (!EnvironmentService.isProduction()) {
      recieverAccountNumber = PAGA_DEVELOPMENT_BANK_ACCOUNT_NUMBER;
    }

    const waasResponse = await this.waasAdapter.transferToOtherBank({
      amount,
      receiver: { accountNumber: recieverAccountNumber, bankCode: bank.nibssBankCode, bankRef: bank.bankRef },
      sender: { accountNumber: senderAccountNumber, bankCode: bank.nibssBankCode },
      transactionReference: transactionReference,
      transactionType: 'INTRA_BANK',
      currency: 'NGN',
      description: 'Exchange of currency',
    });

    const transactionStatus = await this.waasAdapter.getTransactionStatus({
      transactionRef: waasResponse.transactionReference,
    });

    if (transactionStatus.status?.toLowerCase() === WaasTransactionStatus.FAILED.toLowerCase()) {
      this.logger.error(
        `Failed to transfer money to Yellowcard for transaction ${transactionReference}:`,
        transactionStatus,
      );
      throw new BadRequestException('Failed to perform exchange');
    }

    const fee = await this.ngToUsdExchangeService.calculateNgnWithdrawalFee(amount);

    const provider = this.waasAdapter.getProvider();
    if (fee > 0 && provider.getProviderName()?.toLowerCase() === 'paga') {
      await this.createAFeeRecordForTheTransactionForThePagaLedgerAccounts(transaction.user_id, fee);
    }

    return waasResponse;
  }

  private async createAFeeRecordForTheTransactionForThePagaLedgerAccounts(userId: string, fee: number) {
    const reference = UtilsService.generateTransactionReference();
    const currency = SUPPORTED_CURRENCIES.NGN.code;

    // Convert fee to smallest unit (kobo) for bigint columns
    const feeInSmallestUnit = CurrencyUtility.formatCurrencyAmountToSmallestUnit(fee, currency);

    const virtualAccount = await this.virtualAccountService.findOneByUserIdOrThrow(userId);
    const pagaLedgerAccount = await this.pagaLedgerAccountService.findOne({
      account_number: virtualAccount.account_number,
    });

    const balanceBefore = Number(pagaLedgerAccount?.available_balance) || 0;
    const balanceAfter = subtract(balanceBefore, feeInSmallestUnit);

    await this.transactionRepository.transaction(async (trx) => {
      // create a paga ledger account transaction record for the fee
      const pagaLedgerTransaction = await this.pagaLedgerTransactionService.create(
        {
          account_number: virtualAccount.account_number,
          amount: feeInSmallestUnit,
          status: 'PENDING',
          reference_number: reference,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          transaction_type: 'DEBIT',
          currency: currency,
          transaction_reference: reference,
          transaction_id: reference,
          source_account_name: virtualAccount.account_number,
        },
        trx,
      );

      // deduct the fee from the paga ledger account
      await this.pagaLedgerAccountService.updateBalance(
        virtualAccount.account_number,
        -feeInSmallestUnit,
        pagaLedgerTransaction.id,
        trx,
      );
    });
  }

  async queueExecuteNgToUSDExchange(data: ExecuteNgToUSDExchangeJobData) {
    this.registerProcessor();

    return this.queueService.addJob(this.queueName, 'execute-ng-to-usd-exchange', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }
}
