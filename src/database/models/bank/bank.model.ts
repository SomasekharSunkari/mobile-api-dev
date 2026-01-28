import { JSONSchema } from 'objection';
import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { CountryModel } from '../country';
import { IBank } from './bank.interface';
import { BankValidationSchema } from './bank.validation';

export class BankModel extends BaseModel implements IBank {
  public name: IBank['name'];
  public code: IBank['code'];
  public country_id: IBank['country_id'];
  public logo: IBank['logo'];
  public status?: IBank['status'];
  public short_name?: IBank['short_name'];
  public country?: IBank['country'];

  public static get tableName(): string {
    return `${DatabaseSchema.apiService}.${DatabaseTables.banks}`;
  }

  public static get jsonSchema(): JSONSchema {
    return BankValidationSchema;
  }

  public static get relationMappings() {
    return {
      country: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: CountryModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.banks}.country_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.countries}.id`,
        },
      },
    };
  }
}
