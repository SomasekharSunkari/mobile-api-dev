import { Body, Controller, Delete, Get, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BaseController } from '../../../base';
import { FetchQuery } from '../../../database';
import { UserModel } from '../../../database/models';
import { User } from '../../../decorators/User';
import { JwtAuthGuard } from '../../auth/strategies/jwt-auth.guard';
import { BankBeneficiaryService } from './bankBeneficiary.service';
import { CreateBankBeneficiaryDto } from './dto/create-bank-beneficiary.dto';

@ApiTags('Bank Beneficiaries')
@Controller('beneficiaries/bank')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
export class BankBeneficiaryController extends BaseController {
  constructor(private readonly bankBeneficiaryService: BankBeneficiaryService) {
    super();
  }

  @Post()
  @ApiOperation({ summary: 'Add a new bank beneficiary' })
  @ApiResponse({ status: 201, description: 'Bank beneficiary added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async create(@User() user: UserModel, @Body() createDto: CreateBankBeneficiaryDto) {
    const beneficiary = await this.bankBeneficiaryService.create(user, createDto);
    return this.transformResponse('Bank beneficiary added successfully', beneficiary, HttpStatus.CREATED);
  }

  @Get()
  @ApiOperation({ summary: 'Get all bank beneficiaries for the current user' })
  @ApiResponse({ status: 200, description: 'Bank beneficiaries fetched successfully' })
  async findAll(@User() user: UserModel, @Query() query: FetchQuery) {
    const beneficiaries = await this.bankBeneficiaryService.findAll(user, query);
    return this.transformResponse('Bank beneficiaries fetched successfully', beneficiaries, HttpStatus.OK);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a bank beneficiary by ID' })
  @ApiResponse({ status: 200, description: 'Bank beneficiary found' })
  @ApiResponse({ status: 404, description: 'Bank beneficiary not found' })
  async findOne(@User() user: UserModel, @Param('id') id: string) {
    const beneficiary = await this.bankBeneficiaryService.findById(id, user);
    return this.transformResponse('Bank beneficiary fetched successfully', beneficiary, HttpStatus.OK);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a bank beneficiary' })
  @ApiResponse({ status: 200, description: 'Bank beneficiary deleted successfully' })
  @ApiResponse({ status: 404, description: 'Bank beneficiary not found' })
  async delete(@User() user: UserModel, @Param('id') id: string) {
    await this.bankBeneficiaryService.delete(id, user);
    return this.transformResponse('Bank beneficiary deleted successfully', null, HttpStatus.OK);
  }
}
