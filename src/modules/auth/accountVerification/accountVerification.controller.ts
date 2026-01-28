import { Body, Controller, Inject, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BaseController } from '../../../base';
import { AccountVerificationService } from './accountVerification.service';
import { VerifyCodeDto } from './dtos/verifiyCode';
import { VerifyCodeResponse } from './dtos/verifyCodeResponse';

import { Throttle } from '@nestjs/throttler';
import { ThrottleGroups } from '../../../constants/constants';

@ApiTags('AccountVerification')
@Controller('/auth/account-verification')
export class AccountVerificationController extends BaseController {
  @Inject(AccountVerificationService)
  private readonly accountVerificationService: AccountVerificationService;

  @Post('verify')
  @ApiOperation({ summary: 'Verify account using email or phone + code' })
  @ApiBody({ type: VerifyCodeDto })
  @ApiResponse({
    status: 200,
    description: 'Account verified successfully',
    type: VerifyCodeResponse,
  })
  @Throttle({ default: ThrottleGroups.STRICT })
  async verifyAccount(@Body() data: VerifyCodeDto) {
    const response = await this.accountVerificationService.verifyAccount(data);

    return this.transformResponse('Account Verified Successfully', response);
  }
}
