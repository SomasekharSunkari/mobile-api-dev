import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { UserModel } from '../user/user.model';
import { BlockchainAccountModel } from '../blockchain_account/blockchain_account.model';
import { BlockchainWalletStatus, IBlockchainWallet, BlockchainWalletRails } from './blockchain_wallet.interface';
import { BlockchainWalletValidationSchema } from './blockchain_wallet.validation';

export class BlockchainWalletModel extends BaseModel implements IBlockchainWallet {
  public user_id: IBlockchainWallet['user_id'];
  public blockchain_account_id?: IBlockchainWallet['blockchain_account_id'];
  public provider_account_ref: IBlockchainWallet['provider_account_ref'];
  public provider: IBlockchainWallet['provider'];
  public asset: IBlockchainWallet['asset'];
  public name: IBlockchainWallet['name'];
  public base_asset: IBlockchainWallet['base_asset'];
  public address: IBlockchainWallet['address'];
  public balance: IBlockchainWallet['balance'];
  public status: IBlockchainWallet['status'];
  public network?: IBlockchainWallet['network'];
  public rails?: IBlockchainWallet['rails'];
  public decimal?: IBlockchainWallet['decimal'];
  public is_visible: IBlockchainWallet['is_visible'];

  public user?: IBlockchainWallet['user'];
  public blockchain_account?: IBlockchainWallet['blockchain_account'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.blockchain_wallets}`;
  }

  static publicProperty(properties: (keyof IBlockchainWallet)[] = []): (keyof IBlockchainWallet)[] {
    return [
      'id',
      'user_id',
      'provider_account_ref',
      'provider',
      'asset',
      'base_asset',
      'address',
      'balance',
      'name',
      'status',
      'network',
      'rails',
      'decimal',
      'is_visible',
      'created_at',
      'updated_at',
      ...properties,
    ];
  }

  static get jsonSchema() {
    return BlockchainWalletValidationSchema;
  }

  static get relationMappings() {
    return {
      user: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.blockchain_wallets}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        },
      },
      blockchain_account: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: BlockchainAccountModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.blockchain_wallets}.blockchain_account_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.blockchain_accounts}.id`,
        },
      },
    };
  }

  static get modifiers() {
    return {
      notDeleted(query) {
        query.whereNull('deleted_at');
      },
      active(query) {
        query.where('status', BlockchainWalletStatus.ACTIVE);
      },
      forUser(query, userId: string) {
        query.where('user_id', userId);
      },
      remittance(query) {
        query.where('rails', BlockchainWalletRails.REMITTANCE);
      },
      crypto(query) {
        query.where('rails', BlockchainWalletRails.CRYPTO);
      },
      visible(query) {
        query.where('is_visible', true);
      },
      invisible(query) {
        query.where('is_visible', false);
      },
    };
  }
}
