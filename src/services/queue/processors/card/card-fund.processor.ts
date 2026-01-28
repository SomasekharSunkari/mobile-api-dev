import { Inject, Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { add } from 'mathjs';
import { createHash } from 'node:crypto';
import { EnvironmentService } from '../../../../config/environment/environment.service';
import { FIREBLOCKS_ASSET_ID } from '../../../../constants/constants';
import { CurrencyUtility } from '../../../../currencies/currencies';
import { CardTransactionStatus } from '../../../../database/models/cardTransaction/cardTransaction.interface';
import { UserModel } from '../../../../database/models/user/user.model';
import { BlockchainWalletService } from '../../../../modules/blockchainWallet/blockchainWallet.service';
import { CardFundRails } from '../../../../modules/card/dto/cardFund.dto';
import { CardTransactionRepository } from '../../../../modules/card/repository/cardTransaction.repository';
import { DepositAddressService } from '../../../../modules/depositAddress/depositAddress.service';
import { FiatWalletService } from '../../../../modules/fiatWallet/fiatWallet.service';
import { FiatWalletWithdrawalService } from '../../../../modules/fiatWallet/fiatWalletWithdrawal.service';
import { QueueService } from '../../queue.service';

export interface CardFundingJobData {
  cardTransactionId: string;
  userId: string;
  cardId: string;
  amount: number;
  fee: number;
  rail: CardFundRails;
  cardLastFourDigits?: string;
}

@Injectable()
export class CardFundingProcessor {
  private readonly logger = new Logger(CardFundingProcessor.name);
  private readonly queueName = 'card-funding';
  private processorsRegistered = false;

  private readonly ENABLE_FIAT_RAIL_BLOCKCHAIN_MIRROR = false;

  @Inject(QueueService)
  private readonly queueService: QueueService;

  @Inject(CardTransactionRepository)
  private readonly cardTransactionRepository: CardTransactionRepository;

  @Inject(DepositAddressService)
  private readonly depositAddressService: DepositAddressService;

  @Inject(FiatWalletService)
  private readonly fiatWalletService: FiatWalletService;

  @Inject(FiatWalletWithdrawalService)
  private readonly fiatWalletWithdrawalService: FiatWalletWithdrawalService;

  @Inject(BlockchainWalletService)
  private readonly blockchainWalletService: BlockchainWalletService;

  /**
   * Register queue processors (called when first job is queued)
   */
  private registerProcessors() {
    if (this.processorsRegistered) return;

    this.queueService.processJobs<CardFundingJobData>(
      this.queueName,
      'card-funding',
      this.processCardFunding.bind(this),
      3, // Max 3 concurrent card funding operations
    );

    this.processorsRegistered = true;
    this.logger.log('Card funding processors registered');
  }

  /**
   * Generate an idempotency key from cardTransactionId that doesn't exceed 40 characters
   */
  private generateIdempotencyKey(prefix: string, cardTransactionId: string): string {
    const hash = createHash('sha256').update(cardTransactionId).digest('hex').substring(0, 16);
    const key = `${prefix}-${hash}`;
    return key.length > 40 ? key.substring(0, 40) : key;
  }

  /**
   * Process the card funding operation in background
   */
  private async processCardFunding(job: Job<CardFundingJobData>): Promise<any> {
    const { cardTransactionId, userId, cardId, amount, fee, rail, cardLastFourDigits } = job.data;

    this.logger.log(
      `[CARD_FUNDING_PROCESSOR] Processing card funding: transactionId=${cardTransactionId}, userId=${userId}, cardId=${cardId}, amount=${amount} USD, fee=${fee} USD, rail=${rail}`,
    );

    try {
      const user = await UserModel.query().findById(userId);

      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      await job.updateProgress(10);

      // Get Rain deposit address for the default chain
      const rainDepositAddress = await this.depositAddressService.getRainDepositAddressForDefaultChain(user);

      if (!rainDepositAddress) {
        throw new Error(
          'No Rain deposit address found for user. Please ensure you have a Rain deposit address set up.',
        );
      }

      await job.updateProgress(25);

      switch (rail) {
        case CardFundRails.FIAT: {
          this.logger.log('Initiating fiat wallet funding for card via Rain deposit address');

          // Calculate total amount (amount + fee)
          const totalAmount = add(amount, fee);

          // Check if user has sufficient USD balance
          const usdWallet = await this.fiatWalletService.getUserWallet(userId, 'USD');
          const totalAmountInCents = CurrencyUtility.formatCurrencyAmountToSmallestUnit(totalAmount, 'USD');
          const walletBalance = Number(usdWallet.balance);

          if (walletBalance < totalAmountInCents) {
            throw new Error(
              `Insufficient balance in USD fiat wallet: required ${totalAmountInCents} cents, available ${walletBalance} cents`,
            );
          }

          await job.updateProgress(50);

          const transferResult = await this.fiatWalletWithdrawalService.transferUSDToRainDepositAddress(user, {
            amount: amount,
            fee: fee,
            asset: 'USD',
            rain_deposit_address: rainDepositAddress.address,
            card_last_four_digits: cardLastFourDigits,
          });

          this.logger.log(
            `[CARD_FUNDING_PROCESSOR] Fiat wallet transfer initiated: senderTransactionId=${transferResult.senderTransactionId}, amount=${totalAmount} USD (amount: ${amount} USD + fee: ${fee} USD), to Rain address=${rainDepositAddress.address}`,
          );

          await job.updateProgress(75);

          if (
            this.ENABLE_FIAT_RAIL_BLOCKCHAIN_MIRROR &&
            (EnvironmentService.isStaging() || EnvironmentService.isDevelopment())
          ) {
            this.logger.log(
              'Non-production environment detected; initiating additional blockchain funding from test wallet after fiat transfer',
            );

            const transactionResult = await this.blockchainWalletService.sendFromMasterVaultToAddress({
              amount: totalAmount,
              destinationAddress: rainDepositAddress.address,
              note: `Card funding (fiat rail mirror) for card ${cardId}`,
              idempotencyKey: this.generateIdempotencyKey('cf-fiat', cardTransactionId),
              assetId: 'USDC_BASECHAIN_ETH_TEST5_8SH8',
            });

            this.logger.log(
              `Blockchain transaction (fiat rail mirror) initiated: ${transactionResult.transactionId} to Rain address: ${rainDepositAddress.address}`,
            );
          }

          await job.updateProgress(100);
          break;
        }
        case CardFundRails.BLOCKCHAIN: {
          this.logger.log('Initiating blockchain wallet funding for card');

          // Calculate total amount (amount + fee)
          const totalAmount = add(amount, fee);

          await job.updateProgress(50);

          // Use initiateTransaction with peer address for external transfer to Rain deposit address
          const transactionResult = await this.blockchainWalletService.initiateTransaction(user, {
            type: 'external',
            asset_id: FIREBLOCKS_ASSET_ID,
            amount: totalAmount,
            peer_address: rainDepositAddress.address,
            note: `Card funding for card ${cardId}`,
            idempotencyKey: this.generateIdempotencyKey('cf-bc', cardTransactionId),
          });

          this.logger.log(
            `Blockchain transaction initiated: ${transactionResult.transactionId}, amount=${totalAmount} USD (amount: ${amount} USD + fee: ${fee} USD) to Rain address: ${rainDepositAddress.address}`,
          );

          await job.updateProgress(100);
          break;
        }
        default: {
          throw new Error('Unsupported funding rails');
        }
      }

      this.logger.log(`Card funding completed for transaction ${cardTransactionId}`);

      return {
        status: 'completed',
        cardTransactionId,
        cardId,
        amount,
        rail,
      };
    } catch (error) {
      this.logger.error(`Failed to process card funding for transaction ${cardTransactionId}: ${error.message}`, error);

      // Truncate error message to 255 characters to fit database column
      const errorMessage = error.message || 'Unknown error';
      const truncatedReason = errorMessage.length > 255 ? errorMessage.substring(0, 252) + '...' : errorMessage;

      // Update transaction status to failed
      await this.cardTransactionRepository.update(
        { id: cardTransactionId },
        { status: CardTransactionStatus.DECLINED, declined_reason: truncatedReason },
      );

      throw error;
    }
  }

  /**
   * Queue a card funding job
   */
  async queueCardFunding(data: CardFundingJobData): Promise<Job<CardFundingJobData>> {
    // Register processors on first use (when Redis is ready)
    this.registerProcessors();

    return this.queueService.addJob(this.queueName, 'card-funding', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }
}
