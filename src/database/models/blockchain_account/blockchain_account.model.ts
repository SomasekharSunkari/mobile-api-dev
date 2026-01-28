import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { BlockchainWalletModel } from '../blockchain_wallet/blockchain_wallet.model';
import { UserModel } from '../user/user.model';
import { BlockchainAccountStatus, IBlockchainAccount } from './blockchain_account.interface';
import { BlockchainAccountValidationSchema } from './blockchain_account.validation';

export class BlockchainAccountModel extends BaseModel implements IBlockchainAccount {
  public user_id: IBlockchainAccount['user_id'];
  public provider: IBlockchainAccount['provider'];
  public provider_ref: IBlockchainAccount['provider_ref'];
  public status: IBlockchainAccount['status'];
  public rails: IBlockchainAccount['rails'];
  public is_visible: IBlockchainAccount['is_visible'];

  // Relationships
  public user?: IBlockchainAccount['user'];
  public blockchain_wallets?: BlockchainWalletModel[];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.blockchain_accounts}`;
  }

  static publicProperty(properties: (keyof IBlockchainAccount)[] = []): (keyof IBlockchainAccount)[] {
    return [
      'id',
      'user_id',
      'provider',
      'provider_ref',
      'status',
      'rails',
      'is_visible',
      'created_at',
      'updated_at',
      ...properties,
    ];
  }

  static get jsonSchema() {
    return BlockchainAccountValidationSchema;
  }

  static get relationMappings() {
    return {
      user: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.blockchain_accounts}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        },
      },
      blockchain_wallets: {
        relation: BaseModel.HasManyRelation,
        modelClass: BlockchainWalletModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.blockchain_accounts}.id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.blockchain_wallets}.blockchain_account_id`,
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
        query.where('status', BlockchainAccountStatus.ACTIVE);
      },
      forUser(query, userId: string) {
        query.where('user_id', userId);
      },
      forProvider(query, provider: string) {
        query.where('provider', provider);
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
