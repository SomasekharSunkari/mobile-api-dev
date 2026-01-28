import {
  BLOCKCHAIN_ACCOUNT_RAIL,
  BlockchainAccountRail,
  getAvailableRails,
  isValidRails,
} from './blockchainAccountRails';

describe('blockchainAccountRails', () => {
  describe('BLOCKCHAIN_ACCOUNT_RAIL', () => {
    it('should have CRYPTO rail', () => {
      expect(BLOCKCHAIN_ACCOUNT_RAIL.CRYPTO).toBe('crypto');
    });

    it('should have FIAT rail', () => {
      expect(BLOCKCHAIN_ACCOUNT_RAIL.FIAT).toBe('fiat');
    });

    it('should have CARD rail', () => {
      expect(BLOCKCHAIN_ACCOUNT_RAIL.CARD).toBe('card');
    });

    it('should be a readonly constant object', () => {
      expect(BLOCKCHAIN_ACCOUNT_RAIL).toBeDefined();
      expect(typeof BLOCKCHAIN_ACCOUNT_RAIL).toBe('object');
      expect(Object.keys(BLOCKCHAIN_ACCOUNT_RAIL).length).toBe(3);
    });

    it('should have all expected rail types', () => {
      const expectedRails = ['crypto', 'fiat', 'card'];
      const actualRails = Object.values(BLOCKCHAIN_ACCOUNT_RAIL);
      expect(actualRails).toEqual(expect.arrayContaining(expectedRails));
      expect(actualRails.length).toBe(expectedRails.length);
    });
  });

  describe('getAvailableRails', () => {
    it('should return all available rails', () => {
      const result = getAvailableRails();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
    });

    it('should return all rail values', () => {
      const result = getAvailableRails();

      expect(result).toContain('crypto');
      expect(result).toContain('fiat');
      expect(result).toContain('card');
    });

    it('should return only string values', () => {
      const result = getAvailableRails();

      result.forEach((rail) => {
        expect(typeof rail).toBe('string');
      });
    });

    it('should return the same values as BLOCKCHAIN_ACCOUNT_RAIL object values', () => {
      const result = getAvailableRails();
      const objectValues = Object.values(BLOCKCHAIN_ACCOUNT_RAIL);

      expect(result).toEqual(objectValues);
    });
  });

  describe('isValidRails', () => {
    it('should return true for valid CRYPTO rail', () => {
      const result = isValidRails('crypto');

      expect(result).toBe(true);
    });

    it('should return true for valid FIAT rail', () => {
      const result = isValidRails('fiat');

      expect(result).toBe(true);
    });

    it('should return true for valid CARD rail', () => {
      const result = isValidRails('card');

      expect(result).toBe(true);
    });

    it('should return false for invalid rail value', () => {
      const result = isValidRails('invalid');

      expect(result).toBe(false);
    });

    it('should return false for empty string', () => {
      const result = isValidRails('');

      expect(result).toBe(false);
    });

    it('should return false for null', () => {
      const result = isValidRails(null as any);

      expect(result).toBe(false);
    });

    it('should return false for undefined', () => {
      const result = isValidRails(undefined as any);

      expect(result).toBe(false);
    });

    it('should return false for number', () => {
      const result = isValidRails(123 as any);

      expect(result).toBe(false);
    });

    it('should return false for object', () => {
      const result = isValidRails({} as any);

      expect(result).toBe(false);
    });

    it('should return false for array', () => {
      const result = isValidRails([] as any);

      expect(result).toBe(false);
    });

    it('should return false for case-sensitive mismatches', () => {
      expect(isValidRails('CRYPTO')).toBe(false);
      expect(isValidRails('Crypto')).toBe(false);
      expect(isValidRails('CRYPTO')).toBe(false);
      expect(isValidRails('FIAT')).toBe(false);
      expect(isValidRails('Fiat')).toBe(false);
      expect(isValidRails('CARD')).toBe(false);
      expect(isValidRails('Card')).toBe(false);
    });

    it('should return false for strings with extra characters', () => {
      expect(isValidRails('crypto ')).toBe(false);
      expect(isValidRails(' crypto')).toBe(false);
      expect(isValidRails('crypto1')).toBe(false);
      expect(isValidRails('crypto-fiat')).toBe(false);
    });

    it('should have proper type guard behavior', () => {
      const testValue: string = 'crypto';

      if (isValidRails(testValue)) {
        const typedValue: BlockchainAccountRail = testValue;
        expect(typedValue).toBe('crypto');
      } else {
        fail('Type guard should have passed');
      }
    });

    it('should work with all valid rails in type guard', () => {
      const rails: string[] = ['crypto', 'fiat', 'card'];

      rails.forEach((rail) => {
        if (isValidRails(rail)) {
          const typedRail: BlockchainAccountRail = rail;
          expect(typedRail).toBe(rail);
        } else {
          fail(`Type guard should have passed for ${rail}`);
        }
      });
    });
  });
});
