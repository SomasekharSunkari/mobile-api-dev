import { forwardRef, Module } from '@nestjs/common';
import { FeatureFlagModule } from '../featureFlag/featureFlag.module';
import { FeatureFlagOverrideController } from './featureFlagOverride.controller';
import { FeatureFlagOverrideRepository } from './featureFlagOverride.repository';
import { FeatureFlagOverrideService } from './featureFlagOverride.service';

@Module({
  imports: [forwardRef(() => FeatureFlagModule)],
  controllers: [FeatureFlagOverrideController],
  providers: [FeatureFlagOverrideService, FeatureFlagOverrideRepository],
  exports: [FeatureFlagOverrideService, FeatureFlagOverrideRepository],
})
export class FeatureFlagOverrideModule {}
