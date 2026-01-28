import { TransactionPinModel } from './transactionPin.model';
import { TransactionPinValidationSchema } from './transactionPin.validation';
import { UserModel } from '../user';
import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';

describe('TransactionPinModel', () => {
  describe('tableName', () => {
    it('should return the correct table name', () => {
      expect(TransactionPinModel.tableName).toBe(`${DatabaseSchema.apiService}.${DatabaseTables.transaction_pins}`);
    });
  });

  describe('jsonSchema', () => {
    it('should return the transaction pin validation schema', () => {
      expect(TransactionPinModel.jsonSchema).toBe(TransactionPinValidationSchema);
    });
  });

  describe('relationMappings', () => {
    beforeEach(() => {
      BaseModel.BelongsToOneRelation = 'BelongsToOneRelation' as any;
    });

    it('should define the user relation correctly', () => {
      const relations = TransactionPinModel.relationMappings;

      expect(relations.user).toBeDefined();
      expect(relations.user.relation).toBe('BelongsToOneRelation');
      expect(relations.user.modelClass).toBe(UserModel);
      expect(relations.user.join).toEqual({
        from: `${DatabaseSchema.apiService}.${DatabaseTables.transaction_pins}.user_id`,
        to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
      });
    });
  });

  describe('modifiers', () => {
    it('should have a notDeleted modifier', () => {
      const modifiers = TransactionPinModel.modifiers;

      expect(modifiers.notDeleted).toBeDefined();
      expect(typeof modifiers.notDeleted).toBe('function');

      const mockQuery = { whereNull: jest.fn() };
      modifiers.notDeleted(mockQuery as any);

      expect(mockQuery.whereNull).toHaveBeenCalledWith('deleted_at');
    });
  });
});
