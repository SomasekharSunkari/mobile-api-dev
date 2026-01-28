import Objection, { Model, ModelClass, Transaction, transaction, TransactionOrKnex } from 'objection';

import { Logger } from '@nestjs/common';
import { NO_OF_LIMITED_QUERIES } from '../../constants/constants';
import { FetchQuery, IPaginatedResponse } from './base.interface';
import { BaseModel } from './base.model';

/**
 * Base Repository Class
 *
 * This is a base repository class that provides common database operations.
 * Engineers should extend this class and implement additional methods such as:
 *
 * - findById(id: string/number): Find a record by its ID
 * - findOne(filter: object): Find a single record matching the filter
 * - findAll(filter?: object): Get all records matching optional filter
 * - update(id: string/number, data: object): Update a record
 * - delete(id: string/number): Delete a record
 * - softDelete(id: string/number): Soft delete a record (if applicable)
 * - restore(id: string/number): Restore a soft-deleted record
 * - count(filter?: object): Count records matching optional filter
 */

interface ModelParameters {
  trx?: Transaction;
  graphFetch?: string;
  graphModifier?: {
    relationship: string;
    modifier: Objection.Modifier<Objection.QueryBuilder<Objection.Model, Objection.Model[]>>;
  };
}

type ModelInterface<BaseModel extends Record<any, any>> = ReturnType<BaseModel['toJSON']>;

export abstract class BaseRepository<ModelInstance extends BaseModel = BaseModel> {
  protected readonly logger = new Logger(BaseRepository.name);
  protected readonly tableName: string;
  public readonly model: ModelClass<BaseModel>;

  protected constructor(model: ModelClass<BaseModel>) {
    this.model = model;
    const [tableName] = model.tableName.split('.');

    this.tableName = tableName;
  }

  public async create(data: Partial<ModelInterface<ModelInstance>>, trx?: Transaction): Promise<ModelInstance> {
    this.logger.log('BaseRepository.create', 'BaseRepository');

    if (trx) {
      const record = await this.model.query(trx).insert(data);
      return record as ModelInstance;
    }
    return transaction(this.model, async (DbModel: ModelClass<ModelInstance>) => {
      const record = await DbModel.query().insertGraphAndFetch(data as unknown);
      return record as unknown as ModelInstance;
    });
  }

  /**
   * Get the query builder for the model
   */
  public query(trx?: Transaction): ReturnType<typeof this.model.query> {
    if (trx) {
      return this.model.query(trx);
    }
    return this.model.query();
  }

  findSync(
    model?: Partial<ModelInterface<ModelInstance>>,
    params?: FetchQuery,
    options?: ModelParameters,
  ): Objection.QueryBuilder<ModelInstance, ModelInstance[]> {
    this.logger.log('findSync', 'BaseRepository');

    const limit = params?.limit ?? NO_OF_LIMITED_QUERIES;
    const graphFetch = options?.graphFetch || '';
    const graphModifier = options?.graphModifier;
    const trx = options?.trx;

    if (params?.filterBy === 'password') {
      delete params?.filterBy;
    }

    if (params?.orderBy === 'password') {
      delete params?.orderBy;
    }

    const orders: FetchQuery['order'][] = ['asc', 'desc'];

    const order = orders.find((value) => value === params?.order);

    let result = this.model
      .query(trx)
      .withGraphFetched(graphFetch)
      .skipUndefined()
      .where(model ?? {})
      .orderBy(params?.orderBy || 'updated_at', order || 'desc')
      .limit(limit);

    if (graphModifier) {
      const { modifier, relationship } = graphModifier;
      result.modifyGraph(relationship, modifier);
    }

    if (params?.page) {
      result = result.offset(limit * ((params?.page || 1) - 1));
    }

    if (params?.startDate) {
      result = result.where('created_at', '>', params?.startDate);
    }

    if (params?.endDate) {
      result = result.where(params?.endDateCol ?? 'expired_at', '<', params?.endDate);
    }

    // result

    if (params?.search && params?.filterBy !== 'password') {
      result = result.whereILike(params?.filterBy ?? 'name', `%${params?.search}%`);
    }

    return result as any as Objection.QueryBuilder<ModelInstance, ModelInstance[]>;
  }

  async findAll(
    model?: Partial<ModelInterface<ModelInstance>>,
    params?: FetchQuery,
    options?: ModelParameters,
  ): Promise<IPaginatedResponse<ModelInstance>> {
    this.logger.log('find', 'BaseRepository');
    const { page = 1, limit = NO_OF_LIMITED_QUERIES } = params ?? {};
    const result = this.findSync(model, { ...params, limit, page }, options);

    return await this.paginateData(result, Number(limit), Number(page));
  }

