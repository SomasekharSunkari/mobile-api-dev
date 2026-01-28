import { Injectable } from '@nestjs/common';
import { BaseRepository, TransactionModel } from '../../database';
import { TransactionStatus } from '../../database/models/transaction/transaction.interface';

@Injectable()
export class TransactionSumRepository extends BaseRepository<TransactionModel> {
  constructor() {
    super(TransactionModel);
  }

  /**
   * Get transaction sum grouped by fiat wallet transaction type for a specific asset/currency
   * Sums across all providers for the given asset
   * Returns a map where keys are fiat wallet transaction types (transfer_in, transfer_out, deposit, etc.)
   */
  async getFiatWalletTransactionSum(
    asset: string,
    startDate: Date,
    endDate: Date,
    status: TransactionStatus,
    userId: string,
  ): Promise<Record<string, { totalSum: number; totalCount: number }>> {
    const results = await this.model
      .knex()
      .select(
        'transaction_type',
        this.model.knex().raw('COALESCE(SUM(amount), 0) as total_sum'),
        this.model.knex().raw('COUNT(id) as total_count'),
      )
      .from('api_service.fiat_wallet_transactions')
      .where('currency', asset)
      .where('status', status)
      .where('user_id', userId)
      .where('created_at', '>=', startDate.toISOString())
      .where('created_at', '<=', endDate.toISOString())
      .whereNull('deleted_at')
      .groupBy('transaction_type');

    // Convert array results to map/record format
    const transactionSumByType: Record<string, { totalSum: number; totalCount: number }> = {};

    for (const result of results) {
      transactionSumByType[result.transaction_type] = {
        totalSum: Number.parseInt(result.total_sum) || 0,
        totalCount: Number.parseInt(result.total_count) || 0,
      };
    }

    return transactionSumByType;
  }
}
