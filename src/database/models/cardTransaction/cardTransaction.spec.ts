import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { CardTransactionModel } from './cardTransaction.model';
import { CardTransactionValidationSchema } from './cardTransaction.validation';
import { CardTransactionStatus, CardTransactionType, CardTransactionDrCr } from './cardTransaction.interface';

jest.mock('../../base');

describe('CardTransaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Validation Schema', () => {
    it('should have the correct title and type', () => {
      expect(CardTransactionValidationSchema.title).toBe('Card Transaction Validation Schema');
      expect(CardTransactionValidationSchema.type).toBe('object');
    });

    it('should require specific fields', () => {
      const requiredFields = CardTransactionValidationSchema.required;

      expect(requiredFields).toContain('user_id');
      expect(requiredFields).toContain('card_user_id');
      expect(requiredFields).toContain('amount');
      expect(requiredFields).toContain('currency');
      expect(requiredFields).toContain('merchant_name');
      expect(requiredFields).toContain('status');
      expect(requiredFields).toContain('transaction_type');
      expect(requiredFields).toContain('type');
    });

    it('should define nullable and typed properties', () => {
      const properties = CardTransactionValidationSchema.properties as Record<string, any>;
      expect(properties.card_id.type).toEqual(['string', 'null']);
      expect(properties.provider_reference.type).toEqual(['string', 'null']);
      expect(properties.transactionhash.type).toEqual(['string', 'null']);
      expect(properties.authorized_amount.type).toEqual(['number', 'null']);
      expect(properties.authorization_method.type).toEqual(['string', 'null']);
      expect(properties.merchant_id.type).toEqual(['string', 'null']);
      expect(properties.merchant_city.type).toEqual(['string', 'null']);
      expect(properties.merchant_country.type).toEqual(['string', 'null']);
      expect(properties.merchant_category.type).toEqual(['string', 'null']);
      expect(properties.merchant_category_code.type).toEqual(['string', 'null']);
      expect(properties.card_id.type).toEqual(['string', 'null']);
      expect(properties.declined_reason.type).toEqual(['string', 'null']);
      expect(properties.authorized_at.type).toEqual(['string', 'null']);
      expect(properties.balance_before.type).toEqual(['number', 'null']);
      expect(properties.balance_after.type).toEqual(['number', 'null']);
    });
  });

  describe('Model', () => {
    describe('tableName', () => {
      it('should return the correct table name', () => {
        expect(CardTransactionModel.tableName).toBe(`${DatabaseSchema.apiService}.${DatabaseTables.card_transactions}`);
      });
    });

    describe('jsonSchema', () => {
      it('should return the validation schema', () => {
        expect(CardTransactionModel.jsonSchema).toBe(CardTransactionValidationSchema);
      });
    });

    describe('publicProperty', () => {
      it('should include default public properties', () => {
        const properties = CardTransactionModel.publicProperty();

        expect(properties).toContain('id');
        expect(properties).toContain('user_id');
        expect(properties).toContain('card_user_id');
        expect(properties).toContain('card_id');
        expect(properties).toContain('amount');
        expect(properties).toContain('currency');
        expect(properties).toContain('merchant_name');
        expect(properties).toContain('status');
        expect(properties).toContain('transaction_type');
        expect(properties).toContain('type');
        expect(properties).toContain('created_at');
        expect(properties).toContain('updated_at');
      });

      it('should include additional properties when provided', () => {
        const props = CardTransactionModel.publicProperty(['extra'] as any);
        expect(props).toContain('extra');
      });
    });

    describe('relationMappings', () => {
      beforeEach(() => {
        BaseModel.BelongsToOneRelation = 'BelongsToOneRelation' as any;
      });

      it('should define the user relation correctly', () => {
        const relations = CardTransactionModel.relationMappings as any;
        expect(relations.user).toBeDefined();
        expect(relations.user.relation).toBe('BelongsToOneRelation');
        expect(relations.user.join).toEqual({
          from: `${DatabaseSchema.apiService}.${DatabaseTables.card_transactions}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        });
      });

      it('should define the cardUser relation correctly', () => {
        const relations = CardTransactionModel.relationMappings as any;
        expect(relations.cardUser).toBeDefined();
        expect(relations.cardUser.relation).toBe('BelongsToOneRelation');
        expect(relations.cardUser.join).toEqual({
          from: `${DatabaseSchema.apiService}.${DatabaseTables.card_transactions}.card_user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.card_users}.id`,
        });
      });

      it('should define the card relation correctly', () => {
        const relations = CardTransactionModel.relationMappings as any;
        expect(relations.card).toBeDefined();
        expect(relations.card.relation).toBe('BelongsToOneRelation');
        expect(relations.card.join).toEqual({
          from: `${DatabaseSchema.apiService}.${DatabaseTables.card_transactions}.card_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.cards}.id`,
        });
      });
    });

    describe('instance properties', () => {
      it('should store instance properties correctly', () => {
        const model = new CardTransactionModel();
        model.user_id = 'user1';
        model.card_user_id = 'cardUser1';
        model.card_id = 'uvc1';
        model.amount = 100;
        model.currency = 'USD';
        model.merchant_name = 'MerchantX';
        model.status = CardTransactionStatus.PENDING;
        model.transaction_type = CardTransactionType.DEPOSIT;
        model.type = CardTransactionDrCr.CREDIT;

        expect(model.user_id).toBe('user1');
        expect(model.card_user_id).toBe('cardUser1');
        expect(model.card_id).toBe('uvc1');
        expect(model.amount).toBe(100);
        expect(model.currency).toBe('USD');
        expect(model.merchant_name).toBe('MerchantX');
        expect(model.status).toBe('pending');
        expect(model.transaction_type).toBe('deposit');
        expect(model.type).toBe('credit');
      });
    });
  });
});
