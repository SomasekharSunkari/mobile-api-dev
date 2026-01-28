import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { ExternalAccountModel } from '../externalAccount/externalAccount.model';
import { UserModel } from '../user/user.model';
import { VirtualAccountModel } from '../virtualAccount';
import { FiatWalletStatus, IFiatWallet } from './fiatWallet.interface';
import { FiatWalletValidationSchema } from './fiatWallet.validation';

export class FiatWalletModel extends BaseModel implements IFiatWallet {
  public user_id: IFiatWallet['user_id'];
  public balance: IFiatWallet['balance'];
  public credit_balance: IFiatWallet['credit_balance'];
  public asset: IFiatWallet['asset'];
  public status: IFiatWallet['status'];
  public virtualAccounts: IFiatWallet['virtualAccounts'];

  public user?: IFiatWallet['user'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.fiat_wallets}`;
  }

  static publicProperty(properties: (keyof IFiatWallet)[] = []): (keyof IFiatWallet)[] {
    return ['id', 'user_id', 'balance', 'credit_balance', 'asset', 'status', 'created_at', 'updated_at', ...properties];
  }

  static get jsonSchema() {
    return FiatWalletValidationSchema;
  }

  static get relationMappings() {
    return {
      user: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.fiat_wallets}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        },
      },
      virtualAccounts: {
        relation: BaseModel.HasManyRelation,
        modelClass: VirtualAccountModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.fiat_wallets}.id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.virtual_accounts}.fiat_wallet_id`,
        },
      },
      externalAccounts: {
        relation: BaseModel.HasManyRelation,
        modelClass: ExternalAccountModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.fiat_wallets}.id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.external_accounts}.fiat_wallet_id`,
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
        query.where('status', FiatWalletStatus.ACTIVE);
      },
    };
  }
}
