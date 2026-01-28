import { BadRequestException, forwardRef, Inject, Injectable, Logger } from '@nestjs/common';

import { Job } from 'bullmq';
import { add, subtract } from 'mathjs';
import { ExchangeAdapter } from '../../../../adapters/exchange/exchange.adapter';
import {
  ExchangeChannelType,
  ExchangePayInRequest,
  GetBanksResponse,
  GetExchangeChannelsResponse,
} from '../../../../adapters/exchange/exchange.interface';
import { FiatWalletTransactionModel, TransactionModel, TransactionStatus, UserModel } from '../../../../database';
import { ExchangeFiatWalletDto } from '../../../../modules/exchange/dto/exchange-fiat-wallet.dto';
import { FiatExchangeService } from '../../../../modules/exchange/fiat-exchange/fiat-exchange.service';
import { NewNgToUsdExchangeService } from '../../../../modules/exchange/fiat-exchange/ng-to-usd-exchange.service/new-ng-to-usd-exchange.service';
import { FiatWalletService } from '../../../../modules/fiatWallet/fiatWallet.service';
import { FiatWalletTransactionService } from '../../../../modules/fiatWalletTransactions/fiatWalletTransactions.service';
import { PagaLedgerAccountService } from '../../../../modules/pagaLedgerAccount/pagaLedgerAccount.service';
import { PagaLedgerTransactionService } from '../../../../modules/pagaLedgerTransaction/pagaLedgerTransaction.service';
import { TransactionRepository } from '../../../../modules/transaction/transaction.repository';
import { TransactionService } from '../../../../modules/transaction/transaction.service';
import { QueueService } from '../../queue.service';

export interface ExecuteNewNgUsdExchangeJobData {
  localAmount: number;
  user: UserModel;
  parentTransaction: TransactionModel;
  activeChannel: GetExchangeChannelsResponse;
  activeNetwork: GetBanksResponse;
  payload: ExchangeFiatWalletDto;
  fiatTransaction: FiatWalletTransactionModel;
}

@Injectable()
export class ExecuteNewNgUsdExchangeProcessor {
  private readonly logger = new Logger(ExecuteNewNgUsdExchangeProcessor.name);
  private readonly queueName = 'execute-new-ng-usd-exchange';
  private processorsRegistered = false;

  @Inject(QueueService)
  private readonly queueService: QueueService;

  @Inject(TransactionRepository)
  private readonly transactionRepository: TransactionRepository;

  @Inject(FiatWalletTransactionService)
  private readonly fiatWalletTransactionService: FiatWalletTransactionService;

  @Inject(FiatWalletService)
  private readonly fiatWalletService: FiatWalletService;

  @Inject(TransactionService)
  private readonly transactionService: TransactionService;

  @Inject(forwardRef(() => FiatExchangeService))
  private readonly fiatExchangeService: FiatExchangeService;

  @Inject(forwardRef(() => NewNgToUsdExchangeService))
  private readonly newNgToUsdExchangeService: NewNgToUsdExchangeService;

  @Inject(PagaLedgerAccountService)
  private readonly pagaLedgerAccountService: PagaLedgerAccountService;

  @Inject(PagaLedgerTransactionService)
  private readonly pagaLedgerTransactionService: PagaLedgerTransactionService;

  @Inject(ExchangeAdapter)
  private readonly exchangeAdapter: ExchangeAdapter;

  private registerProcessor() {
    if (this.processorsRegistered) return;

    this.queueService.processJobs<ExecuteNewNgUsdExchangeJobData>(
      this.queueName,
      'execute-new-ng-usd-exchange',
      this.processNewNgUsdExchange.bind(this),
      2, // Max 2 concurrent execute new ng usd exchange operations
    );

    this.processorsRegistered = true;
    this.logger.log('Execute ng to usd exchange processors registered');
  }

