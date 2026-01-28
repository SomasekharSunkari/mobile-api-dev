import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database/base/base.repository';
import { BlockchainWalletKeyModel } from '../../database/models/blockchain_wallet_key/blockchain_wallet_key.model';

@Injectable()
export class BlockchainWalletKeyRepository extends BaseRepository<BlockchainWalletKeyModel> {
  constructor() {
    super(BlockchainWalletKeyModel);
  }

  async findByWalletId(walletId: string): Promise<BlockchainWalletKeyModel | null> {
    return ((await this.query().where('blockchain_wallet_id', walletId).first()) as BlockchainWalletKeyModel) || null;
  }

  async findByWalletIdAndNetwork(walletId: string, network: string): Promise<BlockchainWalletKeyModel | null> {
    return (
      ((await this.query()
        .where('blockchain_wallet_id', walletId)
        .where('network', network)
        .first()) as BlockchainWalletKeyModel) || null
    );
  }
}
