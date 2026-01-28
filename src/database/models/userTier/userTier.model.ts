import { JSONSchema, RelationMappings } from 'objection';
import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { ITier } from '../tier/tier.interface';
import { TierModel } from '../tier/tier.model';
import { IUser } from '../user/user.interface';
import { UserModel } from '../user/user.model';
import { UserTierValidationSchema } from './userTier.validation';
import { IUserTier } from './userTier.interface';

export class UserTierModel extends BaseModel implements IUserTier {
  public tier_id: IUserTier['tier_id'];
  public user_id: IUserTier['user_id'];

  // relations
  public user?: IUser;
  public tier?: ITier;

  public static get tableName(): string {
    return `${DatabaseSchema.apiService}.${DatabaseTables.user_tiers}`;
  }

  public static get jsonSchema(): JSONSchema {
    return UserTierValidationSchema;
  }

  public static get relationMappings(): RelationMappings {
    return {
      tier: {
        relation: BaseModel.HasOneRelation,
        modelClass: TierModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.user_tiers}.tier_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.tiers}.id`,
        },
      },
      user: {
        relation: BaseModel.HasOneRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.user_tiers}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        },
      },
    };
  }
}
