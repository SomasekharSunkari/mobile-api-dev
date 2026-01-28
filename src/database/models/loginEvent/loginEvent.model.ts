import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { ILoginEvent } from './loginEvent.interface';
import { LoginEventValidationSchema } from './loginEvent.validation';

export class LoginEventModel extends BaseModel implements ILoginEvent {
  public user_id: string;
  public device_id: string;
  public ip_address: string;
  public login_time: string;
  public city: string;
  public region: string;
  public country: string;
  public is_vpn: boolean;
  public risk_score: number;

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.login_events}`;
  }

  static publicProperty(properties: (keyof ILoginEvent)[] = []): (keyof ILoginEvent)[] {
    return [
      'user_id',
      'device_id',
      'ip_address',
      'login_time',
      'city',
      'region',
      'country',
      'is_vpn',
      'risk_score',
      ...properties,
    ];
  }

  static get jsonSchema() {
    return LoginEventValidationSchema;
  }
}
