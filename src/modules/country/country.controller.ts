import { Controller, Get, Inject, Injectable } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BaseController } from '../../base';
import { CountryService } from './country.service';

@Injectable()
@ApiTags('countries')
@Controller('countries')
export class CountryController extends BaseController {
  @Inject(CountryService)
  private readonly countryService: CountryService;

  @ApiOperation({ summary: 'Get list all countries' })
  @ApiResponse({ status: 200, description: 'Countries fetched successfully' })
  @Get()
  public async findAll() {
    const countries = await this.countryService.findAll();

    return this.transformResponse('Countries fetched successfully', countries);
  }
}
