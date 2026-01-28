import { Request } from 'express';
import { IPlatform, Platform } from '../constants/platform';

export class PlatformUtil {
  static detectPlatform(request: Request): IPlatform {
    const headers = request.headers;
    const os = String(headers['x-os'] || '').toLowerCase();
    const deviceType = String(headers['x-device-type'] || '').toLowerCase();
    const userAgent = String(headers['user-agent'] || '').toLowerCase();

    if (os.includes('ios') || deviceType === 'ios' || userAgent.includes('iphone') || userAgent.includes('ipad')) {
      return Platform.IOS;
    }

    return Platform.ANDROID;
  }

  static isIOS(platform: IPlatform): boolean {
    return platform === Platform.IOS;
  }

  static isAndroid(platform: IPlatform): boolean {
    return platform === Platform.ANDROID;
  }
}
