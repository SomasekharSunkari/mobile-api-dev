import { Module } from '@nestjs/common';
import { IpCountryBanService } from './ipCountryBan.service';
import { IpCountryBanRepository } from '../../../database/models/ipCountryBan/ipCountryBan.repository';

@Module({
  providers: [IpCountryBanService, IpCountryBanRepository],
  exports: [IpCountryBanService, IpCountryBanRepository],
})
export class IpCountryBanModule {}
