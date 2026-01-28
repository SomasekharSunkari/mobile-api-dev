import { Model, Page, QueryBuilder } from 'objection';

type Options = {
  columnName?: string;
  deletedValue?: Date;
};

let options: Options;

export class DeleteQueryBuilder<M extends Model, R = M[]> extends QueryBuilder<M, R> {
  // These are necessary. You can just copy-paste them and change the
  // name of the query builder class.
  public ArrayQueryBuilderType!: DeleteQueryBuilder<M, M[]>;
  public SingleQueryBuilderType!: DeleteQueryBuilder<M, M>;
  public MaybeSingleQueryBuilderType!: DeleteQueryBuilder<M, M | undefined>;
  public NumberQueryBuilderType!: DeleteQueryBuilder<M, number>;
  public PageQueryBuilderType!: DeleteQueryBuilder<M, Page<M>>;

  public execute(): Promise<R> {
    if (this.isFind() && !this.context().includeDeleted) {
      const tableRef = this.tableRefFor(this.modelClass()); // qualify the column name
      if (!tableRef.includes('in_app_notifications')) void this.whereNull(`${tableRef}.${options.columnName}`);
    }
    return super.execute();
  }

  public delete(): this['NumberQueryBuilderType'] {
    void this.context({
      deleted_at: new Date(),
    });
    const patch = {};
    patch[options.columnName] = options.deletedValue;
    return this.patch(patch);
  }

  public hardDelete(): this['NumberQueryBuilderType'] {
    return super.delete();
  }

  public undelete(): this['NumberQueryBuilderType'] {
    void this.context({
      undelete: true,
    });
    const patch = {};
    patch[options.columnName] = null;
    return this.patch(patch);
  }

  public includeDeleted(): this {
    return this.context({ includeDeleted: false });
  }
}

type Constructor<T> = new (...args: any[]) => T;

export const SoftDeleteMixin = (passedOptions?: Options) => {
  options = {
    columnName: 'deleted_at',
    deletedValue: new Date(),
    ...passedOptions,
  };

  return function <T extends Constructor<Model>>(Base: T): T {
    return class extends Base {
      public QueryBuilderType!: DeleteQueryBuilder<this>;
      public static QueryBuilder = DeleteQueryBuilder;

      public static modifiers = {
        includeDeleted(query: DeleteQueryBuilder<Model>): void {
          void query.includeDeleted();
        },
      };
    };
  };
};
