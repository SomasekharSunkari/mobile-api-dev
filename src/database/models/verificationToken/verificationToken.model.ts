import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { UserModel } from '../user/user.model';
import { IVerificationToken } from './verificationToken.interface';
import { VerificationTokenValidationSchema } from './verificationToken.validation';

export class VerificationTokenModel extends BaseModel implements IVerificationToken {
  public user_id: IVerificationToken['user_id'];
  public token_identifier: IVerificationToken['token_identifier'];
  public verification_type: IVerificationToken['verification_type'];
  public expires_at: IVerificationToken['expires_at'];
  public is_used: IVerificationToken['is_used'];
  public used_at?: IVerificationToken['used_at'];
  public user?: IVerificationToken['user'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.verification_tokens}`;
  }

  static publicProperty(properties: (keyof IVerificationToken)[] = []): (keyof IVerificationToken)[] {
    return [
      'id',
      'user_id',
      'token_identifier',
      'verification_type',
      'expires_at',
      'is_used',
      'used_at',
      'created_at',
      'updated_at',
      ...properties,
    ];
  }

  static get jsonSchema() {
    return VerificationTokenValidationSchema;
  }

  static get relationMappings() {
    return {
      user: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.verification_tokens}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        },
      },
    };
  }

  static get modifiers() {
    return {
      notDeleted(query) {
        query.whereNull('deleted_at');
      },
      notUsed(query) {
        query.where('is_used', false);
      },
      notExpired(query) {
        query.where('expires_at', '>', new Date());
      },
      valid(query) {
        query.where('is_used', false).where('expires_at', '>', new Date()).whereNull('deleted_at');
      },
    };
  }
}
