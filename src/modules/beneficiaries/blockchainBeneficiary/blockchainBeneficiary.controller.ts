import { Body, Controller, Delete, Get, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BaseController } from '../../../base';
import { UserModel } from '../../../database/models';
import { User } from '../../../decorators/User';
import { JwtAuthGuard } from '../../auth/strategies/jwt-auth.guard';
import { BlockchainBeneficiaryService } from './blockchainBeneficiary.service';
import { CreateBlockchainBeneficiaryDto } from './dto/create-blockchain-beneficiary.dto';

@ApiTags('Blockchain Beneficiaries')
@Controller('beneficiaries/blockchain')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
export class BlockchainBeneficiaryController extends BaseController {
  constructor(private readonly blockchainBeneficiaryService: BlockchainBeneficiaryService) {
    super();
  }

  @Post()
  @ApiOperation({ summary: 'Add a new blockchain beneficiary' })
  @ApiResponse({ status: 201, description: 'Blockchain beneficiary added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async create(@User() user: UserModel, @Body() createDto: CreateBlockchainBeneficiaryDto) {
    const beneficiary = await this.blockchainBeneficiaryService.create(user, createDto);
    return this.transformResponse('Blockchain beneficiary added successfully', beneficiary, HttpStatus.CREATED);
  }

  @Get()
  @ApiOperation({ summary: 'Get all blockchain beneficiaries for the current user' })
  @ApiResponse({ status: 200, description: 'Blockchain beneficiaries fetched successfully' })
  async findAll(@User() user: UserModel, @Query('search') search?: string) {
    const beneficiaries = await this.blockchainBeneficiaryService.findAll(user, search);
    return this.transformResponse('Blockchain beneficiaries fetched successfully', beneficiaries, HttpStatus.OK);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a blockchain beneficiary by ID' })
  @ApiResponse({ status: 200, description: 'Blockchain beneficiary found' })
  @ApiResponse({ status: 404, description: 'Blockchain beneficiary not found' })
  async findOne(@User() user: UserModel, @Param('id') id: string) {
    const beneficiary = await this.blockchainBeneficiaryService.findById(id, user);
    return this.transformResponse('Blockchain beneficiary fetched successfully', beneficiary, HttpStatus.OK);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a blockchain beneficiary' })
  @ApiResponse({ status: 200, description: 'Blockchain beneficiary deleted successfully' })
  @ApiResponse({ status: 404, description: 'Blockchain beneficiary not found' })
  async delete(@User() user: UserModel, @Param('id') id: string) {
    await this.blockchainBeneficiaryService.delete(id, user);
    return this.transformResponse('Blockchain beneficiary deleted successfully', null, HttpStatus.OK);
  }
}
