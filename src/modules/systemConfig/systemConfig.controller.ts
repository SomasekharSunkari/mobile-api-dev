import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BaseController } from '../../base';
import { SystemConfigModel } from '../../database/models/systemConfig/systemConfig.model';
import { GetSystemConfigsDto } from './dto/getSystemConfigs.dto';
import { SystemConfigService } from './systemConfig.service';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';

@ApiTags('System Config')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('/system-configs')
export class SystemConfigController extends BaseController {
  @Inject(SystemConfigService)
  private readonly systemConfigService: SystemConfigService;

  @Get()
  @ApiOperation({ summary: 'Get system configurations' })
  @ApiResponse({
    status: 200,
    description: 'System configurations retrieved successfully',
    type: [SystemConfigModel],
  })
  async getSystemConfigs(@Query() query: GetSystemConfigsDto) {
    const configs = await this.systemConfigService.getSystemConfigs(query);
    return this.transformResponse('System configurations retrieved successfully', configs);
  }
}
