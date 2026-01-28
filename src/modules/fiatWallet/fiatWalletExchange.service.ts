import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TransactionStatus, TransactionType, UserModel } from '../../database';
import { FiatWalletTransactionType } from '../../database/models/fiatWalletTransaction/fiatWalletTransaction.interface';
import { ExchangeCancelDto } from './dto/exchange-cancel.dto';
import { FiatWalletService } from './fiatWallet.service';

/**
 * Service handling all exchange/currency conversion operations for fiat wallets.
 * Extends FiatWalletService to inherit base wallet operations.
 */
@Injectable()
export class FiatWalletExchangeService extends FiatWalletService {
  async exchangeCancel(user: UserModel, cancelDto: ExchangeCancelDto) {
    const { transaction_id } = cancelDto;

    this.logger.log(`Processing cancel exchange request for transaction_id: ${transaction_id}`);

    // Use lock service to prevent multiple operations on the same transaction
    const lockKey = `cancel-convert:${user.id}:${transaction_id}`;

    return this.lockerService.withLock(lockKey, async () => {
      try {
        // Find the exchange transaction
        const transaction = await this.transactionRepository.findOne({
          id: transaction_id,
          user_id: user.id,
          transaction_type: TransactionType.EXCHANGE,
        });

        if (!transaction) {
          throw new NotFoundException('Exchange transaction not found');
        }

        // Only allow cancellation of pending transactions
        if (transaction.status !== TransactionStatus.PENDING) {
          throw new BadRequestException(
            `Cannot cancel transaction with status: ${transaction.status}. Only pending transactions can be cancelled.`,
          );
        }

        this.logger.debug(`Found exchange transaction: ${transaction.id} with status: ${transaction.status}`);

        // Find the related source fiat wallet transaction
        const sourceFiatWalletTransaction = await this.fiatWalletTransactionRepository.findOne({
          transaction_id: transaction.id,
          user_id: user.id,
          transaction_type: FiatWalletTransactionType.EXCHANGE,
        });

        if (!sourceFiatWalletTransaction) {
          throw new NotFoundException('Related source fiat wallet transaction not found');
        }

        // Find the destination transaction using parent_transaction_id
        let destinationTransaction = null;
        let destinationFiatWalletTransaction = null;

        try {
          destinationTransaction = await this.transactionRepository.findOne({
            parent_transaction_id: transaction.id,
            user_id: user.id,
            transaction_type: TransactionType.EXCHANGE,
          });

          if (destinationTransaction) {
            // Find the related destination fiat wallet transaction
            destinationFiatWalletTransaction = await this.fiatWalletTransactionRepository.findOne({
              transaction_id: destinationTransaction.id,
              user_id: user.id,
              transaction_type: FiatWalletTransactionType.EXCHANGE,
            });
          }
        } catch (error) {
          // If destination transactions not found, log but continue with cancellation
          this.logger.warn(`Destination transactions not found for exchange ${transaction.id}: ${error.message}`);
        }

        // Get the source currency for validation
        const fromCurrency = transaction.metadata?.from_currency;

        if (!fromCurrency) {
          throw new BadRequestException('Transaction metadata is missing required currency information');
        }

        // Update the main transaction status to cancelled
        const updatedTransaction = await this.transactionRepository.update(transaction.id, {
          status: TransactionStatus.CANCELLED,
          failure_reason: 'Transaction cancelled by user',
        });

        this.logger.log(`Transaction cancelled: ${updatedTransaction.id}`);

        // Update the source fiat wallet transaction status to cancelled
        const updatedSourceFiatWalletTransaction = await this.fiatWalletTransactionRepository.update(
          sourceFiatWalletTransaction.id,
          {
            status: TransactionStatus.CANCELLED,
            failure_reason: 'Transaction cancelled by user',
          },
        );

        this.logger.log(`Source fiat wallet transaction cancelled: ${updatedSourceFiatWalletTransaction.id}`);

        // Cancel destination transactions if they exist
        let updatedDestinationTransaction = null;
        let updatedDestinationFiatWalletTransaction = null;

        if (destinationTransaction) {
          updatedDestinationTransaction = await this.transactionRepository.update(destinationTransaction.id, {
            status: TransactionStatus.CANCELLED,
            failure_reason: 'Exchange cancelled by user',
          });
          this.logger.log(`Destination transaction cancelled: ${updatedDestinationTransaction.id}`);
        }

        if (destinationFiatWalletTransaction) {
          updatedDestinationFiatWalletTransaction = await this.fiatWalletTransactionRepository.update(
            destinationFiatWalletTransaction.id,
            {
              status: TransactionStatus.CANCELLED,
              failure_reason: 'Exchange cancelled by user',
            },
          );
          this.logger.log(
            `Destination fiat wallet transaction cancelled: ${updatedDestinationFiatWalletTransaction.id}`,
          );
        }

        return {
          transaction_id: updatedTransaction.id,
          source_fiat_wallet_transaction_id: updatedSourceFiatWalletTransaction.id,
          destination_transaction_id: updatedDestinationTransaction?.id || null,
          destination_fiat_wallet_transaction_id: updatedDestinationFiatWalletTransaction?.id || null,
          status: TransactionStatus.CANCELLED,
          message: 'Exchange cancelled successfully',
        };
      } catch (error) {
        this.logger.error('Cancel exchange request failed', error);
        throw error;
      }
    });
  }
}
