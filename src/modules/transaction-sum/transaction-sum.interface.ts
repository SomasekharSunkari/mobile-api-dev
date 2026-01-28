import { TransactionStatus } from '../../database/models/transaction/transaction.interface';

/**
 * Transaction sum and count for a specific transaction type
 */
export interface TransactionSumByType {
  totalSum: number;
  totalCount: number;
}

/**
 * Response interface for transaction sum queries grouped by transaction type
 * Returns a map where keys are transaction types (deposit, transfer, etc.)
 */
export interface TransactionSumResponse {
  transactionTypeTotals: Record<string, TransactionSumByType>; // e.g., "deposit" -> {sum, count}
  status: TransactionStatus;
  startDate: Date;
  endDate: Date;
  userId?: string;
  asset: string; // Asset/currency instead of provider
}

/**
 * Date range interface for custom queries
 */
export interface DateRange {
  startDate: Date;
  endDate: Date;
}

/**
 * Interface for asset-based transaction sum service
 * Calculates transaction sums by asset across all providers
 */
export interface ITransactionSumService {
  /**
   * Get transaction sum for the past one day for a specific asset
   */
  getPastOneDayTransactionSum(
    asset: string,
    status: TransactionStatus,
    userId: string,
  ): Promise<TransactionSumResponse>;

  /**
   * Get transaction sum for the past one week for a specific asset
   */
  getPastOneWeekTransactionSum(
    asset: string,
    status: TransactionStatus,
    userId: string,
  ): Promise<TransactionSumResponse>;

  /**
   * Get transaction sum for the past one month for a specific asset
   */
  getPastOneMonthTransactionSum(
    asset: string,
    status: TransactionStatus,
    userId: string,
  ): Promise<TransactionSumResponse>;

  /**
   * Get transaction sum for a custom date range for a specific asset
   */
  getPastTransactionSum(
    asset: string,
    dateRange: DateRange,
    status: TransactionStatus,
    userId: string,
  ): Promise<TransactionSumResponse>;
}
