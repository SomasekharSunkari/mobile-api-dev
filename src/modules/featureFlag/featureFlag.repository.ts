import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database/base/base.repository';
import { FeatureFlagModel } from '../../database/models/featureFlag/featureFlag.model';

@Injectable()
export class FeatureFlagRepository extends BaseRepository<FeatureFlagModel> {
  constructor() {
    super(FeatureFlagModel);
  }
}
