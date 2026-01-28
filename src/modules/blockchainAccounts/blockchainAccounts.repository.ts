import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database/base/base.repository';
import { BlockchainAccountModel } from '../../database/models/blockchain_account/blockchain_account.model';
import { BlockchainAccountProvider } from '../../database/models/blockchain_account/blockchain_account.interface';

@Injectable()
export class BlockchainAccountsRepository extends BaseRepository<BlockchainAccountModel> {
  constructor() {
    super(BlockchainAccountModel);
  }

  async findByUserId(userId: string): Promise<BlockchainAccountModel[]> {
    return (await this.model
      .query()
      .where('user_id', userId)
      .modify('notDeleted')
      .orderBy('created_at', 'desc')) as unknown as BlockchainAccountModel[];
  }

  async findByUserIdAndProvider(
    userId: string,
    provider: BlockchainAccountProvider,
  ): Promise<BlockchainAccountModel | null> {
    return (await this.model
      .query()
      .where('user_id', userId)
      .where('provider', provider)
      .modify('notDeleted')
      .first()) as unknown as BlockchainAccountModel | null;
  }

  async findActiveByUserId(userId: string): Promise<BlockchainAccountModel[]> {
    return (await this.model
      .query()
      .where('user_id', userId)
      .modify('active')
      .modify('notDeleted')
      .orderBy('created_at', 'desc')) as unknown as BlockchainAccountModel[];
  }

  async findByProviderRef(providerRef: string): Promise<BlockchainAccountModel | null> {
    return (await this.model
      .query()
      .where('provider_ref', providerRef)
      .modify('notDeleted')
      .first()) as unknown as BlockchainAccountModel | null;
  }
}
