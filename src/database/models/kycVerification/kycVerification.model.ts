import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { TierConfigModel } from '../tierConfig/tierConfig.model';
import { IUser } from '../user';
import { UserModel } from '../user/user.model';
import { IKycVerification } from './kycVerification.interface';
import { KycVerificationValidationSchema } from './kycVerification.validation';

export class KycVerificationModel extends BaseModel implements IKycVerification {
  public user_id: IKycVerification['user_id'];
  public provider: IKycVerification['provider'];
  public provider_ref: IKycVerification['provider_ref'];
  public attempt: IKycVerification['attempt'];
  public status: IKycVerification['status'];
  public error_message?: IKycVerification['error_message'];
  public submitted_at?: IKycVerification['submitted_at'];
  public reviewed_at?: IKycVerification['reviewed_at'];
  public metadata?: IKycVerification['metadata'];
  public provider_status?: IKycVerification['provider_status'];
  public tier_config_id: IKycVerification['tier_config_id'];
  public tier_config_verification_requirement_id: IKycVerification['tier_config_verification_requirement_id'];
  public provider_verification_type?: IKycVerification['provider_verification_type'];

  public user?: IUser;
  public tierConfig?: TierConfigModel;

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.kyc_verifications}`;
  }

  static publicProperty(properties: (keyof IKycVerification)[] = []): (keyof IKycVerification)[] {
    return [
      'id',
      'user_id',
      'provider',
      'provider_ref',
      'attempt',
      'status',
      'error_message',
      'submitted_at',
      'tier_config_id',
      'reviewed_at',
      'metadata',
      'provider_status',
      'created_at',
      'updated_at',
      'deleted_at',
      ...properties,
    ];
  }

  static get jsonSchema() {
    return KycVerificationValidationSchema;
  }

  static get relationMappings() {
    return {
      user: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.kyc_verifications}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        },
      },

      tierConfig: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: TierConfigModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.kyc_verifications}.tier_config_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.tier_configs}.id`,
        },
      },
    };
  }

  static get modifiers() {
    return {
      notDeleted(query) {
        query.whereNull('deleted_at');
      },
    };
  }
}
