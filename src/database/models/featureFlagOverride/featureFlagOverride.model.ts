import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { FeatureFlagModel } from '../featureFlag/featureFlag.model';
import { UserModel } from '../user/user.model';
import { IFeatureFlagOverride } from './featureFlagOverride.interface';
import { FeatureFlagOverrideValidationSchema } from './featureFlagOverride.validation';

export class FeatureFlagOverrideModel extends BaseModel implements IFeatureFlagOverride {
  public feature_flag_id: IFeatureFlagOverride['feature_flag_id'];
  public user_id: IFeatureFlagOverride['user_id'];
  public enabled: IFeatureFlagOverride['enabled'];
  public reason?: IFeatureFlagOverride['reason'];
  public feature?: IFeatureFlagOverride['feature'];
  public user?: IFeatureFlagOverride['user'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.feature_flag_overrides}`;
  }

  static publicProperty(properties: (keyof IFeatureFlagOverride)[] = []): (keyof IFeatureFlagOverride)[] {
    return ['id', 'feature_flag_id', 'user_id', 'enabled', 'reason', 'created_at', 'updated_at', ...properties];
  }

  static get jsonSchema() {
    return FeatureFlagOverrideValidationSchema;
  }

  static get relationMappings() {
    return {
      feature: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: FeatureFlagModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.feature_flag_overrides}.feature_flag_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.feature_flags}.id`,
        },
      },
      user: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.feature_flag_overrides}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        },
      },
    };
  }
}
