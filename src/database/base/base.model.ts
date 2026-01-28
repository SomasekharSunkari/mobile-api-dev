import { createId } from '@paralleldrive/cuid2';
import { Model } from 'objection';

import { IBase } from './base.interface';
import { DeleteQueryBuilder, SoftDeleteMixin } from './base.soft-delete';
import { RequestContext } from '../../config/request-context.config';
import { DateTime } from 'luxon';

/**
 *
 * Base model that will be extended by all models
 */

export class BaseModel
  extends SoftDeleteMixin({
    columnName: 'deleted_at',
    deletedValue: new Date(),
  })(Model)
  implements IBase
{
  // Default model attributes
  id!: IBase['id'];
  deleted_at!: IBase['deleted_at'];
  created_at!: IBase['created_at'];
  updated_at!: IBase['updated_at'];

  /**
   * Set the query builder for great intellisense in typescript
   */
  QueryBuilderType!: DeleteQueryBuilder<this>;
  static QueryBuilder = DeleteQueryBuilder;

  /**
   *
   * Set default primary column => optional
   */
  static get idColumn() {
    return 'id';
  }

  /**
   *
   * Run this method before all insert
   */
  $beforeInsert(): void | Promise<any> {
    if (!this.id) {
      this.id = createId();
    }
    this.created_at = new Date();
    this.updated_at = new Date();
  }

  /**
   *
   * Run this code before all update
   */
  $beforeUpdate(): void | Promise<any> {
    this.updated_at = new Date();
  }

  /**
   *
   * Run this code after all find
   */
  $afterFind(): void | Promise<any> {
    const tz = RequestContext.getStore()?.timezone ?? 'UTC';

    for (const key of ['created_at', 'updated_at', 'deleted_at'] as const) {
      const val = (this as any)[key];
      if (val instanceof Date) {
        const dt = DateTime.fromJSDate(val, { zone: 'UTC' }).setZone(tz);
        (this as any)[key] = dt.toJSDate();
      }
    }
  }

  // Default folder path for relationship linking
  static get modelPaths(): string[] {
    return [__dirname];
  }
}
