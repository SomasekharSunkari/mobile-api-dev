import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { ILoginDevice } from './loginDevice.interface';
import { LoginDeviceValidationSchema } from './loginDevice.validation';

/**
 * Represents a device used by a user to log in.
 */
export class LoginDeviceModel extends BaseModel implements ILoginDevice {
  public user_id: string;
  public device_fingerprint: string;
  public device_name: string;
  public device_type: string;
  public os: string;
  public browser: string;
  public is_trusted: boolean;
  public last_verified_at: string;
  public last_login: string;

  /**
   * The name of the database table.
   */
  public static get tableName(): string {
    return `${DatabaseSchema.apiService}.${DatabaseTables.login_devices}`;
  }

  /**
   * Returns a list of publicly accessible properties.
   */
  public static publicProperties(properties: (keyof ILoginDevice)[] = []): (keyof ILoginDevice)[] {
    return [
      'user_id',
      'device_fingerprint',
      'device_name',
      'device_type',
      'os',
      'browser',
      'is_trusted',
      'last_verified_at',
      'last_login',
      'created_at',
      'updated_at',
      ...properties,
    ];
  }

  /**
   * The JSON schema used for validation.
   */
  public static get jsonSchema() {
    return LoginDeviceValidationSchema;
  }
}
