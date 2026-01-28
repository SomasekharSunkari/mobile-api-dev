import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { KycVerificationModel } from '../kycVerification/kycVerification.model';
import { IKycStatusLog } from './kycStatusLog.interface';
import { KycStatusLogValidationSchema } from './kycStatusLog.validation';

export class KycStatusLogModel extends BaseModel implements IKycStatusLog {
  public kyc_id: IKycStatusLog['kyc_id'];
  public old_status?: IKycStatusLog['old_status'];
  public new_status: IKycStatusLog['new_status'];
  public changed_at?: IKycStatusLog['changed_at'];
  public comment?: IKycStatusLog['comment'];

  public kycVerification?: IKycStatusLog['kycVerification'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.kyc_status_logs}`;
  }

  static publicProperty(properties: (keyof IKycStatusLog)[] = []): (keyof IKycStatusLog)[] {
    return [
      'id',
      'kyc_id',
      'old_status',
      'new_status',
      'changed_at',
      'comment',
      'created_at',
      'updated_at',
      'deleted_at',
      ...properties,
    ];
  }

  static get jsonSchema() {
    return KycStatusLogValidationSchema;
  }

  static get relationMappings() {
    return {
      kyc: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: KycVerificationModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.kyc_status_logs}.kyc_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.kyc_verifications}.id`,
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
