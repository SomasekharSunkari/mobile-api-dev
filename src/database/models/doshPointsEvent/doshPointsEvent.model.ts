import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { IDoshPointsEvent } from './doshPointsEvent.interface';
import { DoshPointsEventValidationSchema } from './doshPointsEvent.validation';

export class DoshPointsEventModel extends BaseModel implements IDoshPointsEvent {
  public code: IDoshPointsEvent['code'];
  public name: IDoshPointsEvent['name'];
  public description?: IDoshPointsEvent['description'];
  public transaction_type: IDoshPointsEvent['transaction_type'];
  public default_points: IDoshPointsEvent['default_points'];
  public is_active: IDoshPointsEvent['is_active'];
  public is_one_time_per_user: IDoshPointsEvent['is_one_time_per_user'];
  public metadata?: IDoshPointsEvent['metadata'];
  public start_date?: IDoshPointsEvent['start_date'];
  public end_date?: IDoshPointsEvent['end_date'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.dosh_points_events}`;
  }

  static publicProperty(properties: (keyof IDoshPointsEvent)[] = []): (keyof IDoshPointsEvent)[] {
    return [
      'id',
      'code',
      'name',
      'description',
      'transaction_type',
      'default_points',
      'is_active',
      'is_one_time_per_user',
      'metadata',
      'start_date',
      'end_date',
      'created_at',
      'updated_at',
      ...properties,
    ];
  }

  static get jsonSchema() {
    return DoshPointsEventValidationSchema;
  }

  static get relationMappings() {
    return {};
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
