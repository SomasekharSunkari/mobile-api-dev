import { BadRequestException, Inject, Logger, NotFoundException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { add } from 'mathjs';
import { Transaction } from 'objection';
import { IPaginatedResponse } from '../../database';
import { FiatWalletTransactionType } from '../../database/models/fiatWalletTransaction/fiatWalletTransaction.interface';
import { FiatWalletTransactionModel } from '../../database/models/fiatWalletTransaction/fiatWalletTransaction.model';
import { TransactionStatus } from '../../database/models/transaction';
import { LockerService } from '../../services/locker';
import { FiatWalletRepository } from '../fiatWallet/fiatWallet.repository';
import { CreateFiatTransactionDto } from './dto/createFiatTransaction.dto';
import { FiatWalletTransactionRepository } from './fiatWalletTransactions.repository';

export class FiatWalletTransactionService {
  @Inject(FiatWalletTransactionRepository)
  private readonly fiatWalletTransactionRepository: FiatWalletTransactionRepository;

  @Inject(LockerService)
  private readonly lockerService: LockerService;

  @Inject(FiatWalletRepository)
  private readonly fiatWalletRepository: FiatWalletRepository;

  private readonly logger = new Logger(FiatWalletTransactionService.name);

  public async create(
    userId: string,
    data: CreateFiatTransactionDto,
    trx?: Transaction,
  ): Promise<FiatWalletTransactionModel> {
    const { amount, currency, transaction_id, transaction_type, fiat_wallet_id, status } = data;

    const fiatWallet = await this.fiatWalletRepository.findById(fiat_wallet_id);
    if (!fiatWallet) {
      throw new NotFoundException('Fiat wallet not found');
    }

    try {
      const balanceBefore = data.balance_before ?? Number(fiatWallet.balance);
      const balanceAfter = data.balance_after ?? add(balanceBefore, amount);

      const fiatWalletTransaction = await this.fiatWalletTransactionRepository.create(
        {
          amount,
          currency: currency.toUpperCase(),
          transaction_id,
          transaction_type,
          fiat_wallet_id,
          user_id: userId,
          status: status || TransactionStatus.INITIATED,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          ...data,
        },
        trx,
      );

      return fiatWalletTransaction;
    } catch (error) {
      this.logger.error(`Failed to create fiat wallet transaction: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to create fiat wallet transaction', error);
    }
  }

  async findAll(
    userId: string,
    filters: Partial<{
      page: number;
      limit: number;
      user_id: string;
      fiat_wallet_id: string;
      transaction_id: string;
      transaction_type: FiatWalletTransactionType;
      status: TransactionStatus;
      currency: string;
      provider_reference: string;
    }> = {},
  ): Promise<IPaginatedResponse<FiatWalletTransactionModel>> {
    const query: Record<string, any> = {};

    query.user_id = userId;
    if (filters.fiat_wallet_id) {
      query.fiat_wallet_id = filters.fiat_wallet_id;
    }

    if (filters.transaction_type) {
      query.transaction_type = filters.transaction_type;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.currency) {
      query.currency = filters.currency;
    }

    if (filters.transaction_id) {
      query.transaction_id = filters.transaction_id;
    }

    if (filters.provider_reference) {
      query.provider_reference = filters.provider_reference;
    }

    return this.fiatWalletTransactionRepository.findAll(query, { page: filters.page, limit: filters.limit });
  }

  async findOne(filter: Partial<FiatWalletTransactionModel>): Promise<FiatWalletTransactionModel> {
    const fiatWalletTransaction = await this.fiatWalletTransactionRepository.findOne(filter);

    if (!fiatWalletTransaction) {
      throw new NotFoundException(`Fiat wallet transaction not found`);
    }

    return fiatWalletTransaction;
  }

  /**
   * Find a transaction without throwing NotFoundException if not found
   * Returns null when no record is found - useful for optional lookups
   */
  async findOneOrNull(filter: Partial<FiatWalletTransactionModel>): Promise<FiatWalletTransactionModel | null> {
    return this.fiatWalletTransactionRepository.findOne(filter);
  }

  async findById(id: string): Promise<FiatWalletTransactionModel> {
    const fiatWalletTransaction = await this.fiatWalletTransactionRepository.findById(id);

    if (!fiatWalletTransaction) {
      throw new NotFoundException(`Fiat wallet transaction with ID ${id} not found`);
    }

    return fiatWalletTransaction as FiatWalletTransactionModel;
  }

  async updateStatus(
    id: string,
    status: TransactionStatus,
    metadata?: {
      provider_reference?: string;
      provider_request_ref?: string;
      provider_metadata?: Record<string, any>;
      failure_reason?: string;
    },
    trx?: Transaction,
  ): Promise<FiatWalletTransactionModel> {
    // Use the locker service to ensure only one process can update this transaction at a time
    const lockKey = `fiat-wallet-transaction:${id}:update-status`;

    // Lock will automatically be released when the callback completes or throws an error
    return this.lockerService.withLock(lockKey, async () => {
      // Verify transaction exists and get latest state
      const existingTransaction = await this.fiatWalletTransactionRepository.findById(id, undefined, trx);

      if (!existingTransaction) {
        throw new NotFoundException(`Fiat wallet transaction with id ${id} not found`);
      }

      const currentStatus = existingTransaction.status;

      // Terminal states that cannot be transitioned from (except to same status)
      const terminalStates = [TransactionStatus.COMPLETED, TransactionStatus.FAILED, TransactionStatus.CANCELLED];
      const isCurrentStatusTerminal = terminalStates.includes(currentStatus);

      // Prevent status transitions from terminal states to other states
      // But still allow updating provider_reference and provider_metadata
      if (isCurrentStatusTerminal && currentStatus !== status) {
        this.logger.warn(
          `Ignoring status transition from terminal state ${currentStatus} to ${status} for fiat wallet transaction ${id}`,
        );

        // Fix for out-of-order webhooks: Even when status transition is blocked,
        // we still need to update provider_reference and provider_metadata.
        // Example: If ZeroHash sends "terminated" before "accepted", the transaction
        // becomes "completed" before we can store the trade_id in provider_reference.
        // Without this fix, the account_balance.changed webhook can't find the transaction
        // by trade_id, breaking the reward completion flow.
        const metadataUpdate: Partial<FiatWalletTransactionModel> = {};
        if (metadata?.provider_reference) {
          metadataUpdate.provider_reference = metadata.provider_reference;
        }
        if (metadata?.provider_metadata) {
          metadataUpdate.provider_metadata = metadata.provider_metadata;
        }

        if (Object.keys(metadataUpdate).length > 0) {
          this.logger.log(
            `Updating provider metadata for fiat wallet transaction ${id} despite terminal status ${currentStatus}`,
          );
          return this.fiatWalletTransactionRepository.update(id, metadataUpdate, {
            trx,
          }) as unknown as FiatWalletTransactionModel;
        }

        return existingTransaction as FiatWalletTransactionModel;
      }

      const updateData: Partial<FiatWalletTransactionModel> = { status };

      if (status === TransactionStatus.PROCESSING) {
        updateData.processed_at = DateTime.now().toSQL();
      } else if (status === TransactionStatus.COMPLETED) {
        updateData.completed_at = DateTime.now().toSQL();
      } else if (status === TransactionStatus.FAILED) {
        updateData.failed_at = DateTime.now().toSQL();
        if (metadata?.failure_reason) {
          updateData.failure_reason = metadata.failure_reason;
        }
      } else if (status === TransactionStatus.REVIEW) {
        if (metadata?.failure_reason) {
          updateData.failure_reason = metadata.failure_reason;
        }
      }

      if (metadata?.provider_reference) {
        updateData.provider_reference = metadata.provider_reference;
      }

      if (metadata?.provider_request_ref) {
        updateData.provider_request_ref = metadata.provider_request_ref;
      }

      if (metadata?.provider_metadata) {
        updateData.provider_metadata = metadata.provider_metadata;
      }

      return this.fiatWalletTransactionRepository.update(id, updateData, {
        trx,
      }) as unknown as FiatWalletTransactionModel;
    });
  }
}
