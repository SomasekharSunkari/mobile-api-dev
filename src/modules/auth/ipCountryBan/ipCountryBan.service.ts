import { Injectable, Inject, Logger } from '@nestjs/common';
import { IpCountryBanRepository } from '../../../database/models/ipCountryBan/ipCountryBan.repository';
import { IpCountryBanModel } from '../../../database/models/ipCountryBan/ipCountryBan.model';

@Injectable()
export class IpCountryBanService {
  private readonly logger = new Logger(IpCountryBanService.name);

  @Inject(IpCountryBanRepository)
  private readonly ipCountryBanRepository: IpCountryBanRepository;

  /**
   * Check if a country is banned
   */
  async isCountryBanned(countryCode: string): Promise<IpCountryBanModel | null> {
    try {
      return await this.ipCountryBanRepository.isCountryBanned(countryCode);
    } catch (error) {
      this.logger.error(`Failed to check if country ${countryCode} is banned: ${error.message}`);
      return null;
    }
  }

  /**
   * Check and block access based on IP and country
   * Used by AccessBlockMiddleware
   */
  async checkAndBlockAccess(ip: string, country: string): Promise<string | null> {
    try {
      if (country && country !== 'unknown') {
        const bannedCountry = await this.isCountryBanned(country);
        if (bannedCountry) {
          return `Access denied from ${country}. ${bannedCountry.reason || 'This location is not permitted.'}`;
        }
      }
      return null; // Access allowed
    } catch (error) {
      this.logger.error(`Failed to check access for IP ${ip}, country ${country}: ${error.message}`);
      return null; // Allow access on error to avoid blocking legitimate users
    }
  }
}
