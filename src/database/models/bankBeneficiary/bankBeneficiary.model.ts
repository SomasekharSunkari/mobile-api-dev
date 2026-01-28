import { JSONSchema } from 'objection';
import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { UserModel } from '../user/user.model';
import { IBankBeneficiary } from './bankBeneficiary.interface';
import { BankBeneficiaryValidationSchema } from './bankBeneficiary.validation';

export class BankBeneficiaryModel extends BaseModel implements IBankBeneficiary {
  public user_id: IBankBeneficiary['user_id'];
  public currency: IBankBeneficiary['currency'];
  public alias_name: IBankBeneficiary['alias_name'];
  public avatar_url?: IBankBeneficiary['avatar_url'];
  public account_number?: IBankBeneficiary['account_number'];
  public iban?: IBankBeneficiary['iban'];
  public account_name?: IBankBeneficiary['account_name'];
  public bank_name?: IBankBeneficiary['bank_name'];
  public bank_code?: IBankBeneficiary['bank_code'];
  public swift_code?: IBankBeneficiary['swift_code'];
  public routing_number?: IBankBeneficiary['routing_number'];
  public bank_logo?: IBankBeneficiary['bank_logo'];
  public bank_short_name?: IBankBeneficiary['bank_short_name'];
  public bank_country?: IBankBeneficiary['bank_country'];
  public bank_address?: IBankBeneficiary['bank_address'];
  public bank_city?: IBankBeneficiary['bank_city'];
  public bank_state?: IBankBeneficiary['bank_state'];
  public bank_zip?: IBankBeneficiary['bank_zip'];
  public bank_phone?: IBankBeneficiary['bank_phone'];
  public bank_email?: IBankBeneficiary['bank_email'];
  public bank_website?: IBankBeneficiary['bank_website'];
  public bank_ref?: IBankBeneficiary['bank_ref'];

  public static get tableName(): string {
    return `${DatabaseSchema.apiService}.${DatabaseTables.bank_beneficiaries}`;
  }

  public static get relationMappings() {
    return {
      user: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.bank_beneficiaries}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        },
      },
    };
  }

  public static get jsonSchema(): JSONSchema {
    return BankBeneficiaryValidationSchema;
  }
}
