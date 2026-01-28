import {
  DATE_TIME_FORMAT,
  EXCHANGE_EXPIRATION_TIME_IN_MINUTES,
  FAKE_ACCOUNT_NAME,
  FAKE_ACCOUNT_NUMBER,
  FAKE_BANK_CODE,
  FIREBLOCKS_ASSET_ID,
  FIREBLOCKS_MASTER_VAULT_ID,
  FIREBLOCKS_VAULT_ID,
  NO_OF_LIMITED_QUERIES,
  NUMBER_PRECISION,
  ONE_DAY_IN_SECONDS,
  ONE_HUNDRED_KILOBYTES,
  PAGA_DEVELOPMENT_BANK_ACCOUNT_NUMBER,
  PASSWORD_CONSTRAINT,
  PROVIDERS,
  SUPPORTED_KYC_COUNTRIES,
  ThrottleGroups,
  TransferDirection,
  YELLOWCARD_COLLECTION_SUCCESS_CRYPTO_CURRENCY,
  YELLOWCARD_COLLECTION_SUCCESS_CRYPTO_NETWORK,
  YELLOWCARD_COLLECTION_SUCCESS_WALLET_ADDRESS,
} from './constants';

describe('Constants', () => {
  describe('PASSWORD_CONSTRAINT', () => {
    it('should have correct password constraint values', () => {
      expect(PASSWORD_CONSTRAINT).toBeDefined();
      expect(PASSWORD_CONSTRAINT.minLength).toBe(8);
      expect(PASSWORD_CONSTRAINT.minNumbers).toBe(1);
      expect(PASSWORD_CONSTRAINT.minLowercase).toBe(1);
      expect(PASSWORD_CONSTRAINT.minSymbols).toBe(1);
      expect(PASSWORD_CONSTRAINT.minUppercase).toBe(1);
    });

    it('should be an object with all required properties', () => {
      expect(typeof PASSWORD_CONSTRAINT).toBe('object');
      expect(PASSWORD_CONSTRAINT).toHaveProperty('minLength');
      expect(PASSWORD_CONSTRAINT).toHaveProperty('minNumbers');
      expect(PASSWORD_CONSTRAINT).toHaveProperty('minLowercase');
      expect(PASSWORD_CONSTRAINT).toHaveProperty('minSymbols');
      expect(PASSWORD_CONSTRAINT).toHaveProperty('minUppercase');
    });
  });

  describe('NO_OF_LIMITED_QUERIES', () => {
    it('should be 10', () => {
      expect(NO_OF_LIMITED_QUERIES).toBe(10);
    });

    it('should be a number', () => {
      expect(typeof NO_OF_LIMITED_QUERIES).toBe('number');
    });
  });

  describe('SUPPORTED_KYC_COUNTRIES', () => {
    it('should contain US and NG', () => {
      expect(SUPPORTED_KYC_COUNTRIES).toEqual(['US', 'NG']);
    });

    it('should be an array', () => {
      expect(Array.isArray(SUPPORTED_KYC_COUNTRIES)).toBe(true);
    });

    it('should have length of 2', () => {
      expect(SUPPORTED_KYC_COUNTRIES.length).toBe(2);
    });
  });

  describe('PROVIDERS', () => {
    it('should have correct provider values', () => {
      expect(PROVIDERS.ZEROHASH).toBe('zerohash');
      expect(PROVIDERS.PLAID).toBe('plaid');
    });

    it('should be an object', () => {
      expect(typeof PROVIDERS).toBe('object');
    });

    it('should have all required properties', () => {
      expect(PROVIDERS).toHaveProperty('ZEROHASH');
      expect(PROVIDERS).toHaveProperty('PLAID');
    });
  });

  describe('ThrottleGroups', () => {
    it('should have DEFAULT throttle group with correct values', () => {
      expect(ThrottleGroups.DEFAULT).toBeDefined();
      expect(ThrottleGroups.DEFAULT.limit).toBe(100);
      expect(ThrottleGroups.DEFAULT.ttl).toBe(60);
    });

    it('should have STRICT throttle group with correct values', () => {
      expect(ThrottleGroups.STRICT).toBeDefined();
      expect(ThrottleGroups.STRICT.limit).toBe(2);
      expect(ThrottleGroups.STRICT.ttl).toBe(10);
    });

    it('should have AUTH throttle group with correct values', () => {
      expect(ThrottleGroups.AUTH).toBeDefined();
      expect(ThrottleGroups.AUTH.limit).toBe(5);
      expect(ThrottleGroups.AUTH.ttl).toBe(30);
    });

    it('should be an object with all required properties', () => {
      expect(typeof ThrottleGroups).toBe('object');
      expect(ThrottleGroups).toHaveProperty('DEFAULT');
      expect(ThrottleGroups).toHaveProperty('STRICT');
      expect(ThrottleGroups).toHaveProperty('AUTH');
    });
  });

  describe('NUMBER_PRECISION', () => {
    it('should be 10', () => {
      expect(NUMBER_PRECISION).toBe(10);
    });

    it('should be a number', () => {
      expect(typeof NUMBER_PRECISION).toBe('number');
    });
  });

  describe('ONE_HUNDRED_KILOBYTES', () => {
    it('should be 100000', () => {
      expect(ONE_HUNDRED_KILOBYTES).toBe(100000);
    });

    it('should be a number', () => {
      expect(typeof ONE_HUNDRED_KILOBYTES).toBe('number');
    });
  });

  describe('Fake Account Constants', () => {
    it('should have correct FAKE_ACCOUNT_NUMBER', () => {
      expect(FAKE_ACCOUNT_NUMBER).toBe('1100056479');
      expect(typeof FAKE_ACCOUNT_NUMBER).toBe('string');
    });

    it('should have correct FAKE_BANK_CODE', () => {
      expect(FAKE_BANK_CODE).toBe('120001');
      expect(typeof FAKE_BANK_CODE).toBe('string');
    });

    it('should have correct FAKE_ACCOUNT_NAME', () => {
      expect(FAKE_ACCOUNT_NAME).toBe('ONEDOSH/John Mock-Doe');
      expect(typeof FAKE_ACCOUNT_NAME).toBe('string');
    });
  });

  describe('ONE_DAY_IN_SECONDS', () => {
    it('should be 86400 seconds', () => {
      expect(ONE_DAY_IN_SECONDS).toBe(86400);
    });

    it('should be calculated correctly (24 * 60 * 60)', () => {
      expect(ONE_DAY_IN_SECONDS).toBe(24 * 60 * 60);
    });

    it('should be a number', () => {
      expect(typeof ONE_DAY_IN_SECONDS).toBe('number');
    });
  });

  describe('Yellowcard Constants', () => {
    it('should have correct YELLOWCARD_COLLECTION_SUCCESS_WALLET_ADDRESS', () => {
      expect(YELLOWCARD_COLLECTION_SUCCESS_WALLET_ADDRESS).toBe('0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe');
      expect(typeof YELLOWCARD_COLLECTION_SUCCESS_WALLET_ADDRESS).toBe('string');
    });

    it('should have correct YELLOWCARD_COLLECTION_SUCCESS_CRYPTO_CURRENCY', () => {
      expect(YELLOWCARD_COLLECTION_SUCCESS_CRYPTO_CURRENCY).toBe('USDT');
      expect(typeof YELLOWCARD_COLLECTION_SUCCESS_CRYPTO_CURRENCY).toBe('string');
    });

    it('should have correct YELLOWCARD_COLLECTION_SUCCESS_CRYPTO_NETWORK', () => {
      expect(YELLOWCARD_COLLECTION_SUCCESS_CRYPTO_NETWORK).toBe('ERC20');
      expect(typeof YELLOWCARD_COLLECTION_SUCCESS_CRYPTO_NETWORK).toBe('string');
    });
  });

  describe('TransferDirection', () => {
    it('should have FROM value', () => {
      expect(TransferDirection.FROM).toBe('from');
    });

    it('should have TO value', () => {
      expect(TransferDirection.TO).toBe('to');
    });

    it('should be an enum with 2 values', () => {
      const values = Object.values(TransferDirection);
      expect(values).toHaveLength(2);
      expect(values).toContain('from');
      expect(values).toContain('to');
    });
  });

  describe('DATE_TIME_FORMAT', () => {
    it('should have correct date time format options', () => {
      expect(DATE_TIME_FORMAT).toBeDefined();
      expect(DATE_TIME_FORMAT.weekday).toBe('short');
      expect(DATE_TIME_FORMAT.month).toBe('short');
      expect(DATE_TIME_FORMAT.day).toBe('2-digit');
      expect(DATE_TIME_FORMAT.hour).toBe('2-digit');
      expect(DATE_TIME_FORMAT.minute).toBe('2-digit');
      expect(DATE_TIME_FORMAT.year).toBe('numeric');
    });

    it('should be an object with all required properties', () => {
      expect(typeof DATE_TIME_FORMAT).toBe('object');
      expect(DATE_TIME_FORMAT).toHaveProperty('weekday');
      expect(DATE_TIME_FORMAT).toHaveProperty('month');
      expect(DATE_TIME_FORMAT).toHaveProperty('day');
      expect(DATE_TIME_FORMAT).toHaveProperty('hour');
      expect(DATE_TIME_FORMAT).toHaveProperty('minute');
      expect(DATE_TIME_FORMAT).toHaveProperty('year');
    });
  });

  describe('Fireblocks Constants', () => {
    it('should have correct FIREBLOCKS_VAULT_ID', () => {
      expect(FIREBLOCKS_VAULT_ID).toBe('368');
      expect(typeof FIREBLOCKS_VAULT_ID).toBe('string');
    });

    it('should have correct FIREBLOCKS_ASSET_ID', () => {
      expect(FIREBLOCKS_ASSET_ID).toBe('USDC_ETH_TEST5_0GER');
      expect(typeof FIREBLOCKS_ASSET_ID).toBe('string');
    });

    it('should have correct FIREBLOCKS_MASTER_VAULT_ID', () => {
      expect(FIREBLOCKS_MASTER_VAULT_ID).toBe('17');
      expect(typeof FIREBLOCKS_MASTER_VAULT_ID).toBe('string');
    });
  });

  describe('Paga Constants', () => {
    it('should have correct PAGA_DEVELOPMENT_BANK_ACCOUNT_NUMBER', () => {
      expect(PAGA_DEVELOPMENT_BANK_ACCOUNT_NUMBER).toBe('0361222682');
      expect(typeof PAGA_DEVELOPMENT_BANK_ACCOUNT_NUMBER).toBe('string');
    });
  });

  describe('EXCHANGE_EXPIRATION_TIME_IN_MINUTES', () => {
    it('should be 10 minutes', () => {
      expect(EXCHANGE_EXPIRATION_TIME_IN_MINUTES).toBe(10);
    });

    it('should be a number', () => {
      expect(typeof EXCHANGE_EXPIRATION_TIME_IN_MINUTES).toBe('number');
    });
  });
});
