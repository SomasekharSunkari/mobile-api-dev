import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { BankBeneficiaryModel } from './bankBeneficiary.model';
import { BankBeneficiaryValidationSchema } from './bankBeneficiary.validation';

jest.mock('../../base');

describe('BankBeneficiaryModel', () => {
  describe('tableName', () => {
    it('should return the correct table name', () => {
      expect(BankBeneficiaryModel.tableName).toBe(`${DatabaseSchema.apiService}.${DatabaseTables.bank_beneficiaries}`);
    });
  });

  describe('jsonSchema', () => {
    it('should return the bank beneficiary validation schema', () => {
      expect(BankBeneficiaryModel.jsonSchema).toBe(BankBeneficiaryValidationSchema);
    });
  });

  describe('instance properties', () => {
    let model: BankBeneficiaryModel;

    beforeEach(() => {
      model = new BankBeneficiaryModel();
      model.user_id = 'user-123';
      model.currency = 'USD';
      model.alias_name = 'My Bank Account';
      model.avatar_url = 'https://example.com/avatar.png';
      model.account_number = '1234567890';
      model.iban = 'US64SVBKUS6S3300958879';
      model.account_name = 'John Doe';
      model.bank_name = 'Bank of America';
      model.bank_code = 'BOFAUS3N';
      model.swift_code = 'BOFAUS3N';
      model.routing_number = '026009593';
      model.bank_logo = 'https://example.com/boa-logo.png';
      model.bank_short_name = 'BoA';
      model.bank_country = 'United States';
      model.bank_address = '100 North Tryon Street';
      model.bank_city = 'Charlotte';
      model.bank_state = 'North Carolina';
      model.bank_zip = '28255';
      model.bank_phone = '+1-800-432-1000';
      model.bank_email = 'info@bankofamerica.com';
      model.bank_website = 'https://www.bankofamerica.com';
      model.bank_ref = 'bank-ref-123';
    });

    it('should properly store the required properties', () => {
      expect(model.user_id).toBe('user-123');
      expect(model.currency).toBe('USD');
      expect(model.alias_name).toBe('My Bank Account');
    });

    it('should properly store the optional properties', () => {
      expect(model.avatar_url).toBe('https://example.com/avatar.png');
      expect(model.account_number).toBe('1234567890');
      expect(model.iban).toBe('US64SVBKUS6S3300958879');
      expect(model.account_name).toBe('John Doe');
      expect(model.bank_name).toBe('Bank of America');
      expect(model.bank_code).toBe('BOFAUS3N');
      expect(model.swift_code).toBe('BOFAUS3N');
      expect(model.routing_number).toBe('026009593');
      expect(model.bank_logo).toBe('https://example.com/boa-logo.png');
      expect(model.bank_short_name).toBe('BoA');
      expect(model.bank_country).toBe('United States');
      expect(model.bank_address).toBe('100 North Tryon Street');
      expect(model.bank_city).toBe('Charlotte');
      expect(model.bank_state).toBe('North Carolina');
      expect(model.bank_zip).toBe('28255');
      expect(model.bank_phone).toBe('+1-800-432-1000');
      expect(model.bank_email).toBe('info@bankofamerica.com');
      expect(model.bank_website).toBe('https://www.bankofamerica.com');
      expect(model.bank_ref).toBe('bank-ref-123');
    });

    it('should inherit from BaseModel', () => {
      expect(model).toBeInstanceOf(BaseModel);
    });

    it('should handle minimal required properties only', () => {
      const minimalModel = new BankBeneficiaryModel();
      minimalModel.user_id = 'user-456';
      minimalModel.currency = 'EUR';
      minimalModel.alias_name = 'European Bank';

      expect(minimalModel.user_id).toBe('user-456');
      expect(minimalModel.currency).toBe('EUR');
      expect(minimalModel.alias_name).toBe('European Bank');
      expect(minimalModel.avatar_url).toBeUndefined();
      expect(minimalModel.account_number).toBeUndefined();
      expect(minimalModel.iban).toBeUndefined();
      expect(minimalModel.bank_name).toBeUndefined();
      expect(minimalModel.bank_ref).toBeUndefined();
    });

    it('should handle different currency types', () => {
      const currencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'NGN', 'GHS'];

      currencies.forEach((currency) => {
        const testModel = new BankBeneficiaryModel();
        testModel.currency = currency;
        expect(testModel.currency).toBe(currency);
      });
    });

    it('should handle IBAN format correctly', () => {
      const ibans = [
        'GB29NWBK60161331926819', // UK IBAN
        'DE89370400440532013000', // German IBAN
        'FR1420041010050500013M02606', // French IBAN
        'US64SVBKUS6S3300958879', // US IBAN
      ];

      ibans.forEach((iban) => {
        const testModel = new BankBeneficiaryModel();
        testModel.iban = iban;
        expect(testModel.iban).toBe(iban);
      });
    });

    it('should handle SWIFT code format correctly', () => {
      const swiftCodes = [
        'BOFAUS3N', // Bank of America
        'CHASUS33', // Chase Bank
        'CITIUS33', // Citibank
        'ABNANL2A', // ABN AMRO (Netherlands)
        'DEUTDEFF', // Deutsche Bank (Germany)
      ];

      swiftCodes.forEach((swiftCode) => {
        const testModel = new BankBeneficiaryModel();
        testModel.swift_code = swiftCode;
        expect(testModel.swift_code).toBe(swiftCode);
      });
    });

    it('should handle routing number format correctly', () => {
      const routingNumbers = [
        '026009593', // Bank of America
        '021000021', // Chase Bank
        '321171184', // Wells Fargo
        '111000025', // Federal Reserve Bank
      ];

      routingNumbers.forEach((routingNumber) => {
        const testModel = new BankBeneficiaryModel();
        testModel.routing_number = routingNumber;
        expect(testModel.routing_number).toBe(routingNumber);
      });
    });

    it('should handle different country formats', () => {
      const countries = [
        'United States',
        'United Kingdom',
        'Germany',
        'France',
        'Canada',
        'Australia',
        'Nigeria',
        'Ghana',
      ];

      countries.forEach((country) => {
        const testModel = new BankBeneficiaryModel();
        testModel.bank_country = country;
        expect(testModel.bank_country).toBe(country);
      });
    });

    it('should handle email format correctly', () => {
      const emails = [
        'info@bankofamerica.com',
        'customer.service@chase.com',
        'support@wellsfargo.com',
        'contact@deutsche-bank.de',
      ];

      emails.forEach((email) => {
        const testModel = new BankBeneficiaryModel();
        testModel.bank_email = email;
        expect(testModel.bank_email).toBe(email);
      });
    });

    it('should handle website URL format correctly', () => {
      const websites = [
        'https://www.bankofamerica.com',
        'https://www.chase.com',
        'https://www.wellsfargo.com',
        'https://www.deutsche-bank.de',
      ];

      websites.forEach((website) => {
        const testModel = new BankBeneficiaryModel();
        testModel.bank_website = website;
        expect(testModel.bank_website).toBe(website);
      });
    });

    it('should handle phone number format correctly', () => {
      const phoneNumbers = ['+1-800-432-1000', '+1-877-242-7372', '+44-20-7888-8888', '+49-69-910-00'];

      phoneNumbers.forEach((phoneNumber) => {
        const testModel = new BankBeneficiaryModel();
        testModel.bank_phone = phoneNumber;
        expect(testModel.bank_phone).toBe(phoneNumber);
      });
    });

    it('should handle bank_ref correctly', () => {
      const bankRefs = ['bank-ref-001', 'ref-abc-123', 'PAGA-001', 'NG-BANK-REF'];

      bankRefs.forEach((bankRef) => {
        const testModel = new BankBeneficiaryModel();
        testModel.bank_ref = bankRef;
        expect(testModel.bank_ref).toBe(bankRef);
      });
    });
  });
});
