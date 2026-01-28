import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { UserModel } from '../user/user.model';
import { IBlockchainBeneficiary } from './blockchainBeneficiary.interface';
import { BlockchainBeneficiaryValidationSchema } from './blockchainBeneficiary.validation';

export class BlockchainBeneficiaryModel extends BaseModel implements IBlockchainBeneficiary {
  public user_id: IBlockchainBeneficiary['user_id'];
  public beneficiary_user_id: IBlockchainBeneficiary['beneficiary_user_id'];
  public alias_name?: IBlockchainBeneficiary['alias_name'];
  public asset?: IBlockchainBeneficiary['asset'];
  public address?: IBlockchainBeneficiary['address'];
  public network?: IBlockchainBeneficiary['network'];
  public avatar_url?: IBlockchainBeneficiary['avatar_url'];

  public user?: IBlockchainBeneficiary['user'];
  public beneficiaryUser?: IBlockchainBeneficiary['beneficiaryUser'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.blockchain_beneficiaries}`;
  }

  static publicProperty(properties: (keyof IBlockchainBeneficiary)[] = []): (keyof IBlockchainBeneficiary)[] {
    return [
      'id',
      'user_id',
      'beneficiary_user_id',
      'alias_name',
      'asset',
      'address',
      'network',
      'avatar_url',
      'created_at',
      'updated_at',
      ...properties,
    ];
  }

  static get jsonSchema() {
    return BlockchainBeneficiaryValidationSchema;
  }

  static get relationMappings() {
    return {
      user: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.blockchain_beneficiaries}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        },
      },
      beneficiaryUser: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.blockchain_beneficiaries}.beneficiary_user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
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
