import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database/base/base.repository';
import { FeatureFlagOverrideModel } from '../../database/models/featureFlagOverride/featureFlagOverride.model';

@Injectable()
export class FeatureFlagOverrideRepository extends BaseRepository<FeatureFlagOverrideModel> {
  constructor() {
    super(FeatureFlagOverrideModel);
  }
}
