import { Logger } from '@nestjs/common';
import Knex from 'knex';
import * as KnexConfig from '../../knexfile';

export class KnexDB {
  private static instance: Knex.Knex<any, unknown[]>;
  private static readonly logger = new Logger(KnexDB.name);

  private static instantiate() {
    this.logger.log('Database Connection initiated');

    const knex = Knex({ ...KnexConfig });

    this.logger.log('Database Connection successful');

    KnexDB.instance = knex;

    return KnexDB.instance;
  }

  public static connection(): Knex.Knex<any, unknown[]> {
    if (KnexDB.instance) {
      return KnexDB.instance;
    }

    return KnexDB.instantiate();
  }
}
