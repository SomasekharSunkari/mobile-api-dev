import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { BlockchainWalletModel } from '../blockchain_wallet/blockchain_wallet.model';
import { CountryModel } from '../country/country.model';
import { RoleModel } from '../role';
import { TransactionPinModel } from '../transactionPin/transactionPin.model';
import { UserProfileModel } from '../userProfile/userProfile.model';
import { UserStatus } from './user.interface';
import { UserModel } from './user.model';
import { UserValidationSchema } from './user.validation';

describe('UserModel', () => {
  describe('tableName', () => {
    it('should return correct table name with schema', () => {
      expect(UserModel.tableName).toBe(`${DatabaseSchema.apiService}.${DatabaseTables.users}`);
    });
  });

  describe('publicProperty', () => {
    it('should return default public properties when no argument provided', () => {
      const result = UserModel.publicProperty();
      expect(result).toEqual([
        'id',
        'first_name',
        'middle_name',
        'last_name',
        'username',
        'email',
        'is_email_verified',
        'phone_number',
        'is_phone_verified',
        'phone_number_country_code',
        'status',
        'is_deactivated',
        'country_id',
        'require_password_reset',
        'require_transaction_pin_reset',
        'disable_login_restrictions',
      ]);
    });

    it('should merge additional properties with default public properties', () => {
      const additionalProps = ['country', 'userProfile'];
      const result = UserModel.publicProperty(additionalProps as any);
      expect(result).toContain('id');
      expect(result).toContain('email');
      expect(result).toContain('country');
      expect(result).toContain('userProfile');
      expect(result.length).toBe(18);
    });

    it('should handle empty array of additional properties', () => {
      const result = UserModel.publicProperty([]);
      expect(result.length).toBe(16);
    });
  });

  describe('jsonSchema', () => {
    it('should return UserValidationSchema', () => {
      expect(UserModel.jsonSchema).toBe(UserValidationSchema);
    });
  });

  describe('relationMappings', () => {
    const relations = UserModel.relationMappings;

    it('should define userProfile as HasOneRelation', () => {
      expect(relations.userProfile).toBeDefined();
      expect(relations.userProfile.relation).toBe(BaseModel.HasOneRelation);
      expect(relations.userProfile.modelClass).toBe(UserProfileModel);
      expect(relations.userProfile.join.from).toBe(`${DatabaseSchema.apiService}.${DatabaseTables.users}.id`);
      expect(relations.userProfile.join.to).toBe(
        `${DatabaseSchema.apiService}.${DatabaseTables.users_profiles}.user_id`,
      );
    });

    it('should define userRoles as ManyToManyRelation', () => {
      expect(relations.userRoles).toBeDefined();
      expect(relations.userRoles.relation).toBe(BaseModel.ManyToManyRelation);
      expect(relations.userRoles.modelClass).toBe(RoleModel);
      expect(relations.userRoles.join.from).toBe(`${DatabaseSchema.apiService}.${DatabaseTables.users}.id`);
      expect(relations.userRoles.join.through.from).toBe(
        `${DatabaseSchema.apiService}.${DatabaseTables.users_roles}.user_id`,
      );
      expect(relations.userRoles.join.through.to).toBe(
        `${DatabaseSchema.apiService}.${DatabaseTables.users_roles}.role_id`,
      );
      expect(relations.userRoles.join.to).toBe(`${DatabaseSchema.apiService}.${DatabaseTables.roles}.id`);
    });

    it('should define country as BelongsToOneRelation', () => {
      expect(relations.country).toBeDefined();
      expect(relations.country.relation).toBe(BaseModel.BelongsToOneRelation);
      expect(relations.country.modelClass).toBe(CountryModel);
      expect(relations.country.join.from).toBe(`${DatabaseSchema.apiService}.${DatabaseTables.users}.country_id`);
      expect(relations.country.join.to).toBe(`${DatabaseSchema.apiService}.${DatabaseTables.countries}.id`);
    });

    it('should define blockchainWallets as HasManyRelation', () => {
      expect(relations.blockchainWallets).toBeDefined();
      expect(relations.blockchainWallets.relation).toBe(BaseModel.HasManyRelation);
      expect(relations.blockchainWallets.modelClass).toBe(BlockchainWalletModel);
      expect(relations.blockchainWallets.join.from).toBe(`${DatabaseSchema.apiService}.${DatabaseTables.users}.id`);
      expect(relations.blockchainWallets.join.to).toBe(
        `${DatabaseSchema.apiService}.${DatabaseTables.blockchain_wallets}.user_id`,
      );
    });

    it('should define transactionPin as HasOneRelation', () => {
      expect(relations.transactionPin).toBeDefined();
      expect(relations.transactionPin.relation).toBe(BaseModel.HasOneRelation);
      expect(relations.transactionPin.modelClass).toBe(TransactionPinModel);
      expect(relations.transactionPin.join.from).toBe(`${DatabaseSchema.apiService}.${DatabaseTables.users}.id`);
      expect(relations.transactionPin.join.to).toBe(
        `${DatabaseSchema.apiService}.${DatabaseTables.transaction_pins}.user_id`,
      );
    });
  });

  describe('modifiers', () => {
    it('should define notDeleted modifier', () => {
      const modifiers = UserModel.modifiers;
      expect(modifiers.notDeleted).toBeDefined();
      expect(typeof modifiers.notDeleted).toBe('function');
    });

    it('should apply whereNull on deleted_at column in notDeleted modifier', () => {
      const mockQuery = {
        whereNull: jest.fn(),
      };

      const modifiers = UserModel.modifiers;
      modifiers.notDeleted(mockQuery);

      expect(mockQuery.whereNull).toHaveBeenCalledWith('deleted_at');
    });
  });

  describe('model instantiation', () => {
    it('should create instance with all properties', () => {
      const user = new UserModel();
      user.first_name = 'John';
      user.last_name = 'Doe';
      user.username = 'johndoe';
      user.email = 'john@example.com';
      user.password = 'hashedpassword';
      user.is_email_verified = true;
      user.status = UserStatus.ACTIVE;
      user.phone_number = '+1234567890';
      user.is_phone_verified = true;
      user.phone_number_country_code = '+1';
      user.is_deactivated = false;
      user.require_password_reset = false;
      user.require_transaction_pin_reset = false;

      expect(user.first_name).toBe('John');
      expect(user.last_name).toBe('Doe');
      expect(user.username).toBe('johndoe');
      expect(user.email).toBe('john@example.com');
      expect(user.is_email_verified).toBe(true);
      expect(user.status).toBe(UserStatus.ACTIVE);
      expect(user.require_transaction_pin_reset).toBe(false);
    });
  });
});

