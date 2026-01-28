import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { ResetTransactionPinModel } from './resetTransactionPin.model';
import { ResetTransactionPinValidationSchema } from './resetTransactionPin.validation';
import { UserModel } from '../user/user.model';

jest.mock('../../base');

describe('ResetTransactionPinModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('tableName', () => {
    it('should return the correct table name', () => {
      expect(ResetTransactionPinModel.tableName).toBe(
        `${DatabaseSchema.apiService}.${DatabaseTables.reset_transaction_pins}`,
      );
    });
  });

  describe('jsonSchema', () => {
    it('should return the reset pin validation schema', () => {
      expect(ResetTransactionPinModel.jsonSchema).toBe(ResetTransactionPinValidationSchema);
    });
  });

  describe('relationMappings', () => {
    beforeEach(() => {
      BaseModel.BelongsToOneRelation = 'HasOneRelation' as any;
    });

    it('should define the user relation correctly', () => {
      const relations = ResetTransactionPinModel.relationMappings;

      expect(relations.user).toBeDefined();
      expect(relations.user.relation).toBe(BaseModel.HasOneRelation);
      expect(relations.user.modelClass).toBe(UserModel);
      expect(relations.user.join).toEqual({
        from: `${DatabaseSchema.apiService}.${DatabaseTables.reset_transaction_pins}.user_id`,
        to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
      });
    });
  });

  describe('modifiers', () => {
    it('should have a notDeleted modifier', () => {
      const modifiers = ResetTransactionPinModel.modifiers;

      expect(modifiers.notDeleted).toBeDefined();
      expect(typeof modifiers.notDeleted).toBe('function');

      const mockQuery = { whereNull: jest.fn() };
      modifiers.notDeleted(mockQuery as any);

      expect(mockQuery.whereNull).toHaveBeenCalledWith('deleted_at');
    });
  });

  describe('instance properties', () => {
    let resetPinModel: ResetTransactionPinModel;

    beforeEach(() => {
      resetPinModel = new ResetTransactionPinModel();
      resetPinModel.user_id = 'user123';
      resetPinModel.code = '123456';
      resetPinModel.is_used = false;
      resetPinModel.expiration_time = new Date().toISOString();
    });

    it('should properly store the instance properties', () => {
      expect(resetPinModel.user_id).toBe('user123');
      expect(resetPinModel.code).toBe('123456');
      expect(resetPinModel.is_used).toBe(false);
      expect(typeof resetPinModel.expiration_time).toBe('string');
    });

    it('should inherit from BaseModel', () => {
      expect(resetPinModel).toBeInstanceOf(BaseModel);
    });
  });
});
