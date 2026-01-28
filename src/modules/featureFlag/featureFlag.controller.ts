import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { BaseController } from '../../base';
import { FeatureFlagModel } from '../../database/models/featureFlag/featureFlag.model';
import { UserModel } from '../../database/models/user/user.model';
import { User } from '../../decorators/User';
import { PlatformUtil } from '../../utils/platform.util';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { CreateFeatureFlagDto } from './dto/createFeatureFlag.dto';
import { GetFeatureFlagsDto } from './dto/getFeatureFlags.dto';
import { UpdateFeatureFlagDto } from './dto/updateFeatureFlag.dto';
import { FeatureFlagService } from './featureFlag.service';

@ApiTags('Feature Flags')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('/feature-flags')
export class FeatureFlagController extends BaseController {
  @Inject(FeatureFlagService)
  private readonly featureFlagService: FeatureFlagService;

  @Post()
  @ApiOperation({ summary: 'Create a new feature flag' })
  @ApiResponse({
    status: 201,
    description: 'Feature flag created successfully',
    type: FeatureFlagModel,
  })
  @ApiResponse({ status: 409, description: 'Feature flag already exists' })
  async createFeatureFlag(@Body() dto: CreateFeatureFlagDto) {
    const featureFlag = await this.featureFlagService.createFeatureFlag(dto);
    return this.transformResponse('Feature flag created successfully', featureFlag, 201);
  }

  @Get()
  @ApiOperation({ summary: 'Get all feature flags' })
  @ApiResponse({
    status: 200,
    description: 'Feature flags retrieved successfully',
    type: [FeatureFlagModel],
  })
  async getFeatureFlags(@User() user: UserModel, @Query() query: GetFeatureFlagsDto, @Req() request: Request) {
    const platform = query.platform || PlatformUtil.detectPlatform(request);
    const featureFlags = await this.featureFlagService.getFeatureFlags(user, query, platform);
    return this.transformResponse('Feature flags retrieved successfully', featureFlags);
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get a feature flag by key' })
  @ApiParam({ name: 'key', description: 'Feature flag key', example: 'new_dashboard_ui' })
  @ApiResponse({
    status: 200,
    description: 'Feature flag retrieved successfully',
    type: FeatureFlagModel,
  })
  @ApiResponse({ status: 404, description: 'Feature flag not found' })
  async getFeatureFlagByKey(@Param('key') key: string, @Req() request: Request) {
    const platform = PlatformUtil.detectPlatform(request);
    const featureFlag = await this.featureFlagService.getFeatureFlagByKey(key, platform);
    return this.transformResponse('Feature flag retrieved successfully', featureFlag);
  }

  @Patch(':key')
  @ApiOperation({ summary: 'Update a feature flag' })
  @ApiParam({ name: 'key', description: 'Feature flag key', example: 'new_dashboard_ui' })
  @ApiResponse({
    status: 200,
    description: 'Feature flag updated successfully',
    type: FeatureFlagModel,
  })
  @ApiResponse({ status: 404, description: 'Feature flag not found' })
  async updateFeatureFlag(@Param('key') key: string, @Body() dto: UpdateFeatureFlagDto) {
    const featureFlag = await this.featureFlagService.updateFeatureFlag(key, dto);
    return this.transformResponse('Feature flag updated successfully', featureFlag);
  }

  @Delete(':key')
  @ApiOperation({ summary: 'Delete a feature flag' })
  @ApiParam({ name: 'key', description: 'Feature flag key', example: 'new_dashboard_ui' })
  @ApiResponse({ status: 200, description: 'Feature flag deleted successfully' })
  @ApiResponse({ status: 404, description: 'Feature flag not found' })
  async deleteFeatureFlag(@Param('key') key: string) {
    await this.featureFlagService.deleteFeatureFlag(key);
    return this.transformResponse('Feature flag deleted successfully');
  }
}
