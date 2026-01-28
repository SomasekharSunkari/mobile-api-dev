import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import { add, divide, multiply } from 'mathjs';
import {
  ExchangeChannelType,
  ExchangePayInRequestBankInfo,
  GetExchangeChannelsResponse,
} from '../../../../adapters/exchange/exchange.interface';
import { WaasTransactionStatus } from '../../../../adapters/waas/waas.adapter.interface';
import { EnvironmentService } from '../../../../config';
import { PAGA_DEVELOPMENT_BANK_ACCOUNT_NUMBER } from '../../../../constants/constants';
import { CurrencyUtility } from '../../../../currencies';
import { TransactionModel, TransactionStatus, UserModel } from '../../../../database';
import {
  ExecuteNewNgUsdExchangeJobData,
  ExecuteNewNgUsdExchangeProcessor,
} from '../../../../services/queue/processors/exchange/execute-new-ng-usd-exchange.processor';
import { UtilsService } from '../../../../utils/utils.service';
import { FiatWalletEscrowService } from '../../../fiatWallet/fiatWalletEscrow.service';
import { ExchangeFiatWalletDto } from '../../dto/exchange-fiat-wallet.dto';
import { NgToUsdExchangeExecutionResponse } from './ng-to-usd-exchange.interface';
import { NgToUsdExchangeService } from './ng-to-usd-exchange.service';

@Injectable()
export class NewNgToUsdExchangeService extends NgToUsdExchangeService {
  private readonly newLogger = new Logger(NewNgToUsdExchangeService.name);

  @Inject(forwardRef(() => ExecuteNewNgUsdExchangeProcessor))
  private readonly executeNewNgUsdExchangeProcessor: ExecuteNewNgUsdExchangeProcessor;

  @Inject(FiatWalletEscrowService)
  public readonly fiatWalletEscrowService: FiatWalletEscrowService;

