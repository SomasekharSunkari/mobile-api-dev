import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { BlockchainWalletModel } from '../blockchain_wallet/blockchain_wallet.model';
import { IBlockchainWalletKey } from './blockchain_wallet_key.interface';
import { BlockchainWalletKeyValidationSchema } from './blockchain_wallet_key.validation';

export class BlockchainWalletKeyModel extends BaseModel implements IBlockchainWalletKey {
  public blockchain_wallet_id: IBlockchainWalletKey['blockchain_wallet_id'];
  public encrypted_private_key: IBlockchainWalletKey['encrypted_private_key'];
  public encryption_iv: IBlockchainWalletKey['encryption_iv'];
  public network: IBlockchainWalletKey['network'];
  public public_key?: IBlockchainWalletKey['public_key'];
  public key_index: IBlockchainWalletKey['key_index'];

  public blockchain_wallet?: IBlockchainWalletKey['blockchain_wallet'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.blockchain_wallet_keys}`;
  }

  static publicProperty(properties: (keyof IBlockchainWalletKey)[] = []): (keyof IBlockchainWalletKey)[] {
    return [
      'id',
      'blockchain_wallet_id',
      'network',
      'public_key',
      'key_index',
      'created_at',
      'updated_at',
      ...properties,
    ];
  }

  static get jsonSchema() {
    return BlockchainWalletKeyValidationSchema;
  }

  static get relationMappings() {
    return {
      blockchain_wallet: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: BlockchainWalletModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.blockchain_wallet_keys}.blockchain_wallet_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.blockchain_wallets}.id`,
        },
      },
    };
  }

  static get modifiers() {
    return {
      notDeleted(query) {
        query.whereNull('deleted_at');
      },
      forWallet(query, walletId: string) {
        query.where('blockchain_wallet_id', walletId);
      },
      forNetwork(query, network: string) {
        query.where('network', network);
      },
    };
  }
}
