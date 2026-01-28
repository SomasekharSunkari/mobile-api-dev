import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { TierConfigModel } from '../tierConfig/tierConfig.model';
import { VerificationRequirementModel } from '../verificationRequirement/verificationRequirement.model';
import { ITierConfigVerificationRequirement } from './tierConfigVerificationRequirement.interface';
import { TierConfigVerificationRequirementValidationSchema } from './tierConfigVerificationRequirement.validation';

export class TierConfigVerificationRequirementModel extends BaseModel implements ITierConfigVerificationRequirement {
  public tier_config_id: ITierConfigVerificationRequirement['tier_config_id'];
  public verification_requirement_id: ITierConfigVerificationRequirement['verification_requirement_id'];

  public tierConfig?: ITierConfigVerificationRequirement['tierConfig'];
  public verificationRequirement?: ITierConfigVerificationRequirement['verificationRequirement'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.tier_config_verification_requirements}`;
  }

  static publicProperty(
    properties: (keyof ITierConfigVerificationRequirement)[] = [],
  ): (keyof ITierConfigVerificationRequirement)[] {
    return ['id', 'tier_config_id', 'verification_requirement_id', 'created_at', 'updated_at', ...properties];
  }

  static get jsonSchema() {
    return TierConfigVerificationRequirementValidationSchema;
  }

  static get relationMappings() {
    return {
      tierConfig: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: TierConfigModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.tier_config_verification_requirements}.tier_config_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.tier_configs}.id`,
        },
      },
      verificationRequirement: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: VerificationRequirementModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.tier_config_verification_requirements}.verification_requirement_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.verification_requirements}.id`,
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
