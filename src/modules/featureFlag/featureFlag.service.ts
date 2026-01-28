import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { IPlatform, Platform } from '../../constants/platform';
import { FeatureFlagModel } from '../../database/models/featureFlag/featureFlag.model';
import { UserModel } from '../../database/models/user/user.model';
import { FeatureFlagOverrideRepository } from '../featureFlagOverride/featureFlagOverride.repository';
import { CreateFeatureFlagDto } from './dto/createFeatureFlag.dto';
import { GetFeatureFlagsDto } from './dto/getFeatureFlags.dto';
import { UpdateFeatureFlagDto } from './dto/updateFeatureFlag.dto';
import { FeatureFlagRepository } from './featureFlag.repository';

@Injectable()
export class FeatureFlagService {
  private readonly logger = new Logger(FeatureFlagService.name);

  @Inject(FeatureFlagRepository)
  private readonly featureFlagRepository: FeatureFlagRepository;

  @Inject(FeatureFlagOverrideRepository)
  private readonly featureFlagOverrideRepository: FeatureFlagOverrideRepository;

  public async createFeatureFlag(dto: CreateFeatureFlagDto): Promise<FeatureFlagModel> {
    this.logger.log(`Creating feature flag: ${dto.key}`);

    try {
      const existingFlag = await this.featureFlagRepository.findOne({ key: dto.key });

      if (existingFlag) {
        throw new ConflictException(`Feature flag with key '${dto.key}' already exists`);
      }

      const createData = {
        ...dto,
        enabled_ios: dto.enabled_ios ?? true,
        enabled_android: dto.enabled_android ?? true,
      };

      return await this.featureFlagRepository.create(createData);
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      this.logger.error(`Error creating feature flag: ${error.message}`);
      throw new InternalServerErrorException('Failed to create feature flag');
    }
  }

  public async getFeatureFlags(
    user: UserModel,
    query: GetFeatureFlagsDto,
    platform?: IPlatform,
  ): Promise<FeatureFlagModel[]> {
    this.logger.log(`Fetching feature flags for user: ${user.id}`);

    try {
      const queryBuilder = this.featureFlagRepository.findSync({}, { limit: 100 });

      if (query.enabled !== undefined) {
        queryBuilder.where('enabled', query.enabled);
      }

      if (query.search) {
        queryBuilder.where('key', 'like', `%${query.search}%`);
      }

      const featureFlags = await queryBuilder;

      const featureFlagIds = featureFlags.map((flag) => flag.id);

      if (featureFlagIds.length === 0) {
        return featureFlags;
      }

      const userOverrides = await this.featureFlagOverrideRepository
        .findSync({ user_id: user.id })
        .whereIn('feature_flag_id', featureFlagIds);

      const overridesMap = new Map(userOverrides.map((override) => [override.feature_flag_id, override.enabled]));

      const targetPlatform = platform || query.platform;

      for (const flag of featureFlags) {
        if (overridesMap.has(flag.id)) {
          flag.enabled = overridesMap.get(flag.id);
        } else if (targetPlatform) {
          flag.enabled = this.evaluateFeatureFlagForPlatform(flag, targetPlatform);
        }
      }

      return featureFlags;
    } catch (error) {
      this.logger.error(`Error fetching feature flags: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch feature flags');
    }
  }

  public evaluateFeatureFlagForPlatform(flag: FeatureFlagModel, platform: IPlatform): boolean {
    if (!flag.enabled) {
      return false;
    }

    if (platform === Platform.IOS) {
      return flag.enabled_ios;
    }

    return flag.enabled_android;
  }

  public async getFeatureFlagByKey(key: string, platform?: IPlatform): Promise<FeatureFlagModel> {
    this.logger.log(`Fetching feature flag by key: ${key}`);

    try {
      const featureFlag = await this.featureFlagRepository.findOne({ key });

      if (!featureFlag) {
        throw new NotFoundException(`Feature flag with key '${key}' not found`);
      }

      if (platform) {
        featureFlag.enabled = this.evaluateFeatureFlagForPlatform(featureFlag, platform);
      }

      return featureFlag;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error fetching feature flag: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch feature flag');
    }
  }

  public async updateFeatureFlag(key: string, dto: UpdateFeatureFlagDto): Promise<FeatureFlagModel> {
    this.logger.log(`Updating feature flag: ${key}`);

    try {
      const featureFlag = await this.getFeatureFlagByKey(key);

      const updated = await this.featureFlagRepository.update(featureFlag.id, dto);

      if (!updated) {
        throw new InternalServerErrorException('Failed to update feature flag');
      }

      return updated;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error updating feature flag: ${error.message}`);
      throw new InternalServerErrorException('Failed to update feature flag');
    }
  }

  public async deleteFeatureFlag(key: string): Promise<void> {
    this.logger.log(`Deleting feature flag: ${key}`);

    try {
      const featureFlag = await this.getFeatureFlagByKey(key);

      await this.featureFlagRepository.delete(featureFlag.id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error deleting feature flag: ${error.message}`);
      throw new InternalServerErrorException('Failed to delete feature flag');
    }
  }
}