  async executeExchange(user: UserModel, payload: ExchangeFiatWalletDto): Promise<NgToUsdExchangeExecutionResponse> {
    const userId = user.id;
    this.newLogger.debug(
      `NG=>USD Exchange: Initializing exchange for user ${userId} with payload ${JSON.stringify(payload)}`,
    );

    const lockKey = this.generateLockKey(userId, payload.from, payload.to);
    let parentTransaction: TransactionModel;

    return await this.lockerService.withLock(
      lockKey,
      async () => {
        try {
          // We will validate the rates
          const rate = await this.validateRateIsToBuyDollarOrThrow(payload.rate_id);
          const rateInMainUnit = CurrencyUtility.formatCurrencyAmountToMainUnit(Number(rate.rate), payload.from);
          const userWithProfile = await this.getUserCountryAndProfileOrThrow(userId);

          await this.validateUserLimitsOrThrow(userWithProfile.id, payload.from, payload.amount);

          await this.fiatWalletService.checkIfUserHasEnoughBalanceOrThrow(
            userWithProfile.id,
            payload.amount,
            payload.from,
          );

          // get the rates and the fees from the exchange adapter
          const { activeChannel, activeNetwork } = await this.getActiveDepositChannelOrThrow(
            payload.from,
            userWithProfile,
          );

          await this.validateAmountIsWithinChannelLimitsOrThrow(payload.amount, activeChannel);

          let convertedAmount = divide(payload.amount, rateInMainUnit);

          const destinationWalletAddress = await this.getUserWalletAddressOrFail(userWithProfile);

          // create all related transactions
          const allRelatedTransactions = await this.createAllSourceTransactionsOrThrow({
            user: userWithProfile,
            receiverUser: userWithProfile,
            amount: payload.amount,
            from: payload.from,
            to: payload.to,
            activeChannelRef: activeChannel.ref,
            activeNetworkRef: activeNetwork.ref,
            transferType: activeChannel.rampType as unknown as ExchangeChannelType,
            destinationWalletAddress: destinationWalletAddress.address,
            rate: rate,
            //TODO: These are dummy values for now
            amountToPayLocal: payload.amount,
            amountToReceiveUSD: convertedAmount,
            totalFeeUSD: payload.amount,
            ngnWithdrawalFee: 0,
            totalFee: 0,
            transactionReference: UtilsService.generateTransactionReference(),
            providerId: UtilsService.generateTransactionReference(),
          });

          parentTransaction = allRelatedTransactions.parentTransaction;
          const fiatTransaction = allRelatedTransactions.fiatTransaction;

          // If not production, we use the rate config, to configure the service fee,
          // and the partner fee, so we add it to the converted amount
          if (!EnvironmentService.isProduction()) {
            const rateConfig = await this.rateService.getRate(payload.from, payload.amount);
            const serviceFee = multiply(convertedAmount, divide(rateConfig.service_fee, 100));
            const partnerFee = multiply(convertedAmount, divide(rateConfig.partner_fee, 100));

            convertedAmount = add(convertedAmount, add(serviceFee, partnerFee));
          }

          const jobData: ExecuteNewNgUsdExchangeJobData = {
            localAmount: payload.amount,
            user: userWithProfile,
            parentTransaction,
            activeChannel,
            activeNetwork,
            payload,
            fiatTransaction,
          };

          const job = await this.executeNewNgUsdExchangeProcessor.queueExecuteNewNgUsdExchange(jobData);

          if (!job?.id) {
            throw new InternalServerErrorException('Failed to initiate exchange transaction');
          }

          return {
            status: TransactionStatus.PROCESSING,
            transactionRef: parentTransaction.reference,
            message: 'Exchange in progress',
            jobId: job.id,
          };
        } catch (error) {
          this.newLogger.error(
            `NG=>USD Exchange: Failed to initialize exchange for user ${userId} with payload ${JSON.stringify(payload)}: ${error.message}`,
          );

          if (parentTransaction) {
            await this.updateSourceTransactionsToFailed(parentTransaction.id, error?.message);
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

  async sendMoneyFromCompanyAccountToYellowcard(amount: number, bankInfo: ExchangePayInRequestBankInfo) {
    this.newLogger.debug(
      `Execute NG => USD exchange: sending money to yellowcard for transaction with amount ${amount} and bank info ${JSON.stringify(bankInfo)}`,
    );
    const bankList = await this.waasAdapter.getBankList();
    const bank = bankList.find((bank) => {
      return bank.bankName?.toLowerCase()?.includes(bankInfo.name?.toLowerCase());
    });

    if (!bank) {
      throw new BadRequestException('Bank not found');
    }

    if (!EnvironmentService.isProduction()) {
      bankInfo.accountNumber = PAGA_DEVELOPMENT_BANK_ACCOUNT_NUMBER;
    }

    const transactionReference = UtilsService.generateTransactionReference();

    const waasResponse = await this.waasAdapter.transferToOtherBank({
      amount: amount,
      currency: 'NGN',
      description: 'Exchange of money to Yellowcard',
      transactionReference: transactionReference,
      sender: {
        accountNumber: bankInfo.accountNumber,
        accountName: bankInfo.accountName,
        bankName: bank.bankName,
      },
      receiver: {
        accountNumber: bankInfo.accountNumber,
        bankRef: bank.bankRef,
        accountName: bankInfo.accountName,
      },
      transactionType: 'EXTERNAL_BANK',
    });

    return waasResponse;
  }

  async verifyTransferStatusToYellowcard(transactionReference: string) {
    const transactionStatus = await this.waasAdapter.getTransactionStatus({
      transactionRef: transactionReference,
    });
    return transactionStatus.status === WaasTransactionStatus.SUCCESS;
  }

  private async validateAmountIsWithinChannelLimitsOrThrow(amount: number, activeChannel: GetExchangeChannelsResponse) {
    if (amount < activeChannel.min) {
      throw new BadRequestException(`Amount is less than the minimum amount of ${activeChannel.min}`);
    }

    if (amount > activeChannel.max) {
      throw new BadRequestException(`Amount is greater than the maximum amount of ${activeChannel.max}`);
    }
  }
}
