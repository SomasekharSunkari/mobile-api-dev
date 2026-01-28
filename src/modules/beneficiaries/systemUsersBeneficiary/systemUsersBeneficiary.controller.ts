import { Body, Controller, Delete, Get, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BaseController } from '../../../base';
import { FetchQuery } from '../../../database/base/base.interface';
import { UserModel } from '../../../database/models';
import { User } from '../../../decorators/User';
import { JwtAuthGuard } from '../../auth/strategies/jwt-auth.guard';
import { CreateSystemUsersBeneficiaryDto } from './dto/create-system-users-beneficiary.dto';
import { SystemUsersBeneficiaryService } from './systemUsersBeneficiary.service';

@ApiTags('System Users Beneficiaries')
@Controller('beneficiaries/system')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
export class SystemUsersBeneficiaryController extends BaseController {
  constructor(private readonly systemUsersBeneficiaryService: SystemUsersBeneficiaryService) {
    super();
  }

  @Post()
  @ApiOperation({ summary: 'Add a new beneficiary' })
  @ApiResponse({ status: 201, description: 'Beneficiary added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request or beneficiary already exists' })
  async create(@User() user: UserModel, @Body() createDto: CreateSystemUsersBeneficiaryDto) {
    const beneficiary = await this.systemUsersBeneficiaryService.create(user, createDto);
    return this.transformResponse('Beneficiary added successfully', beneficiary, HttpStatus.CREATED);
  }

  @Get()
  @ApiOperation({ summary: 'Get all beneficiaries for the current user' })
  @ApiResponse({ status: 200, description: 'Beneficiaries fetched successfully' })
  async findAll(@User() user: UserModel, @Query() query: FetchQuery) {
    const beneficiaries = await this.systemUsersBeneficiaryService.findAll(user, query?.search);
    return this.transformResponse('Beneficiaries fetched successfully', beneficiaries, HttpStatus.OK);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a beneficiary by ID' })
  @ApiResponse({ status: 200, description: 'Beneficiary found' })
  @ApiResponse({ status: 404, description: 'Beneficiary not found' })
  async findOne(@User() user: UserModel, @Param('id') id: string) {
    const beneficiary = await this.systemUsersBeneficiaryService.findById(id, user);
    return this.transformResponse('Beneficiary fetched successfully', beneficiary, HttpStatus.OK);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a beneficiary' })
  @ApiResponse({ status: 200, description: 'Beneficiary deleted successfully' })
  @ApiResponse({ status: 404, description: 'Beneficiary not found' })
  async delete(@User() user: UserModel, @Param('id') id: string) {
    await this.systemUsersBeneficiaryService.delete(id, user);
    return this.transformResponse('Beneficiary deleted successfully', null, HttpStatus.OK);
  }
}
