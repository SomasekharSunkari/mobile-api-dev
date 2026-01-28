import { Request } from 'express';
import { Platform } from '../constants/platform';
import { PlatformUtil } from './platform.util';

describe('PlatformUtil', () => {
  describe('detectPlatform', () => {
    it('should detect iOS from x-os header', () => {
      const request = {
        headers: {
          'x-os': 'iOS',
        },
      } as Partial<Request> as Request;

      expect(PlatformUtil.detectPlatform(request)).toBe(Platform.IOS);
    });

    it('should detect iOS from x-device-type header', () => {
      const request = {
        headers: {
          'x-device-type': 'ios',
        },
      } as Partial<Request> as Request;

      expect(PlatformUtil.detectPlatform(request)).toBe(Platform.IOS);
    });

    it('should detect iOS from user-agent with iPhone', () => {
      const request = {
        headers: {
          'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        },
      } as Partial<Request> as Request;

      expect(PlatformUtil.detectPlatform(request)).toBe(Platform.IOS);
    });

    it('should detect iOS from user-agent with iPad', () => {
      const request = {
        headers: {
          'user-agent': 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
        },
      } as Partial<Request> as Request;

      expect(PlatformUtil.detectPlatform(request)).toBe(Platform.IOS);
    });

    it('should detect Android from x-os header', () => {
      const request = {
        headers: {
          'x-os': 'Android',
        },
      } as Partial<Request> as Request;

      expect(PlatformUtil.detectPlatform(request)).toBe(Platform.ANDROID);
    });

    it('should detect Android from x-device-type header', () => {
      const request = {
        headers: {
          'x-device-type': 'android',
        },
      } as Partial<Request> as Request;

      expect(PlatformUtil.detectPlatform(request)).toBe(Platform.ANDROID);
    });

    it('should detect Android from user-agent', () => {
      const request = {
        headers: {
          'user-agent': 'Mozilla/5.0 (Linux; Android 10)',
        },
      } as Partial<Request> as Request;

      expect(PlatformUtil.detectPlatform(request)).toBe(Platform.ANDROID);
    });

    it('should default to Android when no platform indicators found', () => {
      const request = {
        headers: {},
      } as Partial<Request> as Request;

      expect(PlatformUtil.detectPlatform(request)).toBe(Platform.ANDROID);
    });

    it('should handle case-insensitive detection', () => {
      const request = {
        headers: {
          'x-os': 'IOS',
          'x-device-type': 'ANDROID',
        },
      } as Partial<Request> as Request;

      expect(PlatformUtil.detectPlatform(request)).toBe(Platform.IOS);
    });
  });

  describe('isIOS', () => {
    it('should return true for iOS platform', () => {
      expect(PlatformUtil.isIOS(Platform.IOS)).toBe(true);
    });

    it('should return false for Android platform', () => {
      expect(PlatformUtil.isIOS(Platform.ANDROID)).toBe(false);
    });
  });

  describe('isAndroid', () => {
    it('should return true for Android platform', () => {
      expect(PlatformUtil.isAndroid(Platform.ANDROID)).toBe(true);
    });

    it('should return false for iOS platform', () => {
      expect(PlatformUtil.isAndroid(Platform.IOS)).toBe(false);
    });
  });
});
