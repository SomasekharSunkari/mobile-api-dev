import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { ICardStatus } from './card.interface';
import { CardModel } from './card.model';
import { CardValidationSchema } from './card.validation';

jest.mock('../../base');

describe('Card', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ICardStatus', () => {
    it('should define the correct status values', () => {
      expect(ICardStatus.PENDING).toBe('pending');
      expect(ICardStatus.ACTIVE).toBe('active');
      expect(ICardStatus.INACTIVE).toBe('inactive');
      expect(ICardStatus.SUSPENDED).toBe('suspended');
      expect(ICardStatus.BLOCKED).toBe('blocked');
      expect(ICardStatus.EXPIRED).toBe('expired');
    });

    it('should have exactly seven status types', () => {
      const statusValues = Object.values(ICardStatus);
      expect(statusValues.length).toBe(7);
      expect(statusValues).toEqual(['pending', 'active', 'inactive', 'suspended', 'blocked', 'canceled', 'expired']);
    });
  });

  describe('CardValidationSchema', () => {
    it('should have the correct title', () => {
      expect(CardValidationSchema.title).toBe('Card Validation Schema');
    });

    it('should be of type object', () => {
      expect(CardValidationSchema.type).toBe('object');
    });

    it('should require specific fields', () => {
      const requiredFields = CardValidationSchema.required as string[];

      expect(requiredFields).toContain('user_id');
      expect(requiredFields).toContain('card_user_id');
      expect(requiredFields).toContain('status');
    });

    describe('properties', () => {
      const properties = CardValidationSchema.properties as Record<string, any>;

      it('should have user_id as string', () => {
        expect(properties.user_id.type).toBe('string');
      });

      it('should have card_user_id as string', () => {
        expect(properties.card_user_id.type).toBe('string');
      });

      it('should have provider_ref as nullable string', () => {
        expect(properties.provider_ref.type).toEqual(['string', 'null']);
      });

      it('should have status as string with valid enum values and default', () => {
        expect(properties.status.type).toBe('string');
        expect(properties.status.enum).toEqual(Object.values(ICardStatus));
        expect(properties.status.default).toBe('pending');
      });

      it('should have limit as nullable number with minimum 0', () => {
        expect(properties.limit.type).toEqual(['number', 'null']);
        expect(properties.limit.minimum).toBe(0);
      });

      it('should have limit_frequency as nullable string', () => {
        expect(properties.limit_frequency.type).toEqual(['string', 'null']);
      });

      it('should have display_name as nullable string', () => {
        expect(properties.display_name.type).toEqual(['string', 'null']);
      });

      it('should have provider_product_id as nullable string', () => {
        expect(properties.provider_product_id.type).toEqual(['string', 'null']);
      });

      it('should have provider_product_ref as nullable string', () => {
        expect(properties.provider_product_ref.type).toEqual(['string', 'null']);
      });

      it('should have art_id as nullable string', () => {
        expect(properties.art_id.type).toEqual(['string', 'null']);
      });

      it('should have last_four_digits as nullable string with max length 4', () => {
        expect(properties.last_four_digits.type).toEqual(['string', 'null']);
        expect(properties.last_four_digits.maxLength).toBe(4);
      });

      it('should have address_line_1 as nullable string', () => {
        expect(properties.address_line_1.type).toEqual(['string', 'null']);
      });

      it('should have address_line_2 as nullable string', () => {
        expect(properties.address_line_2.type).toEqual(['string', 'null']);
      });

      it('should have city as nullable string', () => {
        expect(properties.city.type).toEqual(['string', 'null']);
      });

      it('should have region as nullable string', () => {
        expect(properties.region.type).toEqual(['string', 'null']);
      });

      it('should have postal_code as nullable string', () => {
        expect(properties.postal_code.type).toEqual(['string', 'null']);
      });

      it('should have country_id as nullable string', () => {
        expect(properties.country_id.type).toEqual(['string', 'null']);
      });

      it('should have is_freezed as boolean with default false', () => {
        expect(properties.is_freezed.type).toBe('boolean');
        expect(properties.is_freezed.default).toBe(false);
      });

      it('should have expiration_month as nullable string', () => {
        expect(properties.expiration_month.type).toEqual(['string', 'null']);
      });

      it('should have expiration_year as nullable string', () => {
        expect(properties.expiration_year.type).toEqual(['string', 'null']);
      });
    });
  });

  describe('CardModel', () => {
    describe('tableName', () => {
      it('should return the correct table name', () => {
        expect(CardModel.tableName).toBe(`${DatabaseSchema.apiService}.${DatabaseTables.cards}`);
      });
    });

    describe('jsonSchema', () => {
      it('should return the card validation schema', () => {
        expect(CardModel.jsonSchema).toBe(CardValidationSchema);
      });
    });

    describe('publicProperty', () => {
      it('should return the default public properties', () => {
        const properties = CardModel.publicProperty();

        expect(properties).toContain('id');
        expect(properties).toContain('user_id');
        expect(properties).toContain('card_user_id');
        expect(properties).toContain('provider_ref');
        expect(properties).toContain('status');
        expect(properties).toContain('limit');
        expect(properties).toContain('limit_frequency');
        expect(properties).toContain('display_name');
        expect(properties).toContain('provider_product_id');
        expect(properties).toContain('provider_product_ref');
        expect(properties).toContain('art_id');
        expect(properties).toContain('last_four_digits');
        expect(properties).toContain('address_line_1');
        expect(properties).toContain('address_line_2');
        expect(properties).toContain('city');
        expect(properties).toContain('region');
        expect(properties).toContain('postal_code');
        expect(properties).toContain('country_id');
        expect(properties).toContain('is_freezed');
        expect(properties).toContain('expiration_month');
        expect(properties).toContain('expiration_year');
        expect(properties).toContain('created_at');
        expect(properties).toContain('updated_at');
      });

      it('should include additional properties when provided', () => {
        const additionalProps = ['some_prop', 'another_prop'] as any[];
        const properties = CardModel.publicProperty(additionalProps);

        expect(properties).toContain('id');
        expect(properties).toContain('some_prop');
        expect(properties).toContain('another_prop');
      });
    });

    describe('relationMappings', () => {
      beforeEach(() => {
        BaseModel.BelongsToOneRelation = 'BelongsToOneRelation' as any;
      });

      it('should define the user relation correctly', () => {
        const relations = CardModel.relationMappings;

        expect(relations.user).toBeDefined();
        expect(relations.user.relation).toBe('BelongsToOneRelation');
        expect(relations.user.join).toEqual({
          from: `${DatabaseSchema.apiService}.${DatabaseTables.cards}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        });
      });

      it('should define the cardUser relation correctly', () => {
        const relations = CardModel.relationMappings;

        expect(relations.cardUser).toBeDefined();
        expect(relations.cardUser.relation).toBe('BelongsToOneRelation');
        expect(relations.cardUser.join).toEqual({
          from: `${DatabaseSchema.apiService}.${DatabaseTables.cards}.card_user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.card_users}.id`,
        });
      });

      it('should define the country relation correctly', () => {
        const relations = CardModel.relationMappings;

        expect(relations.country).toBeDefined();
        expect(relations.country.relation).toBe('BelongsToOneRelation');
        expect(relations.country.join).toEqual({
          from: `${DatabaseSchema.apiService}.${DatabaseTables.cards}.country_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.countries}.id`,
        });
      });
    });

    describe('modifiers', () => {
      it('should have a notDeleted modifier', () => {
        const modifiers = CardModel.modifiers;

        expect(modifiers.notDeleted).toBeDefined();
        expect(typeof modifiers.notDeleted).toBe('function');

        const mockQuery = { whereNull: jest.fn() };
        modifiers.notDeleted(mockQuery as any);

        expect(mockQuery.whereNull).toHaveBeenCalledWith('deleted_at');
      });
    });

    describe('instance properties', () => {
      let cardModel: CardModel;

      beforeEach(() => {
        cardModel = new CardModel();
        cardModel.user_id = 'user123';
        cardModel.card_user_id = 'card_user123';
        cardModel.provider_ref = 'prov_ref_123';
        cardModel.status = ICardStatus.ACTIVE;
        cardModel.limit = 5000;
        cardModel.limit_frequency = 'monthly';
        cardModel.display_name = 'My Travel Card';
        cardModel.provider_product_id = 'prod_123';
        cardModel.provider_product_ref = 'prod_ref_123';
        cardModel.art_id = 'art_123';
        cardModel.address_line_1 = '123 Main St';
        cardModel.address_line_2 = 'Apt 4B';
        cardModel.city = 'New York';
        cardModel.region = 'NY';
        cardModel.postal_code = '10001';
        cardModel.country_id = 'country123';
        cardModel.is_freezed = false;
        cardModel.expiration_month = '12';
        cardModel.expiration_year = '2028';
      });

      it('should properly store the instance properties', () => {
        expect(cardModel.user_id).toBe('user123');
        expect(cardModel.card_user_id).toBe('card_user123');
        expect(cardModel.provider_ref).toBe('prov_ref_123');
        expect(cardModel.status).toBe(ICardStatus.ACTIVE);
        expect(cardModel.limit).toBe(5000);
        expect(cardModel.limit_frequency).toBe('monthly');
        expect(cardModel.display_name).toBe('My Travel Card');
        expect(cardModel.provider_product_id).toBe('prod_123');
        expect(cardModel.provider_product_ref).toBe('prod_ref_123');
        expect(cardModel.art_id).toBe('art_123');
        expect(cardModel.address_line_1).toBe('123 Main St');
        expect(cardModel.address_line_2).toBe('Apt 4B');
        expect(cardModel.city).toBe('New York');
        expect(cardModel.region).toBe('NY');
        expect(cardModel.postal_code).toBe('10001');
        expect(cardModel.country_id).toBe('country123');
        expect(cardModel.is_freezed).toBe(false);
        expect(cardModel.expiration_month).toBe('12');
        expect(cardModel.expiration_year).toBe('2028');
      });

      it('should inherit from BaseModel', () => {
        expect(cardModel).toBeInstanceOf(BaseModel);
      });

      it('should handle optional properties as undefined', () => {
        const newCardModel = new CardModel();
        newCardModel.user_id = 'user456';
        newCardModel.card_user_id = 'card_user456';
        newCardModel.status = ICardStatus.PENDING;
        newCardModel.is_freezed = false;

        expect(newCardModel.provider_ref).toBeUndefined();
        expect(newCardModel.limit).toBeUndefined();
        expect(newCardModel.limit_frequency).toBeUndefined();
        expect(newCardModel.display_name).toBeUndefined();
        expect(newCardModel.provider_product_id).toBeUndefined();
        expect(newCardModel.provider_product_ref).toBeUndefined();
        expect(newCardModel.art_id).toBeUndefined();
        expect(newCardModel.address_line_1).toBeUndefined();
        expect(newCardModel.address_line_2).toBeUndefined();
        expect(newCardModel.city).toBeUndefined();
        expect(newCardModel.region).toBeUndefined();
        expect(newCardModel.postal_code).toBeUndefined();
        expect(newCardModel.country_id).toBeUndefined();
        expect(newCardModel.expiration_month).toBeUndefined();
        expect(newCardModel.expiration_year).toBeUndefined();
      });
    });

    describe('status transitions', () => {
      let cardModel: CardModel;

      beforeEach(() => {
        cardModel = new CardModel();
        cardModel.user_id = 'user123';
        cardModel.card_user_id = 'card_user123';
        cardModel.is_freezed = false;
      });

      it('should allow setting different status values', () => {
        cardModel.status = ICardStatus.PENDING;
        expect(cardModel.status).toBe('pending');

        cardModel.status = ICardStatus.ACTIVE;
        expect(cardModel.status).toBe('active');

        cardModel.status = ICardStatus.INACTIVE;
        expect(cardModel.status).toBe('inactive');

        cardModel.status = ICardStatus.SUSPENDED;
        expect(cardModel.status).toBe('suspended');

        cardModel.status = ICardStatus.BLOCKED;
        expect(cardModel.status).toBe('blocked');

        cardModel.status = ICardStatus.EXPIRED;
        expect(cardModel.status).toBe('expired');
      });
    });

    describe('card freezing functionality', () => {
      let cardModel: CardModel;

      beforeEach(() => {
        cardModel = new CardModel();
        cardModel.user_id = 'user123';
        cardModel.card_user_id = 'card_user123';
        cardModel.status = ICardStatus.ACTIVE;
      });

      it('should allow freezing and unfreezing the card', () => {
        cardModel.is_freezed = false;
        expect(cardModel.is_freezed).toBe(false);

        cardModel.is_freezed = true;
        expect(cardModel.is_freezed).toBe(true);

        cardModel.is_freezed = false;
        expect(cardModel.is_freezed).toBe(false);
      });
    });

    describe('card expiration', () => {
      let cardModel: CardModel;

      beforeEach(() => {
        cardModel = new CardModel();
        cardModel.user_id = 'user123';
        cardModel.card_user_id = 'card_user123';
        cardModel.status = ICardStatus.ACTIVE;
        cardModel.is_freezed = false;
      });

      it('should store expiration information correctly', () => {
        cardModel.expiration_month = '06';
        cardModel.expiration_year = '2030';

        expect(cardModel.expiration_month).toBe('06');
        expect(cardModel.expiration_year).toBe('2030');
      });

      it('should handle expiration fields as optional', () => {
        expect(cardModel.expiration_month).toBeUndefined();
        expect(cardModel.expiration_year).toBeUndefined();
      });
    });

    describe('spending limits', () => {
      let cardModel: CardModel;

      beforeEach(() => {
        cardModel = new CardModel();
        cardModel.user_id = 'user123';
        cardModel.card_user_id = 'card_user123';
        cardModel.status = ICardStatus.ACTIVE;
        cardModel.is_freezed = false;
      });

      it('should store spending limit and frequency correctly', () => {
        cardModel.limit = 10000;
        cardModel.limit_frequency = 'daily';

        expect(cardModel.limit).toBe(10000);
        expect(cardModel.limit_frequency).toBe('daily');
      });

      it('should handle limit fields as optional', () => {
        expect(cardModel.limit).toBeUndefined();
        expect(cardModel.limit_frequency).toBeUndefined();
      });
    });
  });
});
