import { Body, Controller, Get, Inject, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BaseController } from '../../base/base.controller';
import { SUPPORTED_CURRENCIES } from '../../currencies';
import { RateTransactionType } from '../../database/models/rateTransaction/rateTransaction.interface';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { GetRateDto } from './dto/getRate.dto';
import { RateService } from './rate.service';

@Controller('rates')
@ApiTags('Rates')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
export class RateController extends BaseController {
  @Inject(RateService)
  private readonly rateService: RateService;

  @Post('')
  async getRate(@Body() body: GetRateDto) {
    const response = await this.rateService.getRate(body.currency_code, body.amount, body.type);
    return this.transformResponse('Rate fetched successfully', response);
  }

  @Get('')
  async getRateV2(@Query() body: GetRateDto) {
    const response = await this.rateService.getRate(body.currency_code, body.amount, body.type);
    return this.transformResponse('Rate fetched successfully', response);
  }

  @Get('all')
  async getAllRates() {
    const buyNgnRate = await this.rateService.getRate(SUPPORTED_CURRENCIES.NGN.code, 100, RateTransactionType.BUY);

    const sellNgnRate = await this.rateService.getRate(SUPPORTED_CURRENCIES.NGN.code, 100, RateTransactionType.SELL);

    return this.transformResponse('Rates fetched successfully', { buyNgnRate, sellNgnRate });
  }
}
