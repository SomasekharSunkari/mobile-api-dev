import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { BaseRepository } from '../../database/base/base.repository';
import { FiatWalletTransactionModel } from '../../database/models/fiatWalletTransaction/fiatWalletTransaction.model';

@Injectable()
export class FiatWalletTransactionRepository extends BaseRepository<FiatWalletTransactionModel> {
  constructor() {
    super(FiatWalletTransactionModel);
  }

  /**
   * Find a fiat wallet transaction by its idempotency key
   *
   * Purpose:
   * - Check if a transaction with the given idempotency key already exists
   * - Enables idempotent withdrawal operations by preventing duplicate processing
   * - Used before creating new withdrawal transactions to detect retries
   *
   * @param idempotencyKey - The unique idempotency key for the transaction
   * @returns The matching fiat wallet transaction or null if not found
   *
   * Security Benefits:
   * - Prevents duplicate withdrawals from network retries
   * - Enables safe retry of failed requests without double-processing
   * - Provides fast lookup using indexed column for performance
   */
  async findByIdempotencyKey(idempotencyKey: string): Promise<FiatWalletTransactionModel | null> {
    return (
      ((await this.query().where('idempotency_key', idempotencyKey).first()) as FiatWalletTransactionModel) || null
    );
  }

  /**
   * Find a fiat wallet transaction by user ID and idempotency key
   *
   * Purpose:
   * - Provides an additional security layer by scoping idempotency checks to specific users
   * - Ensures that idempotency keys are isolated per user
   * - Prevents potential cross-user idempotency key conflicts
   *
   * @param userId - The ID of the user who owns the transaction
   * @param idempotencyKey - The unique idempotency key for the transaction
   * @returns The matching fiat wallet transaction or null if not found
   *
   * Security Benefits:
   * - Prevents users from using another user's idempotency key
   * - Adds user-specific isolation to idempotency checks
   * - Uses composite index for optimal query performance
   */
  async findByUserIdAndIdempotencyKey(
    userId: string,
    idempotencyKey: string,
  ): Promise<FiatWalletTransactionModel | null> {
    return (
      ((await this.query()
        .where('user_id', userId)
        .where('idempotency_key', idempotencyKey)
        .first()) as FiatWalletTransactionModel) || null
    );
  }

  /**
   * Count pending transactions for a user by transaction type
   *
   * Purpose:
   * - Count transactions where settled_at is null (not yet settled by provider)
   * - Used to enforce maximum pending deposit/withdrawal count limits for US users
   * - Limits are per currency to ensure USD and NGN transactions are counted separately
   *
   * @param userId - The ID of the user
   * @param transactionType - The type of transaction (deposit, withdrawal, etc.)
   * @param currency - The currency code (USD, NGN, etc.)
   * @returns The count of pending transactions
   */
  async countPendingByUserAndType(userId: string, transactionType: string, currency: string): Promise<number> {
    const result = (await this.query()
      .where('user_id', userId)
      .where('transaction_type', transactionType)
      .where('currency', currency)
      .whereNull('settled_at')
      .whereNotIn('status', ['failed', 'cancelled'])
      .count('id as count')
      .first()) as unknown as { count: string } | undefined;

    return Number(result?.count || 0);
  }

  /**
   * Count transactions for a user by type in the past week (rolling 7 days)
   *
   * Purpose:
   * - Count successful transactions created in the last 7 days
   * - Used to enforce weekly transaction count limits for US users
   * - Limits are per currency to ensure USD and NGN transactions are counted separately
   *
   * @param userId - The ID of the user
   * @param transactionType - The type of transaction (deposit, withdrawal, etc.)
   * @param currency - The currency code (USD, NGN, etc.)
   * @returns The count of transactions in the past week
   */
  async countTransactionsByTypeInPastWeek(userId: string, transactionType: string, currency: string): Promise<number> {
    const oneWeekAgo = DateTime.now().minus({ days: 7 }).toJSDate();

    const result = (await this.query()
      .where('user_id', userId)
      .where('transaction_type', transactionType)
      .where('currency', currency)
      .where('created_at', '>=', oneWeekAgo)
      .whereNotIn('status', ['failed', 'cancelled'])
      .count('id as count')
      .first()) as unknown as { count: string } | undefined;

    return Number(result?.count || 0);
  }
}
