import { Body, Controller, Get, HttpStatus, Inject, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WaasAdapter } from '../../adapters/waas/waas.adapter';
import { BaseController } from '../../base';
import { BankModel } from '../../database/models/bank';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { BankService } from './bank.service';
import { BankQueryDto } from './dtos/bankQuery.dto';
import { VerifyBankAccountDto } from './dtos/verifyBankAccount.dto';
import { HttpCache } from '../../interceptors/http-cache';

@ApiTags('Virtual Accounts')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('/banks')
export class BankController extends BaseController {
  @Inject(BankService)
  private readonly bankService: BankService;

  @Inject(WaasAdapter)
  private readonly waasAdapter: WaasAdapter;

  @Post('/verify')
  @ApiOperation({ summary: 'Verify bank account' })
  @ApiBody({ type: VerifyBankAccountDto })
  async verifyBankAccount(@Body() body: VerifyBankAccountDto) {
    const response = await this.bankService.verifyBankAccount(body);
    return this.transformResponse('Bank account verified successfully', response, HttpStatus.OK);
  }

  @Get()
  @HttpCache({ ttl: '1d', keyPrefix: 'banks' })
  @ApiOperation({ summary: 'Fetch all Nigerian banks' })
  @ApiQuery({ name: 'name', required: false })
  @ApiQuery({ name: 'country_id', required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Nigerian banks fetched successfully',
    type: BankModel,
  })
  async findAll(@Query() query: BankQueryDto) {
    const banks = await this.bankService.findAll(query);

    return this.transformResponse(`Banks fetched successfully`, banks, HttpStatus.OK);
  }
}
