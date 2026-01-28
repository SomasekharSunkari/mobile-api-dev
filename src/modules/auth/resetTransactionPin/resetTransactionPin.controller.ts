import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { BaseController } from '../../../base';
import { ThrottleGroups } from '../../../constants/constants';
import { UserModel } from '../../../database';
import { User } from '../../../decorators/User';
import { IgnoreIfFields, VerificationTokenGuard } from '../guard';
import { JwtAuthGuard } from '../strategies/jwt-auth.guard';
import { ResetPinWithTokenDto } from './dtos/resetPinWithToken.dto';
import { VerifyResetPinCodeDto } from './dtos/verifyResetPinCode.dto';
import { VerifyResetPinCodeResponseDto } from './dtos/verifyResetPinCodeResponse.dto';
import { ResetTransactionPinService } from './resetTransactionPin.service';

@UseGuards(JwtAuthGuard)
@ApiTags('ResetPin')
@Controller('/auth/reset-transaction-pins')
export class ResetTransactionPinController extends BaseController {
  @Inject(ResetTransactionPinService)
  private readonly resetTransactionPinService: ResetTransactionPinService;

  @Post('initiate')
  @Throttle({ default: ThrottleGroups.STRICT })
  @ApiOperation({ summary: 'Initiate PIN reset process' })
  async initiateResetPin(@User() user: UserModel) {
    await this.resetTransactionPinService.initiateResetPin(user.email);
    return this.transformResponse('Verification code sent to email');
  }

  @Post('verify')
  @Throttle({ default: ThrottleGroups.STRICT })
  @ApiOperation({ summary: 'Verify PIN reset code and get verification token' })
  @ApiBody({ type: VerifyResetPinCodeDto })
  @ApiResponse({ status: 200, type: VerifyResetPinCodeResponseDto })
  async verifyCode(
    @User() user: UserModel,
    @Body() dto: VerifyResetPinCodeDto,
  ): Promise<VerifyResetPinCodeResponseDto> {
    const result = await this.resetTransactionPinService.verifyCode(dto, user.id);

    return this.transformResponse('Code verified successfully', result);
  }

  @UseGuards(VerificationTokenGuard)
  @IgnoreIfFields(['token'])
  @Post('reset')
  @Throttle({ default: ThrottleGroups.AUTH })
  @ApiOperation({ summary: 'Reset PIN using verification token' })
  @ApiBody({ type: ResetPinWithTokenDto })
  async resetPinWithToken(
    @User() user: UserModel,
    @Body() dto: ResetPinWithTokenDto,
  ): Promise<VerifyResetPinCodeResponseDto> {
    const result = await this.resetTransactionPinService.resetPinWithToken(dto, user.id);
    return this.transformResponse('Transaction PIN changed successfully', result);
  }
}
