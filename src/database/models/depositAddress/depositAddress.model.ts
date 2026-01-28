import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { UserModel } from '../user/user.model';
import { IDepositAddress } from './depositAddress.interface';
import { DepositAddressValidationSchema } from './depositAddress.validation';

export class DepositAddressModel extends BaseModel implements IDepositAddress {
  public user_id: IDepositAddress['user_id'];
  public provider: IDepositAddress['provider'];
  public asset: IDepositAddress['asset'];
  public address: IDepositAddress['address'];

  public user?: IDepositAddress['user'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.deposit_addresses}`;
  }

  static publicProperty(properties: (keyof IDepositAddress)[] = []): (keyof IDepositAddress)[] {
    return ['id', 'user_id', 'provider', 'asset', 'address', 'created_at', 'updated_at', ...properties];
  }

  static get jsonSchema() {
    return DepositAddressValidationSchema;
  }

  static get relationMappings() {
    return {
      user: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.deposit_addresses}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        },
      },
    };
  }
}
