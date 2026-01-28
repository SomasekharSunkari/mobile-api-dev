import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { IIpCountryBan } from './ipCountryBan.interface';
import { IpCountryBanValidation } from './ipCountryBan.validation';

export class IpCountryBanModel extends BaseModel implements IIpCountryBan {
  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.ip_country_bans}`;
  }

  type!: string;
  value!: string;
  reason?: string;

  static get jsonSchema() {
    return IpCountryBanValidation;
  }
}
