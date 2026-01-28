import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database/base/base.repository';
import { BlockchainGasFundTransactionModel } from '../../database/models/blockchain_gas_fund_transaction/blockchain_gas_fund_transaction.model';
import { TransactionStatus } from '../../database/models/transaction';

@Injectable()
export class BlockchainGasFundTransactionRepository extends BaseRepository<BlockchainGasFundTransactionModel> {
  constructor() {
    super(BlockchainGasFundTransactionModel);
  }

  async findByUser(userId: string): Promise<BlockchainGasFundTransactionModel[]> {
    return this.query()
      .where('user_id', userId)
      .orderBy('created_at', 'desc') as unknown as BlockchainGasFundTransactionModel[];
  }

  async findByWallet(walletId: string): Promise<BlockchainGasFundTransactionModel[]> {
    return this.query()
      .where('blockchain_wallet_id', walletId)
      .orderBy('created_at', 'desc') as unknown as BlockchainGasFundTransactionModel[];
  }

  async findByStatus(status: TransactionStatus): Promise<BlockchainGasFundTransactionModel[]> {
    return this.query()
      .where('status', status)
      .orderBy('created_at', 'desc') as unknown as BlockchainGasFundTransactionModel[];
  }

  async findByProviderReference(providerReference: string): Promise<BlockchainGasFundTransactionModel | null> {
    return (
      ((await this.query()
        .where('provider_reference', providerReference)
        .first()) as BlockchainGasFundTransactionModel) || null
    );
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<BlockchainGasFundTransactionModel | null> {
    return (
      ((await this.query().where('idempotency_key', idempotencyKey).first()) as BlockchainGasFundTransactionModel) ||
      null
    );
  }

  async findByUserAndWallet(userId: string, walletId: string): Promise<BlockchainGasFundTransactionModel[]> {
    return this.query()
      .where('user_id', userId)
      .where('blockchain_wallet_id', walletId)
      .orderBy('created_at', 'desc') as unknown as BlockchainGasFundTransactionModel[];
  }

  async findPendingByUser(userId: string): Promise<BlockchainGasFundTransactionModel[]> {
    return this.query()
      .where('user_id', userId)
      .where('status', TransactionStatus.PENDING)
      .orderBy('created_at', 'desc') as unknown as BlockchainGasFundTransactionModel[];
  }

  async findFirstPendingByUser(userId: string): Promise<BlockchainGasFundTransactionModel | null> {
    return (
      ((await this.query()
        .where('user_id', userId)
        .where('status', TransactionStatus.PENDING)
        .orderBy('created_at', 'desc')
        .first()) as BlockchainGasFundTransactionModel) || null
    );
  }
}
