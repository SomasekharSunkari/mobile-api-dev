import { forwardRef, Module } from '@nestjs/common';
import { FeatureFlagOverrideModule } from '../featureFlagOverride/featureFlagOverride.module';
import { FeatureFlagController } from './featureFlag.controller';
import { FeatureFlagRepository } from './featureFlag.repository';
import { FeatureFlagService } from './featureFlag.service';

@Module({
  controllers: [FeatureFlagController],
  providers: [FeatureFlagService, FeatureFlagRepository],
  exports: [FeatureFlagService, FeatureFlagRepository],
  imports: [forwardRef(() => FeatureFlagOverrideModule)],
})
export class FeatureFlagModule {}
