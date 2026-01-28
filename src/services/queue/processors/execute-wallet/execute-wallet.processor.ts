import { Inject, Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ExternalAccountAdapter } from '../../../../adapters/external-account';
import { TransactionStatus } from '../../../../database/models/transaction';
import { FiatWalletTransactionService } from '../../../../modules/fiatWalletTransactions/fiatWalletTransactions.service';
import { TransactionService } from '../../../../modules/transaction/transaction.service';
import { QueueService } from '../../queue.service';

export interface ExecuteWalletJobData {
  transactionId: string;
  fundingRequest: {
    providerUserRef: string;
    quoteRef: string;
    achSignedAgreement: number;
    externalAccountRef: string;
    description: string;
  };
  countryCode: string;
}

@Injectable()
export class ExecuteWalletProcessor {
  private readonly logger = new Logger(ExecuteWalletProcessor.name);
  private readonly queueName = 'execute-wallet';
  private processorsRegistered = false;

  @Inject(QueueService)
  private readonly queueService: QueueService;
  @Inject(ExternalAccountAdapter)
  private readonly externalAccountAdapter: ExternalAccountAdapter;
  @Inject(TransactionService)
  private readonly transactionService: TransactionService;
  @Inject(FiatWalletTransactionService)
  private readonly fiatWalletTransactionService: FiatWalletTransactionService;

  /**
   * Register queue processors (called when first job is queued)
   */
  private registerProcessors() {
    if (this.processorsRegistered) return;

    this.queueService.processJobs<ExecuteWalletJobData>(
      this.queueName,
      'execute-wallet',
      this.processExecuteWalletTransaction.bind(this),
      2, // Max 2 concurrent execute wallet operations
    );

    this.processorsRegistered = true;
    this.logger.log('Execute wallet processors registered');
  }

  /**
   * Process the execute wallet transaction operation in background
   */
  private async processExecuteWalletTransaction(job: Job<ExecuteWalletJobData>): Promise<any> {
    const { transactionId, fundingRequest, countryCode } = job.data;

    this.logger.log(`Processing execute wallet transaction for transaction ${transactionId}`);

    try {
      // Execute the wallet transaction operation with external provider
      await job.updateProgress(25);
      const fundingResponse = await this.externalAccountAdapter.executePayment(fundingRequest, countryCode);

      this.logger.log(`Wallet transaction executed: ${fundingResponse.transactionRef}`);
      await job.updateProgress(75);

      // Update transaction status based on response
      const newStatus =
        fundingResponse.status === 'submitted' ? TransactionStatus.PROCESSING : TransactionStatus.FAILED;

      console.log('fundingResponse', fundingResponse);

      await this.transactionService.updateStatus(transactionId, newStatus, {
        provider_reference: fundingResponse.transactionRef,
        provider_metadata: {
          funding_response: fundingResponse,
          processed_at: new Date().toISOString(),
        },
      });

      // Update fiat wallet transaction
      try {
        const fiatWalletTransaction = await this.fiatWalletTransactionService.findOne({
          transaction_id: transactionId,
        });

        await this.fiatWalletTransactionService.updateStatus(fiatWalletTransaction.id, newStatus, {
          provider_request_ref: fundingResponse.requestRef,
        });
      } catch (error) {
        this.logger.warn(`Could not update fiat wallet transaction for ${transactionId}:`, error.message);
      }

      await job.updateProgress(100);
      this.logger.log(`Execute wallet transaction completed for transaction ${transactionId}`);

      return {
        status: 'completed',
        transactionId,
        fundingReference: fundingResponse.transactionRef,
      };
    } catch (error) {
      this.logger.error(`Fund wallet failed for transaction ${transactionId}:`, error);

      // Update main transaction status to FAILED
      await this.transactionService.updateStatus(transactionId, TransactionStatus.FAILED, {
        failure_reason: `Fund wallet failed: ${error.message}`,
        provider_metadata: {
          error: error.message,
          failed_at: new Date().toISOString(),
        },
      });

      // Update fiat wallet transaction status to FAILED
      const fiatWalletTransaction = await this.fiatWalletTransactionService.findOne({
        transaction_id: transactionId,
      });

      await this.fiatWalletTransactionService.updateStatus(fiatWalletTransaction.id, TransactionStatus.FAILED, {
        failure_reason: `Fund wallet failed: ${error.message}`,
      });

      throw error;
    }
  }

  /**
   * Queue an execute wallet transaction job
   */
  async queueExecuteWalletTransaction(data: ExecuteWalletJobData): Promise<Job<ExecuteWalletJobData>> {
    // Register processors on first use (when Redis is ready)
    this.registerProcessors();

    return this.queueService.addJob(this.queueName, 'execute-wallet', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }
}
