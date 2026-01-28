import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FeatureFlagOverrideModel } from '../../database/models/featureFlagOverride/featureFlagOverride.model';
import { FeatureFlagRepository } from '../featureFlag/featureFlag.repository';
import { CreateFeatureFlagOverrideDto } from './dto/createFeatureFlagOverride.dto';
import { FeatureFlagOverrideRepository } from './featureFlagOverride.repository';

@Injectable()
export class FeatureFlagOverrideService {
  private readonly logger = new Logger(FeatureFlagOverrideService.name);

  @Inject(FeatureFlagOverrideRepository)
  private readonly featureFlagOverrideRepository: FeatureFlagOverrideRepository;

  @Inject(FeatureFlagRepository)
  private readonly featureFlagRepository: FeatureFlagRepository;

  public async createFeatureFlagOverride(dto: CreateFeatureFlagOverrideDto): Promise<FeatureFlagOverrideModel> {
    this.logger.log(`Creating feature flag override for user: ${dto.user_id}`);

    try {
      const featureFlag = await this.featureFlagRepository.findOne({ key: dto.feature_flag_id });

      if (!featureFlag) {
        throw new NotFoundException(`Feature flag with key '${dto.feature_flag_id}' not found`);
      }

      const existingOverride = await this.featureFlagOverrideRepository.findOne({
        feature_flag_id: featureFlag.id,
        user_id: dto.user_id,
      });

      if (existingOverride) {
        throw new ConflictException('Feature flag override already exists for this user');
      }

      const override = await this.featureFlagOverrideRepository.create({
        ...dto,
        feature_flag_id: featureFlag.id,
      });

      return override;
    } catch (error) {
      if (error instanceof ConflictException || error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error creating feature flag override: ${error.message}`);
      throw new InternalServerErrorException('Failed to create feature flag override');
    }
  }
}