  async paginateData(
    data: Objection.QueryBuilder<ModelInstance, ModelInstance[]>,
    limit?: number,
    currentPage = 1,
  ): Promise<IPaginatedResponse> {
    this.logger.log('paginateData', 'BaseRepository');

    // Clone the query for counting to avoid modifying the original
    const countQuery = data.clone();

    // Clear pagination and ordering for count query
    countQuery.clearOrder();

    // Use resultSize() which handles GROUP BY properly
    const total = await countQuery.resultSize();

    if (!limit) {
      limit = NO_OF_LIMITED_QUERIES;
    }

    const formattedData = await data;
    const pageCount = Math.ceil(total / limit);
    const nextPage = currentPage >= pageCount ? 0 : currentPage + 1;
    const previousPage = currentPage === 1 ? 0 : currentPage - 1;

    return {
      [this.model.tableName.split('.')[1]]: formattedData,
      pagination: {
        current_page: currentPage,
        next_page: nextPage,
        previous_page: previousPage,
        limit: limit,
        page_count: pageCount,
        total,
      },
    } as IPaginatedResponse<ModelInstance>;
  }

  async findOne(
    model: Partial<ModelInterface<ModelInstance>>,
    params?: FetchQuery,
    options?: ModelParameters,
  ): Promise<ModelInstance> {
    this.logger.log('findOne', 'BaseRepository');

    const result = await this.findSync(model, params, options).first();

    return result as any as ModelInstance;
  }

  async findById(id: string, graphFetch?: string, trx?: Transaction) {
    this.logger.log('findById', 'BaseRepository');

    const data = await this.model.query(trx).findById(id);

    if (graphFetch) {
      await data.$fetchGraph(graphFetch);
    }

    return data as any as Objection.QueryBuilder<Model, Required<ModelInterface<ModelInstance>>>;
  }

  async update(
    filter: Partial<ModelInterface<ModelInstance>>,
    data: Partial<ModelInterface<ModelInstance>>,
    options?: ModelParameters,
  ): Promise<ModelInstance>;
  async update(
    id: string,
    data: Partial<ModelInterface<ModelInstance>>,
    options?: ModelParameters,
  ): Promise<ModelInstance>;
  async update(
    idOrModel: string | Partial<ModelInterface<ModelInstance>>,
    data: Partial<ModelInterface<ModelInstance>>,
    options?: ModelParameters,
  ): Promise<ModelInstance> {
    this.logger.log('update', 'BaseRepository');

    const graphFetch = options?.graphFetch || '';
    const graphModifier = options?.graphModifier;
    const trx = options?.trx;

    let response;
    if (typeof idOrModel === 'string') {
      response = this.model.query(trx).patchAndFetchById(idOrModel, data);

      if (graphFetch) {
        response.withGraphFetched(graphFetch);
      }

      if (graphModifier) {
        response.modifyGraph(graphModifier.relationship, graphModifier.modifier);
      }
    } else {
      const modelInstance = await this.model.query(trx).findOne(idOrModel);
      response = await modelInstance.$query(trx).patchAndFetch(data);

      if (graphFetch) {
        response.withGraphFetched(graphFetch);
      }

      if (graphModifier) {
        response.modifyGraph(graphModifier.relationship, graphModifier.modifier);
      }
    }

    return response as ModelInstance;
  }

  async delete(id: string, trx?: Transaction) {
    this.logger.log('delete', 'BaseRepository');
    if (trx) {
      const response = await this.model.query(trx).delete().where({ id: id });
      return response;
    }

    const response = await this.model.query().delete().where({ id: id });
    return response;
  }

  async count(trx: Transaction): Promise<any> {
    const countObject = await this.model.query(trx).count(); // return object
    return countObject[0]['count(*)'] as number;
  }

  async transaction<T>(
    trxOrKnex: TransactionOrKnex | ((trx: Transaction) => Promise<T>),
    callback?: (trx: Transaction) => Promise<T>,
  ): Promise<T> {
    if (typeof trxOrKnex === 'function') {
      return await this.model.transaction(trxOrKnex);
    } else if (callback) {
      return await callback(trxOrKnex as Transaction);
    }

    throw new Error('Invalid arguments provided to transaction method');
  }

  async hardDelete(id: string | Partial<ModelInterface<ModelInstance>>, trx?: Transaction) {
    this.logger.log('hardDelete', 'BaseRepository');

    if (typeof id === 'object') {
      const response = await this.model.query(trx).hardDelete().where(id);
      return response;
    }

    const response = await this.model.query(trx).hardDelete().where({ id });
    return response;
  }
}
