import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database/base/base.repository';
import { BlockchainWalletModel } from '../../database/models/blockchain_wallet/blockchain_wallet.model';

@Injectable()
export class BlockchainWalletRepository extends BaseRepository<BlockchainWalletModel> {
  constructor() {
    super(BlockchainWalletModel);
  }

  async findActiveWalletByUserIdAndAsset(
    userId: string,
    asset: string,
    includeInvisible: boolean = false,
  ): Promise<BlockchainWalletModel> {
    const query = this.query().where('user_id', userId).where('asset', asset).where('status', 'active');

    if (!includeInvisible) {
      query.where('is_visible', true);
    }

    return (await query.first()) as BlockchainWalletModel;
  }

  async findAllActiveWalletsByUserId(
    userId: string,
    includeInvisible: boolean = false,
  ): Promise<BlockchainWalletModel[]> {
    const query = this.query().where('user_id', userId).where('status', 'active');

    if (!includeInvisible) {
      query.where('is_visible', true);
    }

    return query as unknown as BlockchainWalletModel[];
  }

  async batchCreate(wallets: Partial<BlockchainWalletModel>[]): Promise<BlockchainWalletModel[]> {
    return this.model.query().insert(wallets) as unknown as BlockchainWalletModel[];
  }

  async findActiveWalletsByUserIdAndAssets(
    userId: string,
    assetIds: string[],
    rails?: string,
  ): Promise<BlockchainWalletModel[]> {
    const query = this.query().where('user_id', userId).whereIn('asset', assetIds).where('status', 'active');

    if (rails) {
      query.where('rails', rails);
    }

    return query as unknown as BlockchainWalletModel[];
  }

  async findFirstWalletByUserId(userId: string): Promise<BlockchainWalletModel | null> {
    return ((await this.query().where('user_id', userId).first()) as BlockchainWalletModel) || null;
  }

  async findByProviderAccountRef(
    providerAccountRef: string,
    assetId?: string,
    nativeAssetId?: string,
  ): Promise<BlockchainWalletModel | null> {
    const query = this.query().where('provider_account_ref', providerAccountRef);

    if (assetId) {
      query.where('asset', assetId);
    }

    if (nativeAssetId) {
      query.where('base_asset', nativeAssetId);
    }

    return ((await query.first()) as BlockchainWalletModel) || null;
  }

  async findUserWalletById(userId: string, walletId: string): Promise<BlockchainWalletModel | null> {
    return (await this.query().where('id', walletId).where('user_id', userId).first()) as BlockchainWalletModel | null;
  }

  async findWalletByIdWithUser(walletId: string): Promise<BlockchainWalletModel | null> {
    return (await this.query().where('id', walletId).withGraphFetched('user').first()) as BlockchainWalletModel | null;
  }

  async findByAddress(address: string): Promise<BlockchainWalletModel | null> {
    return (await this.query()
      .where('address', address)
      .withGraphFetched('user')
      .first()) as BlockchainWalletModel | null;
  }
}
