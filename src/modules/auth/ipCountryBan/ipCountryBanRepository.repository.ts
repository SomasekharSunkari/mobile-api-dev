import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../database/base';
import { IpCountryBanModel } from '../../../database/models/ipCountryBan/ipCountryBan.model';
import { IIpCountryBan } from '../../../database/models/ipCountryBan/ipCountryBan.interface';
import { IpCountryBanType } from './ipCountryBanType.enum';

@Injectable()
export class IpCountryBanRepository extends BaseRepository<IpCountryBanModel> {
  constructor() {
    super(IpCountryBanModel);
  }

  /**
   * Find a ban by IP or Country type.
   * @param type - Either 'ip' or 'country'
   * @param value - The IP or country to search for
   * @returns A Promise that resolves to IBan or undefined
   */
  public async findByTypeAndValue(type: IpCountryBanType, value: string): Promise<IIpCountryBan | undefined> {
    return (await this.query().findOne({ type, value })) as IpCountryBanModel;
  }
}
