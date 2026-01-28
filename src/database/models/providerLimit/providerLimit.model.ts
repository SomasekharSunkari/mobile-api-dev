import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { IProviderLimit } from './providerLimit.interface';
import { ProviderLimitValidationSchema } from './providerLimit.validation';

export class ProviderLimitModel extends BaseModel implements IProviderLimit {
  public provider: IProviderLimit['provider'];
  public limit_type: IProviderLimit['limit_type'];
  public limit_value: IProviderLimit['limit_value'];
  public currency: IProviderLimit['currency'];
  public is_active: IProviderLimit['is_active'];
  public description?: IProviderLimit['description'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.provider_limits}`;
  }

  static publicProperty(properties: (keyof IProviderLimit)[] = []): (keyof IProviderLimit)[] {
    return [
      'id',
      'provider',
      'limit_type',
      'limit_value',
      'currency',
      'is_active',
      'description',
      'created_at',
      'updated_at',
      ...properties,
    ];
  }

  static get jsonSchema() {
    return ProviderLimitValidationSchema;
  }

  static get modifiers() {
    return {
      notDeleted(query) {
        query.whereNull('deleted_at');
      },
      active(query) {
        query.where('is_active', true);
      },
    };
  }
}
