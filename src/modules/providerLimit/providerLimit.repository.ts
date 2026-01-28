import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database/base';
import { ProviderLimitModel } from '../../database/models/providerLimit/providerLimit.model';

@Injectable()
export class ProviderLimitRepository extends BaseRepository<ProviderLimitModel> {
  constructor() {
    super(ProviderLimitModel);
  }
}
