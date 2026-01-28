import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { IUserProfile } from './userProfile.interface';
import { UserProfileValidationSchema } from './userProfile.validation';

export class UserProfileModel extends BaseModel implements IUserProfile {
  public user_id: IUserProfile['user_id'];
  public dob: IUserProfile['dob'];
  public gender: IUserProfile['gender'];

  // 📦 Removed: phone_number, is_phone_verified, phone_number_country_code

  public address_line1: IUserProfile['address_line1'];
  public address_line2: IUserProfile['address_line2'];
  public city: IUserProfile['city'];
  public state_or_province: IUserProfile['state_or_province'];
  public postal_code: IUserProfile['postal_code'];
  public notification_token: IUserProfile['notification_token'];
  public avatar_url: IUserProfile['avatar_url'];
  public image_key: IUserProfile['image_key'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.users_profiles}`;
  }

  static publicProperty(properties: (keyof IUserProfile)[] = []): (keyof IUserProfile)[] {
    return [
      'user_id',
      'dob',
      'gender',
      'address_line1',
      'address_line2',
      'city',
      'state_or_province',
      'postal_code',
      'notification_token',
      'avatar_url',
      'created_at',
      'updated_at',
      ...properties,
    ];
  }

  static get jsonSchema() {
    return UserProfileValidationSchema;
  }

  static get modifiers() {
    return {
      notDeleted(query) {
        query.whereNull('deleted_at');
      },
    };
  }
}
