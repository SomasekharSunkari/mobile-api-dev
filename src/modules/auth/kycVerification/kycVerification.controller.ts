import { BadRequestException, Body, Controller, Get, HttpStatus, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { BaseController } from '../../../base';
import { UserModel } from '../../../database';
import { Roles } from '../../../decorators/Role';
import { User } from '../../../decorators/User';
import { ROLES } from '../guard';
import { JwtAuthGuard } from '../strategies/jwt-auth.guard';
import { InitiateWidgetKycDto } from './dto/generateSumsubAccessToken.dto';
import { RestartKycVerificationDto } from './dto/restartKycVerification.dto';
import { KycVerificationService } from './kycVerification.service';

@ApiTags('KYC')
@ApiBearerAuth('access-token')
@Controller('auth/kyc')
@UseGuards(JwtAuthGuard)
export class KycVerificationController extends BaseController {
  @Inject(KycVerificationService)
  private readonly kycVerificationService: KycVerificationService;

  @Get('status')
  @ApiOperation({ summary: 'Get the current KYC status for the authenticated user' })
  async getKycStatus(@Req() req: Request): Promise<any> {
    const user = (req as any).user;
    if (!user?.id) {
      throw new BadRequestException('Invalid user context');
    }

    const kycRecord = await this.kycVerificationService.findByUserId(user.id);
    if (!kycRecord) {
      throw new BadRequestException('No KYC record found for user');
    }

    return this.transformResponse('KYC status fetched', kycRecord);
  }

  @Post('initiate')
  @ApiOperation({ summary: 'Generate a Sumsub access token for the authenticated user' })
  async generateSumsubAccessToken(@User() user: UserModel, @Body() dto: InitiateWidgetKycDto) {
    const token = await this.kycVerificationService.initiateWidgetKyc(user.id, dto);

    return this.transformResponse('Sumsub access token generated', token, HttpStatus.CREATED);
  }

  @Post('restart')
  @ApiOperation({ summary: 'Restart KYC verification process for the authenticated user' })
  async restartKycVerification(@User() user: UserModel, @Body() dto: RestartKycVerificationDto) {
    const token = await this.kycVerificationService.restartWidgetKyc(user.id, dto);

    return this.transformResponse('Sumsub access token generated', token, HttpStatus.CREATED);
  }

  @Roles(ROLES.ADMIN)
  @Post('fix-users-kyc-address')
  @ApiOperation({ summary: 'Fix users KYC address' })
  async moveMetadataAddressToSumsubInfoAddress() {
    const result = await this.kycVerificationService.moveMetadataAddressToSumsubInfoAddress();

    return this.transformResponse('Metadata address moved to sumsub info address', result);
  }
}
