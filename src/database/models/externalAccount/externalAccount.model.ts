import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { FiatWalletModel } from '../fiatWallet/fiatWallet.model';
import { UserModel } from '../user/user.model';
import { IExternalAccount, IExternalAccountPublic } from './externalAccount.interface';
import { ExternalAccountValidationSchema } from './externalAccount.validation';

export class ExternalAccountModel extends BaseModel implements IExternalAccount {
  public user_id: IExternalAccount['user_id'];
  public fiat_wallet_id: IExternalAccount['fiat_wallet_id'];
  public external_account_ref: IExternalAccount['external_account_ref'];
  public participant_code: IExternalAccount['participant_code'];
  public provider_kyc_status: IExternalAccount['provider_kyc_status'];
  public status: IExternalAccount['status'];
  public provider: IExternalAccount['provider'];

  public linked_provider: IExternalAccount['linked_provider'];
  public linked_item_ref: IExternalAccount['linked_item_ref'];
  public linked_account_ref: IExternalAccount['linked_account_ref'];
  public linked_access_token: IExternalAccount['linked_access_token'];
  public linked_processor_token: IExternalAccount['linked_processor_token'];

  public bank_ref: IExternalAccount['bank_ref'];
  public bank_name: IExternalAccount['bank_name'];
  public account_number: IExternalAccount['account_number'];
  public routing_number: IExternalAccount['routing_number'];
  public nuban: IExternalAccount['nuban'];
  public swift_code: IExternalAccount['swift_code'];

  public expiration_date: IExternalAccount['expiration_date'];
  public capabilities: IExternalAccount['capabilities'];

  public account_name: IExternalAccount['account_name'];
  public account_type: IExternalAccount['account_type'];

  public user: IExternalAccount['user'];
  public fiatWallet: IExternalAccount['fiatWallet'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.external_accounts}`;
  }

  static publicProperty(): (keyof IExternalAccountPublic)[] {
    return [
      'id',
      'user_id',
      'fiat_wallet_id',
      'status',
      'bank_name',
      'account_name',
      'account_number',
      'account_type',
      'expiration_date',
      'created_at',
      'updated_at',
    ];
  }

  static get jsonSchema() {
    return ExternalAccountValidationSchema;
  }

  static get relationMappings() {
    return {
      user: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.external_accounts}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        },
      },
      fiatWallet: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: FiatWalletModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.external_accounts}.fiat_wallet_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.fiat_wallets}.id`,
        },
      },
    };
  }

  static get modifiers() {
    return {
      notDeleted(query) {
        query.whereNull('deleted_at');
      },
    };
  }
}
