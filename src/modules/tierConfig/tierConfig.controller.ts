import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BaseController } from '../../base';
import { FetchQuery } from '../../database';
import { TierConfigModel } from '../../database/models/tierConfig/tierConfig.model';
import { Roles } from '../../decorators/Role';
import { ROLES, RolesGuard } from '../auth/guard';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { CreateTierConfigDto } from './dtos/createTierConfig.dto';
import { UpdateTierConfigDto } from './dtos/udpateTierConfig.dto';
import { TierConfigService } from './tierConfig.service';

@ApiTags('TierConfig')
@Controller('/tier-configs')
@UseGuards(RolesGuard)
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class TierConfigController extends BaseController {
  @Inject(TierConfigService)
  private readonly tierConfigService: TierConfigService;

  @Post()
  @Roles(ROLES.ADMIN, ROLES.SUPER_ADMIN)
  @ApiBody({ type: CreateTierConfigDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'TierConfig Created Successfully',
  })
  async create(@Body() data: CreateTierConfigDto) {
    const tierConfig = await this.tierConfigService.create(data);

    return this.transformResponse('TierConfig Created Successfully', tierConfig, HttpStatus.CREATED);
  }

  @Patch(':id')
  @Roles(ROLES.ADMIN, ROLES.SUPER_ADMIN)
  @ApiBody({ type: UpdateTierConfigDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'TierConfig Updated Successfully',
  })
  async update(@Param('id') id: string, @Body() data: UpdateTierConfigDto) {
    const tierConfig = await this.tierConfigService.update(id, data);

    return this.transformResponse('TierConfig Updated Successfully', tierConfig, HttpStatus.OK);
  }

  @Get('')
  @Roles(ROLES.ADMIN, ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Fetch all tierConfigs' })
  @ApiResponse({
    status: 200,
    description: 'TierConfigs Fetched Successfully',
    type: TierConfigModel,
    isArray: true,
  })
  async findAll(
    @Query()
    query: FetchQuery & { countryId?: string },
  ) {
    const tierConfigs = await this.tierConfigService.findAll(query);

    return this.transformResponse('TierConfigs Fetched Successfully', tierConfigs, HttpStatus.OK);
  }

  @Get(':id')
  @Roles(ROLES.ADMIN, ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Fetch single tierConfig' })
  @ApiResponse({
    status: 200,
    description: 'TierConfig Fetched Successfully',
    type: TierConfigModel,
  })
  async findById(
    @Param('id')
    id: string,
  ) {
    const tierConfig = await this.tierConfigService.findOne(id);

    return this.transformResponse('TierConfig Fetched Successfully', tierConfig, HttpStatus.OK);
  }

  @Delete(':id')
  @Roles(ROLES.ADMIN, ROLES.SUPER_ADMIN)
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'TierConfig Deleted Successfully',
  })
  async delete(@Param('id') id: string) {
    const tierConfig = await this.tierConfigService.delete(id);

    return this.transformResponse('TierConfig Deleted Successfully', tierConfig, HttpStatus.OK);
  }
}
