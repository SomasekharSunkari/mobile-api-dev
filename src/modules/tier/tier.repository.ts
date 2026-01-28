import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database';
import { TierModel } from '../../database/models/tier/tier.model';

@Injectable()
export class TierRepository extends BaseRepository<TierModel> {
  constructor() {
    super(TierModel);
  }
}
