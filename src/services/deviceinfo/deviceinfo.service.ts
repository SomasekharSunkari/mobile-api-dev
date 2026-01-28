import { Injectable } from '@nestjs/common';
import { IpInfoService } from '../ipinfo/ipinfo.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const DeviceDetector = require('node-device-detector');

@Injectable()
export class DeviceInfoService {
  private detector = new DeviceDetector();

  constructor(private readonly ipInfoService: IpInfoService) {}

  async enrichRequest(req: any): Promise<void> {
    const userAgent = req.headers['user-agent'] || '';
    const device = this.detector.detect(userAgent);

    req.deviceInfo = {
      device_name: device.device?.brand + ' ' + device.device?.model || 'Unknown',
      device_type: device.device?.type || 'Unknown',
      os: device.os?.name || 'Unknown',
      browser: device.client?.name || 'Unknown',
    };

    try {
      const location = await this.ipInfoService.lookup(req.clientIp || '');
      req.geoInfo = {
        city: location.city ?? null,
        region: location.region ?? null,
        country: location.country ?? null,
      };
    } catch {
      req.geoInfo = { city: null, region: null, country: null };
    }
  }
}