describe('UserValidationSchema', () => {
  describe('schema structure', () => {
    it('should have correct type and title', () => {
      expect(UserValidationSchema.type).toBe('object');
      expect(UserValidationSchema.title).toBe('User Validation Schema');
    });

    it('should require username and password', () => {
      expect(UserValidationSchema.required).toEqual(['username', 'password']);
    });
  });

  describe('properties', () => {
    const props = UserValidationSchema.properties;

    it('should define username as string', () => {
      expect(props.username).toEqual({ type: 'string' });
    });

    it('should define first_name as string', () => {
      expect(props.first_name).toEqual({ type: 'string' });
    });

    it('should define middle_name as string', () => {
      expect(props.middle_name).toEqual({ type: 'string' });
    });

    it('should define last_name as string', () => {
      expect(props.last_name).toEqual({ type: 'string' });
    });

    it('should define email as string with email format', () => {
      expect(props.email).toEqual({ type: 'string', format: 'email' });
    });

    it('should define password as string', () => {
      expect(props.password).toEqual({ type: 'string' });
    });

    it('should define is_email_verified as boolean with default false', () => {
      expect(props.is_email_verified).toEqual({ type: 'boolean', default: false });
    });

    it('should define status with valid enum values', () => {
      expect(props.status).toEqual({
        type: 'string',
        enum: ['active', 'inactive', 'blocked', 'pending_deactivation', 'pending_account_deletion', 'deleted'],
      });
    });

    it('should define phone_number as nullable string', () => {
      expect(props.phone_number).toEqual({ type: ['string', 'null'] });
    });

    it('should define phone_number_country_code as nullable string', () => {
      expect(props.phone_number_country_code).toEqual({ type: ['string', 'null'] });
    });

    it('should define is_phone_verified as boolean with default false', () => {
      expect(props.is_phone_verified).toEqual({ type: 'boolean', default: false });
    });

    it('should define status with valid enum values including pending_account_deletion', () => {
      expect(props.status).toEqual({
        type: 'string',
        enum: ['active', 'inactive', 'blocked', 'pending_deactivation', 'pending_account_deletion', 'deleted'],
      });
    });

    it('should define is_deactivated as boolean with default false', () => {
      expect(props.is_deactivated).toEqual({ type: 'boolean', default: false });
    });

    it('should define require_password_reset as boolean with default false', () => {
      expect(props.require_password_reset).toEqual({ type: 'boolean', default: false });
    });

    it('should define require_transaction_pin_reset as boolean with default false', () => {
      expect(props.require_transaction_pin_reset).toEqual({ type: 'boolean', default: false });
    });
  });

  describe('property validation', () => {
    it('should have all expected properties defined', () => {
      const expectedProps = [
        'username',
        'first_name',
        'middle_name',
        'last_name',
        'email',
        'password',
        'is_email_verified',
        'phone_number',
        'phone_number_country_code',
        'is_phone_verified',
        'status',
        'is_deactivated',
        'require_password_reset',
        'require_transaction_pin_reset',
        'disable_login_restrictions',
      ];

      const actualProps = Object.keys(UserValidationSchema.properties);
      const sortedExpected = [...expectedProps];
      const sortedActual = [...actualProps];
      sortedExpected.sort((a, b) => a.localeCompare(b));
      sortedActual.sort((a, b) => a.localeCompare(b));
      expect(sortedActual).toEqual(sortedExpected);
    });
  });
});
