import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { TierConfigVerificationRequirementModel } from '../tierConfigVerificationRequirement';
import { IVerificationRequirement } from './verificationRequirement.interface';
import { VerificationRequirementValidationSchema } from './verificationRequirement.validation';

export class VerificationRequirementModel extends BaseModel implements IVerificationRequirement {
  public name: IVerificationRequirement['name'];

  public tierConfigVerificationRequirements?: IVerificationRequirement['tierConfigVerificationRequirements'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.verification_requirements}`;
  }

  static publicProperty(properties: (keyof IVerificationRequirement)[] = []): (keyof IVerificationRequirement)[] {
    return ['id', 'name', 'created_at', 'updated_at', ...properties];
  }

  static get jsonSchema() {
    return VerificationRequirementValidationSchema;
  }

  static get relationMappings() {
    return {
      tierConfigVerificationRequirements: {
        relation: BaseModel.HasManyRelation,
        modelClass: TierConfigVerificationRequirementModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.verification_requirements}.id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.tier_config_verification_requirements}.verification_requirement_id`,
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
