import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { ICardUserStatus } from './cardUser.interface';
import { CardUserModel } from './cardUser.model';
import { CardUserValidationSchema } from './cardUser.validation';

jest.mock('../../base');

describe('CardUser', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Interface Tests
  describe('ICardUserStatus', () => {
    it('should define the correct status values', () => {
      expect(ICardUserStatus.PENDING).toBe('pending');
      expect(ICardUserStatus.APPROVED).toBe('approved');
      expect(ICardUserStatus.REJECTED).toBe('rejected');
      expect(ICardUserStatus.ACTIVE).toBe('active');
      expect(ICardUserStatus.INACTIVE).toBe('inactive');
      expect(ICardUserStatus.SUSPENDED).toBe('suspended');
    });

    it('should have exactly six status types', () => {
      const statusValues = Object.values(ICardUserStatus);
      expect(statusValues.length).toBe(6);
      expect(statusValues).toEqual(['pending', 'approved', 'rejected', 'active', 'inactive', 'suspended']);
    });
  });

  // Validation Schema Tests
  describe('CardUserValidationSchema', () => {
    it('should have the correct title', () => {
      expect(CardUserValidationSchema.title).toBe('Card User Validation Schema');
    });

    it('should be of type object', () => {
      expect(CardUserValidationSchema.type).toBe('object');
    });

    it('should require specific fields', () => {
      const requiredFields = CardUserValidationSchema.required as string[];

      expect(requiredFields).toContain('user_id');
      expect(requiredFields).toContain('country_id');
    });

    describe('properties', () => {
      const properties = CardUserValidationSchema.properties as Record<string, any>;

      it('should have user_id as string', () => {
        expect(properties.user_id.type).toBe('string');
      });

      it('should have provider_ref as nullable string', () => {
        expect(properties.provider_ref.type).toEqual(['string', 'null']);
      });

      it('should have provider_status as nullable string', () => {
        expect(properties.provider_status.type).toEqual(['string', 'null']);
      });

      it('should have status as string with valid enum values and default', () => {
        expect(properties.status.type).toBe('string');
        expect(properties.status.enum).toEqual(Object.values(ICardUserStatus));
        expect(properties.status.default).toBe('pending');
      });

      it('should have provider_application_status_reason as nullable string', () => {
        expect(properties.provider_application_status_reason.type).toEqual(['string', 'null']);
      });

      it('should have country_id as string', () => {
        expect(properties.country_id.type).toBe('string');
      });

      it('should have salary as nullable number with minimum 0', () => {
        expect(properties.salary.type).toEqual(['number', 'null']);
        expect(properties.salary.minimum).toBe(0);
      });

      it('should have ip_address as nullable string', () => {
        expect(properties.ip_address.type).toEqual(['string', 'null']);
      });

      it('should have occupation as nullable string', () => {
        expect(properties.occupation.type).toEqual(['string', 'null']);
      });

      it('should have usage_reason as nullable string', () => {
        expect(properties.usage_reason.type).toEqual(['string', 'null']);
      });

      it('should have monthly_spend as nullable number with minimum 0', () => {
        expect(properties.monthly_spend.type).toEqual(['number', 'null']);
        expect(properties.monthly_spend.minimum).toBe(0);
      });

      it('should have wallet_address as nullable string', () => {
        expect(properties.wallet_address.type).toEqual(['string', 'null']);
      });

      it('should have address_network_name as nullable string', () => {
        expect(properties.address_network_name.type).toEqual(['string', 'null']);
      });
    });
  });

  // Model Tests
  describe('CardUserModel', () => {
    describe('tableName', () => {
      it('should return the correct table name', () => {
        expect(CardUserModel.tableName).toBe(`${DatabaseSchema.apiService}.${DatabaseTables.card_users}`);
      });
    });

    describe('jsonSchema', () => {
      it('should return the card user validation schema', () => {
        expect(CardUserModel.jsonSchema).toBe(CardUserValidationSchema);
      });
    });

    describe('publicProperty', () => {
      it('should return the default public properties', () => {
        const properties = CardUserModel.publicProperty();

        expect(properties).toContain('id');
        expect(properties).toContain('user_id');
        expect(properties).toContain('provider_ref');
        expect(properties).toContain('provider_status');
        expect(properties).toContain('status');
        expect(properties).toContain('provider_application_status_reason');
        expect(properties).toContain('country_id');
        expect(properties).toContain('salary');
        expect(properties).toContain('ip_address');
        expect(properties).toContain('occupation');
        expect(properties).toContain('usage_reason');
        expect(properties).toContain('monthly_spend');
        expect(properties).toContain('wallet_address');
        expect(properties).toContain('address_network_name');
        expect(properties).toContain('created_at');
        expect(properties).toContain('updated_at');
      });

      it('should include additional properties when provided', () => {
        const additionalProps = ['some_prop', 'another_prop'] as any[];
        const properties = CardUserModel.publicProperty(additionalProps);

        expect(properties).toContain('id');
        expect(properties).toContain('some_prop');
        expect(properties).toContain('another_prop');
      });
    });

    describe('relationMappings', () => {
      beforeEach(() => {
        // Mock BelongsToOneRelation as a string instead of a function
        BaseModel.BelongsToOneRelation = 'BelongsToOneRelation' as any;
      });

      it('should define the user relation correctly', () => {
        const relations = CardUserModel.relationMappings;

        expect(relations.user).toBeDefined();
        expect(relations.user.relation).toBe('BelongsToOneRelation');
        expect(relations.user.join).toEqual({
          from: `${DatabaseSchema.apiService}.${DatabaseTables.card_users}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        });
      });

      it('should define the country relation correctly', () => {
        const relations = CardUserModel.relationMappings;

        expect(relations.country).toBeDefined();
        expect(relations.country.relation).toBe('BelongsToOneRelation');
        expect(relations.country.join).toEqual({
          from: `${DatabaseSchema.apiService}.${DatabaseTables.card_users}.country_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.countries}.id`,
        });
      });
    });

    describe('modifiers', () => {
      it('should have a notDeleted modifier', () => {
        const modifiers = CardUserModel.modifiers;

        expect(modifiers.notDeleted).toBeDefined();
        expect(typeof modifiers.notDeleted).toBe('function');

        const mockQuery = { whereNull: jest.fn() };
        modifiers.notDeleted(mockQuery as any);

        expect(mockQuery.whereNull).toHaveBeenCalledWith('deleted_at');
      });
    });

    describe('instance properties', () => {
      let cardUserModel: CardUserModel;

      beforeEach(() => {
        cardUserModel = new CardUserModel();
        cardUserModel.user_id = 'user123';
        cardUserModel.provider_ref = 'prov_ref_123';
        cardUserModel.provider_status = 'approved';
        cardUserModel.status = ICardUserStatus.ACTIVE;
        cardUserModel.provider_application_status_reason = 'Application approved successfully';
        cardUserModel.country_id = 'country123';
        cardUserModel.salary = 75000;
        cardUserModel.ip_address = '192.168.1.1';
        cardUserModel.occupation = 'Software Engineer';
        cardUserModel.usage_reason = 'Online shopping and travel';
        cardUserModel.monthly_spend = 2500;
        cardUserModel.wallet_address = '0x1234567890abcdef';
        cardUserModel.address_network_name = 'ethereum';
      });

      it('should properly store the instance properties', () => {
        expect(cardUserModel.user_id).toBe('user123');
        expect(cardUserModel.provider_ref).toBe('prov_ref_123');
        expect(cardUserModel.provider_status).toBe('approved');
        expect(cardUserModel.status).toBe(ICardUserStatus.ACTIVE);
        expect(cardUserModel.provider_application_status_reason).toBe('Application approved successfully');
        expect(cardUserModel.country_id).toBe('country123');
        expect(cardUserModel.salary).toBe(75000);
        expect(cardUserModel.ip_address).toBe('192.168.1.1');
        expect(cardUserModel.occupation).toBe('Software Engineer');
        expect(cardUserModel.usage_reason).toBe('Online shopping and travel');
        expect(cardUserModel.monthly_spend).toBe(2500);
        expect(cardUserModel.wallet_address).toBe('0x1234567890abcdef');
        expect(cardUserModel.address_network_name).toBe('ethereum');
      });

      it('should inherit from BaseModel', () => {
        expect(cardUserModel).toBeInstanceOf(BaseModel);
      });

      it('should handle optional properties as undefined', () => {
        const newCardUserModel = new CardUserModel();
        newCardUserModel.user_id = 'user456';
        newCardUserModel.country_id = 'country456';
        newCardUserModel.status = ICardUserStatus.PENDING;

        expect(newCardUserModel.provider_ref).toBeUndefined();
        expect(newCardUserModel.provider_status).toBeUndefined();
        expect(newCardUserModel.provider_application_status_reason).toBeUndefined();
        expect(newCardUserModel.salary).toBeUndefined();
        expect(newCardUserModel.ip_address).toBeUndefined();
        expect(newCardUserModel.occupation).toBeUndefined();
        expect(newCardUserModel.usage_reason).toBeUndefined();
        expect(newCardUserModel.monthly_spend).toBeUndefined();
        expect(newCardUserModel.wallet_address).toBeUndefined();
        expect(newCardUserModel.address_network_name).toBeUndefined();
      });
    });

    describe('status transitions', () => {
      let cardUserModel: CardUserModel;

      beforeEach(() => {
        cardUserModel = new CardUserModel();
        cardUserModel.user_id = 'user123';
        cardUserModel.country_id = 'country123';
      });

      it('should allow setting different status values', () => {
        cardUserModel.status = ICardUserStatus.PENDING;
        expect(cardUserModel.status).toBe('pending');

        cardUserModel.status = ICardUserStatus.APPROVED;
        expect(cardUserModel.status).toBe('approved');

        cardUserModel.status = ICardUserStatus.REJECTED;
        expect(cardUserModel.status).toBe('rejected');

        cardUserModel.status = ICardUserStatus.ACTIVE;
        expect(cardUserModel.status).toBe('active');

        cardUserModel.status = ICardUserStatus.INACTIVE;
        expect(cardUserModel.status).toBe('inactive');

        cardUserModel.status = ICardUserStatus.SUSPENDED;
        expect(cardUserModel.status).toBe('suspended');
      });
    });
  });
});
