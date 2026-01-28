import { JSONSchema } from 'objection';
import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { ITierConfig } from '../tierConfig/tierConfig.interface';
import { ITier } from './tier.interface';
import { TierValidationSchema } from './tier.validation';

export class TierModel extends BaseModel implements ITier {
  public name: ITier['name'];
  public level: ITier['level'];
  public description: ITier['description'];
  public status: ITier['status'];

  // relations
  public tierConfigs: ITierConfig[];

  public static get tableName(): string {
    return `${DatabaseSchema.apiService}.${DatabaseTables.tiers}`;
  }

  public static get jsonSchema(): JSONSchema {
    return TierValidationSchema;
  }

  public static relationMappings = {
    tierConfigs: {
      relation: BaseModel.HasManyRelation,
      modelClass: '../models/tierConfig/tierConfig.model',
      join: {
        from: `${DatabaseSchema.apiService}.${DatabaseTables.tiers}.id`,
        to: `${DatabaseSchema.apiService}.${DatabaseTables.tier_configs}.tier_id`,
      },
    },
  };
}
