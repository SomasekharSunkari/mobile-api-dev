import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { TierStatus } from './tier.interface';
import { TierModel } from './tier.model';
import { TierValidationSchema } from './tier.validation';

jest.mock('../../base');

describe('TierModel', () => {
  describe('tableName', () => {
    it('should return the correct table name', () => {
      expect(TierModel.tableName).toBe(`${DatabaseSchema.apiService}.${DatabaseTables.tiers}`);
    });
  });

  describe('jsonSchema', () => {
    it('should return the tier validation schema', () => {
      expect(TierModel.jsonSchema).toBe(TierValidationSchema);
    });
  });

  describe('instance properties', () => {
    let model: TierModel;
    beforeEach(() => {
      model = new TierModel();
      model.name = 'Gold';
      model.level = 2;
      model.description = 'Gold tier';
      model.status = TierStatus.ACTIVE;
    });
    it('should properly store the instance properties', () => {
      expect(model.name).toBe('Gold');
      expect(model.level).toBe(2);
      expect(model.description).toBe('Gold tier');
      expect(model.status).toBe(TierStatus.ACTIVE);
    });
    it('should inherit from BaseModel', () => {
      expect(model).toBeInstanceOf(BaseModel);
    });
  });
});