  async processNewNgUsdExchange(job: Job<ExecuteNewNgUsdExchangeJobData>): Promise<any> {
    try {
      const { localAmount, user, parentTransaction, activeChannel, activeNetwork, payload, fiatTransaction } = job.data;

      this.logger.debug(`Executing new ng usd exchange for transaction ${parentTransaction.id}`);

      const payInRequest = await this.newNgToUsdExchangeService.createPayInRequest({
        forceAccept: true,
        localAmount: localAmount,
        user,
        parentTransactionId: parentTransaction.id,
        activeChannelRef: activeChannel.ref,
        activeNetworkRef: activeNetwork.ref,
        transferType: activeChannel.rampType as unknown as ExchangeChannelType,
        fromCurrency: parentTransaction.metadata.from_currency_code,
      });
      console.log('🚀 ~~ ExecuteNewNgUsdExchangeProcessor ~~ processNewNgUsdExchange ~~ payInRequest:', payInRequest);

      // update the transaction metadata with the usd amount and local amount
      await this.updateTransactionMetadataUsdAmountAndLocalAmount(
        parentTransaction,
        payInRequest,
        payload,
        localAmount,
      );

      // update all the source transactions to pending and the amount
      await this.updateAllSourceTransactionsAndFiatTransactionToPending(parentTransaction, fiatTransaction);

      const sendMoneyToYellowcardResponse =
        await this.newNgToUsdExchangeService.sendMoneyFromCompanyAccountToYellowcard(
          payInRequest.convertedAmount,
          payInRequest.bankInfo,
        );

      // verity the status of the transfer
      const tranferStatus = await this.newNgToUsdExchangeService.verifyTransferStatusToYellowcard(
        sendMoneyToYellowcardResponse.transactionReference,
      );

      if (!tranferStatus) {
        await this.exchangeAdapter.cancelPayInRequest({
          ref: payInRequest.ref,
        });
        throw new BadRequestException('Transfer to Yellowcard failed');
      }

      // update the balance and mark all transactions to pending
      await this.updateAllTransactionsToPending(parentTransaction, fiatTransaction);

      const totalFeeLocal = add(payInRequest.feeLocal, payInRequest.networkFeeLocal, payInRequest.partnerFeeLocal);
      const totalFeeUSD = add(payInRequest.feeUSD, payInRequest.networkFeeUSD, payInRequest.partnerFeeUSD);
      const amountToReceiveUSD = Number(payInRequest.receiverCryptoInfo.cryptoAmount);
      const amountToPayLocal = subtract(payload.amount, totalFeeLocal);

      await this.newNgToUsdExchangeService.updateTransactionsWithFees(
        parentTransaction,
        fiatTransaction,
        totalFeeLocal,
        totalFeeUSD,
        amountToReceiveUSD,
        amountToPayLocal,
        0,
      );
    } catch (error) {
      await this.newNgToUsdExchangeService.updateSourceTransactionsToFailed(
        job.data.parentTransaction.id,
        error.message,
      );
      throw new BadRequestException(error.message);
    }
  }

  async queueExecuteNewNgUsdExchange(data: ExecuteNewNgUsdExchangeJobData) {
    this.registerProcessor();

    return this.queueService.addJob(this.queueName, 'execute-new-ng-usd-exchange', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }

  async updateAllSourceTransactionsAndFiatTransactionToPending(
    parentTransaction: TransactionModel,
    fiatTransaction: FiatWalletTransactionModel,
  ) {
    this.logger.debug(
      `Execute NG => USD exchange: Updating all source transactions and fiat transaction to pending for transaction ${parentTransaction.id}`,
    );
    await this.transactionRepository.transaction(async (trx) => {
      await this.transactionService.updateStatus(parentTransaction.id, TransactionStatus.PENDING, {}, trx);
      await this.fiatWalletTransactionService.updateStatus(fiatTransaction.id, TransactionStatus.PENDING, {}, trx);
    });
  }

  async updateAllSourceTransactionsToSuccessful(
    parentTransaction: TransactionModel,
    fiatTransaction: FiatWalletTransactionModel,
  ) {
    this.logger.debug(
      `Execute NG => USD exchange: Updating all transactions to successful for transaction ${parentTransaction.id}`,
    );

    await this.transactionRepository.transaction(async (trx) => {
      // Mark Parent Transaction to Successful
      await this.transactionService.updateStatus(parentTransaction.id, TransactionStatus.COMPLETED, {}, trx, {
        shouldSendEmail: false,
        shouldSendPushNotification: false,
        shouldSendInAppNotification: false,
      });
      await this.fiatWalletTransactionService.updateStatus(fiatTransaction.id, TransactionStatus.COMPLETED, {}, trx);
    });
  }

  async updateAllTransactionsToPending(
    parentTransaction: TransactionModel,
    fiatTransaction: FiatWalletTransactionModel,
  ) {
    this.logger.debug(
      `Execute NG => USD exchange: Updating balance and marking all transactions to pending for transaction ${parentTransaction.id}`,
    );
    await this.transactionRepository.transaction(async (trx) => {
      await this.transactionService.updateStatus(parentTransaction.id, TransactionStatus.PENDING, {}, trx);
      await this.fiatWalletTransactionService.updateStatus(fiatTransaction.id, TransactionStatus.PENDING, {}, trx);
    });
  }

  async updateTransactionMetadataUsdAmountAndLocalAmount(
    parentTransaction: TransactionModel,
    payInRequest: ExchangePayInRequest,
    payload: ExchangeFiatWalletDto,
    convertedAmount: number,
  ) {
    await this.transactionRepository.update(parentTransaction.id, {
      external_reference: payInRequest.ref,
      metadata: { ...parentTransaction.metadata, usd_amount: convertedAmount, local_amount: payload.amount },
    });
  }
}
