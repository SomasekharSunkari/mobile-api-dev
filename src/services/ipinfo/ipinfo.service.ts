import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
@Injectable()
export class IpInfoService {
  private readonly logger = new Logger(IpInfoService.name);
  constructor(private readonly configService: ConfigService) {}
  async lookup(ip: string): Promise<any> {
    const token = this.configService.get<string>('IPINFO_TOKEN');
    const url = `https://ipinfo.io/${ip}?token=${token}`;

    try {
      const response = await axios.get(url);
      return response.data;
    } catch (err) {
      this.logger.error(`IP lookup failed for ${ip}: ${err.message}`);
      throw err;
    }
  }
}
