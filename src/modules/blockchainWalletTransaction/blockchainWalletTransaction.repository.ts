import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database/base/base.repository';
import { BlockchainWalletTransactionModel } from '../../database/models/blockchain_wallet_transaction/blockchain_wallet_transaction.model';
import { GetUserTransactionsDto } from './dto/get-user-transactions.dto';

@Injectable()
export class BlockchainWalletTransactionRepository extends BaseRepository<BlockchainWalletTransactionModel> {
  constructor() {
    super(BlockchainWalletTransactionModel);
  }

  async findByUserIdWithFilters(id: string, filters: GetUserTransactionsDto = {}, useWalletId: boolean) {
    const query = this.model
      .query()
      .select(`${this.model.tableName}.*`)
      .leftJoin(
        'api_service.blockchain_wallets as peer_wallet',
        'peer_wallet.id',
        `${this.model.tableName}.peer_wallet_id`,
      )
      .leftJoin('api_service.users as peer_user', 'peer_user.id', 'peer_wallet.user_id')
      .select(this.model.raw("peer_user.first_name || ' ' || peer_user.last_name as peer_user_name"))
      .orderBy(`${this.model.tableName}.created_at`, 'desc');

    if (useWalletId) {
      query.where('blockchain_wallet_id', id);
    } else {
      query
        .join(
          'api_service.blockchain_wallets as user_wallet',
          'user_wallet.id',
          `${this.model.tableName}.blockchain_wallet_id`,
        )
        .where('user_wallet.user_id', id);
    }

    if (filters && filters.type) {
      query.where(`${this.model.tableName}.type`, filters.type);
    }

    if (filters && filters.status) {
      query.where(`${this.model.tableName}.status`, filters.status);
    }

    if (filters && filters.transaction_scope) {
      query.where(`${this.model.tableName}.transaction_scope`, filters.transaction_scope);
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const { results, total } = await query.page(page - 1, limit);
    const pageCount = Math.ceil(total / limit);
    return {
      data: results,
      pagination: {
        total,
        page,
        limit,
        pageCount,
      },
    };
  }

  async findFirstPendingByUserId(walletId: string): Promise<BlockchainWalletTransactionModel | null> {
    return (await this.query()
      .where('blockchain_wallet_id', walletId)
      .modify('pending')
      .first()) as unknown as BlockchainWalletTransactionModel | null;
  }

  async findByProviderReference(providerReference: string): Promise<BlockchainWalletTransactionModel | null> {
    return (await this.query()
      .where('provider_reference', providerReference)
      .first()) as unknown as BlockchainWalletTransactionModel | null;
  }

  async findByTransactionHash(txHash: string): Promise<BlockchainWalletTransactionModel | null> {
    return (await this.query().where('tx_hash', txHash).first()) as unknown as BlockchainWalletTransactionModel | null;
  }
}
