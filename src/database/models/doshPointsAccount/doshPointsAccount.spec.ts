import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { UserModel } from '../user/user.model';
import { DoshPointsAccountStatus } from './doshPointsAccount.interface';
import { DoshPointsAccountModel } from './doshPointsAccount.model';
import { DoshPointsAccountValidationSchema } from './doshPointsAccount.validation';

describe('DoshPointsAccountModel', () => {
  describe('tableName', () => {
    it('should return correct table name with schema', () => {
      expect(DoshPointsAccountModel.tableName).toBe(
        `${DatabaseSchema.apiService}.${DatabaseTables.dosh_points_accounts}`,
      );
    });
  });

  describe('publicProperty', () => {
    it('should return default public properties when no argument provided', () => {
      const result = DoshPointsAccountModel.publicProperty();
      expect(result).toEqual([
        'id',
        'user_id',
        'balance',
        'status',
        'usd_fiat_rewards_enabled',
        'created_at',
        'updated_at',
      ]);
    });

    it('should merge additional properties with default public properties', () => {
      const additionalProps = ['user'];
      const result = DoshPointsAccountModel.publicProperty(additionalProps as any);
      expect(result).toContain('id');
      expect(result).toContain('balance');
      expect(result).toContain('user');
    });

    it('should handle empty array of additional properties', () => {
      const result = DoshPointsAccountModel.publicProperty([]);
      expect(result.length).toBe(7);
    });
  });

  describe('jsonSchema', () => {
    it('should return DoshPointsAccountValidationSchema', () => {
      expect(DoshPointsAccountModel.jsonSchema).toBe(DoshPointsAccountValidationSchema);
    });
  });

  describe('relationMappings', () => {
    const relations = DoshPointsAccountModel.relationMappings;

    it('should define user as BelongsToOneRelation', () => {
      expect(relations.user).toBeDefined();
      expect(relations.user.relation).toBe(BaseModel.BelongsToOneRelation);
      expect(relations.user.modelClass).toBe(UserModel);
      expect(relations.user.join.from).toBe(
        `${DatabaseSchema.apiService}.${DatabaseTables.dosh_points_accounts}.user_id`,
      );
      expect(relations.user.join.to).toBe(`${DatabaseSchema.apiService}.${DatabaseTables.users}.id`);
    });
  });

  describe('modifiers', () => {
    it('should define notDeleted modifier', () => {
      const modifiers = DoshPointsAccountModel.modifiers;
      expect(modifiers.notDeleted).toBeDefined();
      expect(typeof modifiers.notDeleted).toBe('function');
    });

    it('should apply whereNull on deleted_at column in notDeleted modifier', () => {
      const mockQuery = { whereNull: jest.fn() };
      const modifiers = DoshPointsAccountModel.modifiers;
      modifiers.notDeleted(mockQuery);
      expect(mockQuery.whereNull).toHaveBeenCalledWith('deleted_at');
    });

    it('should define active modifier', () => {
      const modifiers = DoshPointsAccountModel.modifiers;
      expect(modifiers.active).toBeDefined();
      expect(typeof modifiers.active).toBe('function');
    });

    it('should apply where status is active in active modifier', () => {
      const mockQuery = { where: jest.fn() };
      const modifiers = DoshPointsAccountModel.modifiers;
      modifiers.active(mockQuery);
      expect(mockQuery.where).toHaveBeenCalledWith('status', DoshPointsAccountStatus.ACTIVE);
    });
  });

  describe('model instantiation', () => {
    it('should create instance with all properties', () => {
      const account = new DoshPointsAccountModel();
      account.user_id = 'user-123';
      account.balance = 100;
      account.status = DoshPointsAccountStatus.ACTIVE;

      expect(account.user_id).toBe('user-123');
      expect(account.balance).toBe(100);
      expect(account.status).toBe(DoshPointsAccountStatus.ACTIVE);
    });
  });
});

describe('DoshPointsAccountValidationSchema', () => {
  describe('schema structure', () => {
    it('should have correct type and title', () => {
      expect(DoshPointsAccountValidationSchema.type).toBe('object');
      expect(DoshPointsAccountValidationSchema.title).toBe('Dosh Points Account Validation Schema');
    });

    it('should require user_id, balance, and status', () => {
      expect(DoshPointsAccountValidationSchema.required).toEqual(['user_id', 'balance', 'status']);
    });
  });

  describe('properties', () => {
    const props = DoshPointsAccountValidationSchema.properties;

    it('should define user_id as string', () => {
      expect(props.user_id).toEqual({ type: 'string' });
    });

    it('should define balance as integer with minimum 0', () => {
      expect(props.balance).toEqual({ type: 'integer', minimum: 0 });
    });

    it('should define status with valid enum values', () => {
      const statusProp = props.status as { type: string; enum: string[] };
      expect(statusProp.type).toBe('string');
      expect(statusProp.enum).toContain(DoshPointsAccountStatus.ACTIVE);
      expect(statusProp.enum).toContain(DoshPointsAccountStatus.FROZEN);
      expect(statusProp.enum).toContain(DoshPointsAccountStatus.CLOSED);
    });
  });
});

describe('DoshPointsAccountStatus', () => {
  it('should have ACTIVE status', () => {
    expect(DoshPointsAccountStatus.ACTIVE).toBe('active');
  });

  it('should have FROZEN status', () => {
    expect(DoshPointsAccountStatus.FROZEN).toBe('frozen');
  });

  it('should have CLOSED status', () => {
    expect(DoshPointsAccountStatus.CLOSED).toBe('closed');
  });
});
