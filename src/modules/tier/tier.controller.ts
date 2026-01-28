import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BaseController } from '../../base';
import { GetAllTiersResponseDto } from './dto/tierResponse.dto';
import { TierService } from './tier.service';

@ApiTags('Tiers')
@Controller('tiers')
export class TierController extends BaseController {
  @Inject(TierService)
  private readonly tierService: TierService;

  @Get()
  @ApiOperation({ summary: 'Get all tiers in the system' })
  @ApiResponse({
    status: 200,
    description: 'Tiers fetched successfully',
    type: GetAllTiersResponseDto,
  })
  async getAllTiers() {
    const tiers = await this.tierService.getAllTiers();

    return this.transformResponse('Tiers fetched successfully', tiers);
  }
}
