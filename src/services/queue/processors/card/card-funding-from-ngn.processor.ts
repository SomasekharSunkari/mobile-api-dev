import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CardTransactionStatus } from '../../../../database/models/cardTransaction/cardTransaction.interface';
import { NgToUsdExchangeEscrowService } from '../../../../modules/exchange/fiat-exchange/ng-to-usd-exchange.service/ng-to-usd-exchange.escrow.service';
import { VirtualAccountService } from '../../../../modules/virtualAccount/virtualAccount.service';
import { QueueService } from '../../queue.service';
import { ExecuteNgUsdExchangeProcessor } from '../exchange/execute-ng-usd-exchange.processor';
import { CardTransactionRepository } from '../../../../modules/card/repository/cardTransaction.repository';

export interface CardFundingFromNGNJobData {
  cardTransactionId: string;
  exchangeTransactionRef: string;
  userId: string;
  cardId: string;
  ngnAmount: number;
  usdAmount: number;
  netUsdAmount: number;
  cardFeeUSD: number;
  rateId: string;
  depositAddress: string;
}

@Injectable()
export class CardFundingFromNGNProcessor {
  private readonly logger = new Logger(CardFundingFromNGNProcessor.name);
  private readonly queueName = 'card-funding-from-ngn';
  private processorsRegistered = false;

  @Inject(QueueService)
  private readonly queueService: QueueService;

  @Inject(NgToUsdExchangeEscrowService)
  private readonly ngToUsdExchangeEscrowService: NgToUsdExchangeEscrowService;

  @Inject(VirtualAccountService)
  private readonly virtualAccountService: VirtualAccountService;

  @Inject(CardTransactionRepository)
  private readonly cardTransactionRepository: CardTransactionRepository;

  @Inject(ExecuteNgUsdExchangeProcessor)
  private readonly executeNgUsdExchangeProcessor: ExecuteNgUsdExchangeProcessor;

  private registerProcessor() {
    if (this.processorsRegistered) return;

    this.queueService.processJobs<CardFundingFromNGNJobData>(
      this.queueName,
      'card-funding-from-ngn',
      this.processCardFundingFromNGN.bind(this),
      2,
    );

    this.processorsRegistered = true;
    this.logger.log('Card funding from NGN processors registered');
  }

  /**
   * Delegates card funding execution to the NG=>USD exchange processor
   * by queuing a job with card context.
   */
  private async processCardFundingFromNGN(job: Job<CardFundingFromNGNJobData>): Promise<any> {
    const {
      cardTransactionId,
      exchangeTransactionRef,
      userId,
      rateId,
      depositAddress,
      ngnAmount,
      usdAmount,
      netUsdAmount,
      cardFeeUSD,
    } = job.data;

    this.logger.log(
      `[NGN_CARD_FUNDING] Step 3 - Processor: Starting card funding from NGN: cardTransactionId=${cardTransactionId}, exchangeTransactionRef=${exchangeTransactionRef}, userId=${userId}`,
    );
    this.logger.log(
      `[NGN_CARD_FUNDING] Step 3 - Processor: Amounts - NGN: ${ngnAmount} kobo, USD after exchange: ${usdAmount} USD, Net USD: ${netUsdAmount} USD, Card fee: ${cardFeeUSD} USD`,
    );

    this.logger.log(
      `[Step 2] Retrieving transaction data from escrow service for reference: ${exchangeTransactionRef}`,
    );
    const transactionData = await this.ngToUsdExchangeEscrowService.getTransactionData(exchangeTransactionRef);

    if (!transactionData) {
      this.logger.error(
        `[Step 2 Failed] Transaction data not found for reference: ${exchangeTransactionRef}, declining card transaction`,
      );
      await this.cardTransactionRepository.update(
        { id: cardTransactionId },
        { status: CardTransactionStatus.DECLINED, declined_reason: 'Transaction data not found' },
      );
      throw new BadRequestException('Transaction data not found');
    }
    this.logger.log(
      `[Step 2 Success] Transaction data retrieved successfully for reference: ${exchangeTransactionRef}`,
    );

    this.logger.log(`[Step 3] Retrieving virtual account for userId: ${userId}`);
    const virtualAccount = await this.virtualAccountService.findOneByUserIdOrThrow(userId);
    this.logger.log(`[Step 3 Success] Virtual account retrieved: accountNumber=${virtualAccount.account_number}`);

    this.logger.log(
      `[Step 4] Queuing exchange job: transactionReference=${exchangeTransactionRef}, accountNumber=${virtualAccount.account_number}, rateId=${rateId}`,
    );
    await this.executeNgUsdExchangeProcessor.queueExecuteNgToUSDExchange({
      transactionReference: exchangeTransactionRef,
      accountNumber: virtualAccount.account_number,
      rateId,
      userId,
      isCardFunding: true,
      cardTransactionId,
      depositAddress,
    });
    this.logger.log(`[Step 4 Success] Exchange job queued successfully`);

    this.logger.log(`[Step 5] Updating card transaction status to PENDING: cardTransactionId=${cardTransactionId}`);
    await this.cardTransactionRepository.update({ id: cardTransactionId }, { status: CardTransactionStatus.PENDING });
    this.logger.log(`[Step 5 Success] Card transaction status updated to PENDING`);

    this.logger.log(
      `[Complete] Card funding from NGN processing completed: cardTransactionId=${cardTransactionId}, exchangeTransactionRef=${exchangeTransactionRef}`,
    );

    return {
      status: 'queued',
      cardTransactionId,
      exchangeTransactionRef,
      message: 'Card funding execution delegated to exchange processor',
    };
  }

  async queueCardFundingFromNGN(data: CardFundingFromNGNJobData): Promise<Job<CardFundingFromNGNJobData>> {
    this.registerProcessor();

    return this.queueService.addJob(this.queueName, 'card-funding-from-ngn', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }
}
