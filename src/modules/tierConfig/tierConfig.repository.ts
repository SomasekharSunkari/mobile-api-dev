import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database';
import { TierConfigModel } from '../../database/models/tierConfig/tierConfig.model';

@Injectable()
export class TierConfigRepository extends BaseRepository<TierConfigModel> {
  constructor() {
    super(TierConfigModel);
  }
}
