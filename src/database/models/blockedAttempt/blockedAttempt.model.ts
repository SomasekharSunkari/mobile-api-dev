import { JSONSchema } from 'objection';
import { BaseModel } from '../../base';
import { IBlockedAttempt } from './blockedAttempt.interface';
import { BlockedAttemptValidationSchema } from './blockedAttempt.validation';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';

export class BlockedAttemptModel extends BaseModel implements IBlockedAttempt {
  public ip_address!: IBlockedAttempt['ip_address'];
  public country_code?: IBlockedAttempt['country_code'];
  public reason!: IBlockedAttempt['reason'];
  public path!: IBlockedAttempt['path'];

  public static get tableName(): string {
    return `${DatabaseSchema.apiService}.${DatabaseTables.blocked_attempts}`;
  }
  public static get jsonSchema(): JSONSchema {
    return BlockedAttemptValidationSchema;
  }
}
