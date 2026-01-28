import { Body, Controller, Inject, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BaseController } from '../../base';
import { FeatureFlagOverrideModel } from '../../database/models/featureFlagOverride/featureFlagOverride.model';
import { CreateFeatureFlagOverrideDto } from './dto/createFeatureFlagOverride.dto';
import { FeatureFlagOverrideService } from './featureFlagOverride.service';

@ApiTags('Feature Flag Overrides')
@Controller('/feature-flag-overrides')
export class FeatureFlagOverrideController extends BaseController {
  @Inject(FeatureFlagOverrideService)
  private readonly featureFlagOverrideService: FeatureFlagOverrideService;

  @Post()
  @ApiOperation({ summary: 'Create a feature flag override for a user' })
  @ApiResponse({
    status: 201,
    description: 'Feature flag override created successfully',
    type: FeatureFlagOverrideModel,
  })
  @ApiResponse({ status: 409, description: 'Override already exists' })
  @ApiResponse({ status: 404, description: 'Feature flag not found' })
  async createFeatureFlagOverride(@Body() dto: CreateFeatureFlagOverrideDto) {
    const override = await this.featureFlagOverrideService.createFeatureFlagOverride(dto);
    return this.transformResponse('Feature flag override created successfully', override, 201);
  }
}
