import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { UserProfileModel } from './userProfile.model';
import { UserProfileValidationSchema } from './userProfile.validation';

jest.mock('../../base');

describe('UserProfileModel', () => {
  describe('tableName', () => {
    it('should return the correct table name', () => {
      expect(UserProfileModel.tableName).toBe(`${DatabaseSchema.apiService}.${DatabaseTables.users_profiles}`);
    });
  });

  describe('jsonSchema', () => {
    it('should return the user profile validation schema', () => {
      expect(UserProfileModel.jsonSchema).toBe(UserProfileValidationSchema);
    });
  });

  describe('publicProperty', () => {
    it('should return the correct public properties', () => {
      const publicProps = UserProfileModel.publicProperty();
      expect(publicProps).toEqual([
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
      ]);
    });

    it('should include additional properties when passed', () => {
      const publicProps = UserProfileModel.publicProperty(['custom_field' as any]);
      expect(publicProps).toContain('custom_field');
      expect(publicProps).toContain('user_id');
    });
  });

  describe('instance properties', () => {
    let model: UserProfileModel;
    beforeEach(() => {
      model = new UserProfileModel();
      model.id = 'profile-1';
      model.user_id = 'user-1';
      model.dob = new Date('1990-01-01');
      model.gender = 'male';
      model.address_line1 = '123 Main St';
      model.address_line2 = 'Apt 4B';
      model.city = 'New York';
      model.state_or_province = 'NY';
      model.postal_code = '10001';
      model.notification_token = 'token-123';
      model.avatar_url = 'https://example.com/avatar.jpg';
      model.image_key = 'profiles/user-1/avatar.jpg';
      model.created_at = new Date('2025-06-01T00:00:00Z');
      model.updated_at = new Date('2025-06-01T12:00:00Z');
      model.deleted_at = undefined;
    });

    it('should properly store the instance properties', () => {
      expect(model.id).toBe('profile-1');
      expect(model.user_id).toBe('user-1');
      expect(model.dob).toEqual(new Date('1990-01-01'));
      expect(model.gender).toBe('male');
      expect(model.address_line1).toBe('123 Main St');
      expect(model.address_line2).toBe('Apt 4B');
      expect(model.city).toBe('New York');
      expect(model.state_or_province).toBe('NY');
      expect(model.postal_code).toBe('10001');
      expect(model.notification_token).toBe('token-123');
      expect(model.avatar_url).toBe('https://example.com/avatar.jpg');
      expect(model.image_key).toBe('profiles/user-1/avatar.jpg');
      expect(model.created_at).toEqual(new Date('2025-06-01T00:00:00Z'));
      expect(model.updated_at).toEqual(new Date('2025-06-01T12:00:00Z'));
      expect(model.deleted_at).toBeUndefined();
    });

    it('should inherit from BaseModel', () => {
      expect(model).toBeInstanceOf(BaseModel);
    });

    it('should handle nullable fields', () => {
      const nullableModel = new UserProfileModel();
      nullableModel.id = 'profile-2';
      nullableModel.user_id = 'user-2';
      nullableModel.address_line2 = null;
      nullableModel.notification_token = null;
      nullableModel.avatar_url = null;
      nullableModel.image_key = null;

      expect(nullableModel.address_line2).toBeNull();
      expect(nullableModel.notification_token).toBeNull();
      expect(nullableModel.avatar_url).toBeNull();
      expect(nullableModel.image_key).toBeNull();
    });

    it('should handle date as string', () => {
      const dateModel = new UserProfileModel();
      dateModel.dob = '1990-01-01';

      expect(dateModel.dob).toBe('1990-01-01');
    });

    it('should handle date as Date object', () => {
      const dateModel = new UserProfileModel();
      const dateObj = new Date('1990-01-01');
      dateModel.dob = dateObj;

      expect(dateModel.dob).toEqual(dateObj);
    });
  });

  describe('modifiers', () => {
    it('should have modifiers property', () => {
      expect(UserProfileModel.modifiers).toBeDefined();
      expect(typeof UserProfileModel.modifiers).toBe('object');
    });

    it('should have notDeleted modifier', () => {
      expect(UserProfileModel.modifiers.notDeleted).toBeDefined();
      expect(typeof UserProfileModel.modifiers.notDeleted).toBe('function');
    });

    it('should apply notDeleted modifier correctly', () => {
      const mockQuery = {
        whereNull: jest.fn(),
      };

      UserProfileModel.modifiers.notDeleted(mockQuery);

      expect(mockQuery.whereNull).toHaveBeenCalledWith('deleted_at');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string values', () => {
      const emptyModel = new UserProfileModel();
      emptyModel.id = 'profile-3';
      emptyModel.user_id = 'user-3';
      emptyModel.address_line1 = '';
      emptyModel.city = '';
      emptyModel.postal_code = '';

      expect(emptyModel.address_line1).toBe('');
      expect(emptyModel.city).toBe('');
      expect(emptyModel.postal_code).toBe('');
    });

    it('should handle undefined values', () => {
      const undefinedModel = new UserProfileModel();
      undefinedModel.id = 'profile-4';

      expect(undefinedModel.user_id).toBeUndefined();
      expect(undefinedModel.gender).toBeUndefined();
      expect(undefinedModel.address_line1).toBeUndefined();
      expect(undefinedModel.image_key).toBeUndefined();
    });

    it('should handle special characters in address fields', () => {
      const specialModel = new UserProfileModel();
      specialModel.id = 'profile-5';
      specialModel.user_id = 'user-5';
      specialModel.address_line1 = '123 Main St. Apt #4-B';
      specialModel.city = 'New York/Manhattan';
      specialModel.state_or_province = 'NY & NJ';

      expect(specialModel.address_line1).toBe('123 Main St. Apt #4-B');
      expect(specialModel.city).toBe('New York/Manhattan');
      expect(specialModel.state_or_province).toBe('NY & NJ');
    });

    it('should handle long notification tokens', () => {
      const tokenModel = new UserProfileModel();
      tokenModel.id = 'profile-6';
      tokenModel.user_id = 'user-6';
      const longToken = 'a'.repeat(500);
      tokenModel.notification_token = longToken;

      expect(tokenModel.notification_token).toBe(longToken);
      expect(tokenModel.notification_token.length).toBe(500);
    });

    it('should handle URL in avatar_url', () => {
      const urlModel = new UserProfileModel();
      urlModel.id = 'profile-7';
      urlModel.user_id = 'user-7';
      urlModel.avatar_url = 'https://example.com/images/avatar.png?size=large&format=jpg';

      expect(urlModel.avatar_url).toBe('https://example.com/images/avatar.png?size=large&format=jpg');
    });

    it('should handle S3 key in image_key', () => {
      const keyModel = new UserProfileModel();
      keyModel.id = 'profile-8';
      keyModel.user_id = 'user-8';
      keyModel.image_key = 'profiles/user-8/avatar-2025-01-01.jpg';

      expect(keyModel.image_key).toBe('profiles/user-8/avatar-2025-01-01.jpg');
    });
  });

  describe('publicProperty variations', () => {
    it('should not include id in public properties by default', () => {
      const publicProps = UserProfileModel.publicProperty();
      expect(publicProps).not.toContain('id');
    });

    it('should not include deleted_at in public properties by default', () => {
      const publicProps = UserProfileModel.publicProperty();
      expect(publicProps).not.toContain('deleted_at');
    });

    it('should include all address fields in public properties', () => {
      const publicProps = UserProfileModel.publicProperty();
      expect(publicProps).toContain('address_line1');
      expect(publicProps).toContain('address_line2');
      expect(publicProps).toContain('city');
      expect(publicProps).toContain('state_or_province');
      expect(publicProps).toContain('postal_code');
    });

    it('should append multiple additional properties', () => {
      const publicProps = UserProfileModel.publicProperty(['custom_field1' as any, 'custom_field2' as any]);
      expect(publicProps).toContain('custom_field1');
      expect(publicProps).toContain('custom_field2');
      expect(publicProps).toContain('user_id');
    });

    it('should maintain order of properties', () => {
      const publicProps = UserProfileModel.publicProperty();
      expect(publicProps[0]).toBe('user_id');
      expect(publicProps[publicProps.length - 2]).toBe('created_at');
      expect(publicProps[publicProps.length - 1]).toBe('updated_at');
    });
  });

  describe('data type validations', () => {
    it('should accept valid gender values', () => {
      const model = new UserProfileModel();
      model.gender = 'male';
      expect(model.gender).toBe('male');

      model.gender = 'female';
      expect(model.gender).toBe('female');

      model.gender = 'other';
      expect(model.gender).toBe('other');
    });

    it('should handle different postal code formats', () => {
      const model = new UserProfileModel();

      model.postal_code = '10001';
      expect(model.postal_code).toBe('10001');

      model.postal_code = '10001-1234';
      expect(model.postal_code).toBe('10001-1234');

      model.postal_code = 'SW1A 1AA';
      expect(model.postal_code).toBe('SW1A 1AA');
    });

    it('should store user_id as string', () => {
      const model = new UserProfileModel();
      model.user_id = 'uuid-123-456';
      expect(typeof model.user_id).toBe('string');
      expect(model.user_id).toBe('uuid-123-456');
    });
  });

  describe('timestamp handling', () => {
    it('should properly handle created_at timestamp', () => {
      const model = new UserProfileModel();
      const timestamp = new Date('2025-10-31T10:30:00Z');
      model.created_at = timestamp;

      expect(model.created_at).toEqual(timestamp);
      expect(model.created_at instanceof Date).toBeTruthy();
    });

    it('should properly handle updated_at timestamp', () => {
      const model = new UserProfileModel();
      const timestamp = new Date('2025-10-31T12:00:00Z');
      model.updated_at = timestamp;

      expect(model.updated_at).toEqual(timestamp);
      expect(model.updated_at instanceof Date).toBeTruthy();
    });

    it('should allow deleted_at to be null', () => {
      const model = new UserProfileModel();
      model.deleted_at = null;

      expect(model.deleted_at).toBeNull();
    });

    it('should allow deleted_at to be a date', () => {
      const model = new UserProfileModel();
      const timestamp = new Date('2025-10-31T14:00:00Z');
      model.deleted_at = timestamp;

      expect(model.deleted_at).toEqual(timestamp);
    });
  });

  describe('complete user profile scenarios', () => {
    it('should create a complete user profile with all fields', () => {
      const completeProfile = new UserProfileModel();
      completeProfile.id = 'profile-complete';
      completeProfile.user_id = 'user-complete';
      completeProfile.dob = new Date('1985-05-15');
      completeProfile.gender = 'female';
      completeProfile.address_line1 = '456 Oak Avenue';
      completeProfile.address_line2 = 'Suite 200';
      completeProfile.city = 'Los Angeles';
      completeProfile.state_or_province = 'CA';
      completeProfile.postal_code = '90001';
      completeProfile.notification_token = 'fcm-token-xyz';
      completeProfile.avatar_url = 'https://cdn.example.com/avatars/user-complete.jpg';
      completeProfile.image_key = 'profiles/user-complete/avatar.jpg';
      completeProfile.created_at = new Date('2025-01-01T00:00:00Z');
      completeProfile.updated_at = new Date('2025-10-31T00:00:00Z');

      expect(completeProfile.id).toBe('profile-complete');
      expect(completeProfile.user_id).toBe('user-complete');
      expect(completeProfile.dob).toEqual(new Date('1985-05-15'));
      expect(completeProfile.gender).toBe('female');
      expect(completeProfile.address_line1).toBe('456 Oak Avenue');
      expect(completeProfile.address_line2).toBe('Suite 200');
      expect(completeProfile.city).toBe('Los Angeles');
      expect(completeProfile.state_or_province).toBe('CA');
      expect(completeProfile.postal_code).toBe('90001');
      expect(completeProfile.notification_token).toBe('fcm-token-xyz');
      expect(completeProfile.avatar_url).toBe('https://cdn.example.com/avatars/user-complete.jpg');
      expect(completeProfile.image_key).toBe('profiles/user-complete/avatar.jpg');
    });

    it('should create a minimal user profile with only required fields', () => {
      const minimalProfile = new UserProfileModel();
      minimalProfile.id = 'profile-minimal';
      minimalProfile.user_id = 'user-minimal';

      expect(minimalProfile.id).toBe('profile-minimal');
      expect(minimalProfile.user_id).toBe('user-minimal');
      expect(minimalProfile.dob).toBeUndefined();
      expect(minimalProfile.gender).toBeUndefined();
      expect(minimalProfile.address_line1).toBeUndefined();
      expect(minimalProfile.image_key).toBeUndefined();
    });
  });
});
