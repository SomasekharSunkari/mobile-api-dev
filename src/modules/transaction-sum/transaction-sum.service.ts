import { Injectable, Inject, Logger } from '@nestjs/common';
import { DateTime } from 'luxon';
import { TransactionStatus } from '../../database/models/transaction/transaction.interface';
import { DateRange, TransactionSumResponse, ITransactionSumService } from './transaction-sum.interface';
import { TransactionSumRepository } from './transaction-sum.repository';

/**
 * TransactionSumService - Asset-based transaction sum service
 *
 * This service calculates transaction sums by asset/currency across all providers.
 * It provides methods to get transaction sums for specific assets without being tied to providers.
 *
 * Architecture:
 * 1. Service methods accept asset parameter directly
 * 2. Repository queries sum transactions by currency across all providers
 * 3. Returns aggregated totals for limit checking and reporting
 *
 * Usage Examples:
 * - this.transactionSum.getPastOneDayTransactionSum('USD', status, userId, trx)
 * - this.transactionSum.getPastOneWeekTransactionSum('NGN', status, userId, trx)
 */
@Injectable()
export class TransactionSumService implements ITransactionSumService {
  private readonly logger = new Logger(TransactionSumService.name);

  @Inject(TransactionSumRepository)
  private readonly transactionSumRepository: TransactionSumRepository;

  /**
   * Get transaction sum for the current day (from 12:00 AM today) for a specific asset
   */
  async getPastOneDayTransactionSum(
    asset: string,
    status: TransactionStatus,
    userId: string,
  ): Promise<TransactionSumResponse> {
    const endDate = DateTime.now();
    const startDate = DateTime.now().startOf('day'); // Reset to 12:00 AM today
    return this.getTransactionSum(
      asset,
      { startDate: startDate.toJSDate(), endDate: endDate.toJSDate() },
      status,
      userId,
    );
  }

  /**
   * Get transaction sum for the current week (from start of week) for a specific asset
   */
  async getPastOneWeekTransactionSum(
    asset: string,
    status: TransactionStatus,
    userId: string,
  ): Promise<TransactionSumResponse> {
    const endDate = DateTime.now();
    const startDate = DateTime.now().startOf('week'); // Reset to start of current week
    return this.getTransactionSum(
      asset,
      { startDate: startDate.toJSDate(), endDate: endDate.toJSDate() },
      status,
      userId,
    );
  }

  /**
   * Get transaction sum for the current month (from start of month) for a specific asset
   */
  async getPastOneMonthTransactionSum(
    asset: string,
    status: TransactionStatus,
    userId: string,
  ): Promise<TransactionSumResponse> {
    const endDate = DateTime.now();
    const startDate = DateTime.now().startOf('month'); // Reset to start of current month
    return this.getTransactionSum(
      asset,
      { startDate: startDate.toJSDate(), endDate: endDate.toJSDate() },
      status,
      userId,
    );
  }

  /**
   * Get transaction sum for a custom date range for a specific asset
   */
  async getPastTransactionSum(
    asset: string,
    dateRange: DateRange,
    status: TransactionStatus,
    userId: string,
  ): Promise<TransactionSumResponse> {
    return this.getTransactionSum(asset, dateRange, status, userId);
  }

  /**
   * Core method that performs the actual transaction sum calculation grouped by transaction type
   *
   * This method calculates sums across all providers for a specific asset/currency.
   * It handles the database query, logging, and response formatting.
   *
   * Flow:
   * 1. Calls repository with asset and parameters
   * 2. Repository queries fiat_wallet_transactions table filtered by currency, grouped by transaction_type
   * 3. Database returns map of transaction types with their aggregated sum and count across all providers
   * 4. Format response with all required fields including asset information
   * 5. Log success/failure for debugging
   *
   * @param asset - Asset/currency to filter transactions by (e.g., 'USD', 'NGN')
   * @param dateRange - Start and end dates for the query
   * @param status - Transaction status to filter by (completed, pending, etc.)
   * @param userId - Required user ID to filter by specific user
   * @returns Formatted transaction sum response with asset information grouped by transaction type
   */
  private async getTransactionSum(
    asset: string,
    dateRange: DateRange,
    status: TransactionStatus,
    userId: string,
  ): Promise<TransactionSumResponse> {
    try {
      // Call repository to get aggregated data from database grouped by transaction type
      // Repository uses Knex to query: SUM(amount), COUNT(id) from transactions
      // joined with fiat_wallet_transactions where currency = {asset} GROUP BY transaction_type
      const byTransactionType = await this.transactionSumRepository.getFiatWalletTransactionSum(
        asset,
        dateRange.startDate,
        dateRange.endDate,
        status,
        userId,
      );

      // Format response with all required fields
      return {
        transactionTypeTotals: byTransactionType, // Map of transaction types to their sum and count
        status, // Status that was queried for
        startDate: dateRange.startDate, // Query start date
        endDate: dateRange.endDate, // Query end date
        userId, // User ID if filtered by user
        asset, // Asset/currency that generated this data
      };
    } catch (error) {
      // Log error with full context for debugging
      this.logger.error(`Failed to get ${asset} fiat wallet transaction sum: ${error.message}`, error.stack);
      throw error; // Re-throw to let caller handle
    }
  }
}
