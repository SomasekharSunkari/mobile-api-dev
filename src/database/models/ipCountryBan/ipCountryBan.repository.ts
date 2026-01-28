import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../base';
import { IpCountryBanModel } from './ipCountryBan.model';

@Injectable()
export class IpCountryBanRepository extends BaseRepository<IpCountryBanModel> {
  constructor() {
    super(IpCountryBanModel);
  }

  /**
   * Check if a country is banned
   */
  async isCountryBanned(countryCode: string): Promise<IpCountryBanModel | null> {
    const result = await this.query().where({ type: 'country', value: countryCode }).whereNull('deleted_at').first();

    return result as IpCountryBanModel;
  }

  /**
   * Get all banned countries
   */
  async getBannedCountries(): Promise<IpCountryBanModel[]> {
    const results = await this.query().where({ type: 'country' }).whereNull('deleted_at');

    return results as IpCountryBanModel[];
  }
}
