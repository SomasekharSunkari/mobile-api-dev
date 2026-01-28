import { JSONSchema } from 'objection';
import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { IVirtualAccount } from './virtualAccount.interface';
import { VirtualAccountValidationSchema } from './virtualAccount.validation';

export class VirtualAccountModel extends BaseModel implements IVirtualAccount {
  public user_id: IVirtualAccount['user_id'];
  public fiat_wallet_id: IVirtualAccount['fiat_wallet_id'];
  public account_name: IVirtualAccount['account_name'];
  public account_number: IVirtualAccount['account_number'];
  public bank_name: IVirtualAccount['bank_name'];
  public bank_ref: IVirtualAccount['bank_ref'];
  public routing_number: IVirtualAccount['routing_number'];
  public iban: IVirtualAccount['iban'];
  public provider: IVirtualAccount['provider'];
  public provider_ref: IVirtualAccount['provider_ref'];
  public address: IVirtualAccount['address'];
  public state: IVirtualAccount['state'];
  public city: IVirtualAccount['city'];
  public postal_code: IVirtualAccount['postal_code'];
  public provider_balance: IVirtualAccount['provider_balance'];
  public type: IVirtualAccount['type'];
  public transaction_id: IVirtualAccount['transaction_id'];
  public scheduled_deletion_at: IVirtualAccount['scheduled_deletion_at'];
  public user: IVirtualAccount['user'];
  public fiatWallet: IVirtualAccount['fiatWallet'];

  public static get tableName(): string {
    return `${DatabaseSchema.apiService}.${DatabaseTables.virtual_accounts}`;
  }

  public static get jsonSchema(): JSONSchema {
    return VirtualAccountValidationSchema;
  }

  public static get relationMappings() {
    return {
      user: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: `../models/user`,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.virtual_accounts}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        },
      },
      fiatWallet: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: `../models/fiatWallet`,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.virtual_accounts}.fiat_wallet_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.fiat_wallets}.id`,
        },
      },
    };
  }
}
