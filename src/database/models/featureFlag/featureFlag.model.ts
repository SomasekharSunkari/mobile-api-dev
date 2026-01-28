import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { FeatureFlagOverrideModel } from '../featureFlagOverride/featureFlagOverride.model';
import { IFeatureFlag } from './featureFlag.interface';
import { FeatureFlagValidationSchema } from './featureFlag.validation';

export class FeatureFlagModel extends BaseModel implements IFeatureFlag {
  public key: IFeatureFlag['key'];
  public description?: IFeatureFlag['description'];
  public enabled: IFeatureFlag['enabled'];
  public enabled_ios: IFeatureFlag['enabled_ios'];
  public enabled_android: IFeatureFlag['enabled_android'];
  public expires_at?: IFeatureFlag['expires_at'];
  public overrides?: IFeatureFlag['overrides'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.feature_flags}`;
  }

  static publicProperty(properties: (keyof IFeatureFlag)[] = []): (keyof IFeatureFlag)[] {
    return [
      'id',
      'key',
      'description',
      'enabled',
      'enabled_ios',
      'enabled_android',
      'expires_at',
      'created_at',
      'updated_at',
      ...properties,
    ];
  }

  static get jsonSchema() {
    return FeatureFlagValidationSchema;
  }

  static get relationMappings() {
    return {
      overrides: {
        relation: BaseModel.HasManyRelation,
        modelClass: FeatureFlagOverrideModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.feature_flags}.id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.feature_flag_overrides}.feature_flag_id`,
        },
      },
    };
  }
}
