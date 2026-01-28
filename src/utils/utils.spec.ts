import * as geoip from 'geoip-lite';
import { DateTime } from 'luxon';
import { UtilsService } from './utils.service';

describe('UtilsService', () => {
  describe('generateCode', () => {
    it('should generate a code of default length 6', () => {
      const code = UtilsService.generateCode();
      expect(code).toHaveLength(6);
      expect(/^[0-9]{6}$/.test(code)).toBe(true);
    });
    it('should generate a code of custom length', () => {
      const code = UtilsService.generateCode(8);
      expect(code).toHaveLength(8);
      expect(/^[0-9]{8}$/.test(code)).toBe(true);
    });
  });

  describe('hashPassword and comparePassword', () => {
    it('should hash and compare password correctly', async () => {
      const password = 'testPassword123!';
      const hash = await UtilsService.hashPassword(password);
      expect(typeof hash).toBe('string');
      const isMatch = await UtilsService.comparePassword(password, hash);
      expect(isMatch).toBe(true);
      const isNotMatch = await UtilsService.comparePassword('wrongPassword', hash);
      expect(isNotMatch).toBe(false);
    }, 10000);
  });

  describe('isDatePassed', () => {
    it('should return true if date is in the past', () => {
      const pastDate = DateTime.now().minus({ days: 1 }).toISO();
      expect(UtilsService.isDatePassed(pastDate)).toBe(true);
    });
    it('should return false if date is in the future', () => {
      const futureDate = DateTime.now().plus({ days: 1 }).toISO();
      expect(UtilsService.isDatePassed(futureDate)).toBe(false);
    });
    it('should return false if date is now', () => {
      const now = DateTime.now().plus({ seconds: 1 }).toJSDate();
      expect(UtilsService.isDatePassed(now)).toBe(false);
    });
  });

  describe('getGeoInfoFromIp', () => {
    it('should return geo info for a valid IP', () => {
      const mockLookup = { country: 'US', city: 'New York' };
      jest.spyOn(geoip, 'lookup').mockReturnValue(mockLookup as any);
      const result = UtilsService.getGeoInfoFromIp('8.8.8.8');
      expect(result).toEqual(mockLookup);
    });
    it('should return null for an invalid IP', () => {
      jest.spyOn(geoip, 'lookup').mockReturnValue(null);
      const result = UtilsService.getGeoInfoFromIp('invalid-ip');
      expect(result).toBeNull();
    });
  });

  describe('generateIdempotencyKey', () => {
    it('should generate a 20-character idempotency key', () => {
      const key = UtilsService.generateIdempotencyKey();
      expect(key).toHaveLength(20);
      expect(typeof key).toBe('string');
    });

    it('should generate unique keys on multiple calls', () => {
      const key1 = UtilsService.generateIdempotencyKey();
      const key2 = UtilsService.generateIdempotencyKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe('convertToNegative', () => {
    it('should convert positive number to negative', () => {
      const result = UtilsService.convertToNegative(100);
      expect(result).toBe(-100);
    });

    it('should convert negative number to positive', () => {
      const result = UtilsService.convertToNegative(-50);
      expect(result).toBe(50);
    });

    it('should convert zero to zero', () => {
      const result = UtilsService.convertToNegative(0);
      expect(result).toBe(-0);
    });

    it('should handle decimal numbers', () => {
      const result = UtilsService.convertToNegative(12.5);
      expect(result).toBe(-12.5);
    });
  });

  describe('generateRandomPhoneNumber', () => {
    it('should generate a phone number starting with 080', () => {
      const phoneNumber = UtilsService.generateRandomPhoneNumber();
      expect(phoneNumber.startsWith('080')).toBe(true);
      expect(phoneNumber.length).toBeGreaterThanOrEqual(12);
      expect(phoneNumber.length).toBeLessThanOrEqual(13);
      expect(/^\d+$/.test(phoneNumber)).toBe(true);
    });

    it('should generate different phone numbers on multiple calls', () => {
      const phone1 = UtilsService.generateRandomPhoneNumber();
      const phone2 = UtilsService.generateRandomPhoneNumber();
      expect(phone1).not.toBe(phone2);
    });

    it('should generate valid phone number format', () => {
      const phoneNumber = UtilsService.generateRandomPhoneNumber();
      expect(phoneNumber.startsWith('080')).toBe(true);
      expect(phoneNumber).toMatch(/^080\d{9,10}$/);
      expect(/^\d+$/.test(phoneNumber)).toBe(true);
    });
  });
});
