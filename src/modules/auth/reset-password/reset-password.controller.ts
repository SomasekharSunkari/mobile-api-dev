import { Body, Controller, Inject, Patch, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { BaseController } from '../../../base';
import { ThrottleGroups } from '../../../constants/constants';
import { ForgotPasswordResponseDto } from './dtos/forgot-password-response.dto';
import { ForgotPasswordDto } from './dtos/forgot-password.dto';
import { ResetPasswordResponseDto } from './dtos/reset-password-response.dto';
import { ResetPasswordDto } from './dtos/reset-password.dto';
import { VerifyResetPasswordCodeDto } from './dtos/verity-reset-password-code.dto';
import { ResetPasswordService } from './reset-password.service';

@ApiTags('ResetPassword')
@Controller('/auth/reset-password')
export class ResetPasswordController extends BaseController {
  @Inject(ResetPasswordService)
  private readonly resetPasswordService: ResetPasswordService;

  @Post('')
  @ApiOperation({ summary: 'Request a password reset code via email or phone' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Reset code sent successfully',
    type: ForgotPasswordResponseDto,
  })
  @Throttle({ default: ThrottleGroups.STRICT })
  async forgotPassword(@Body() data: ForgotPasswordDto) {
    const response = await this.resetPasswordService.forgotPassword(data);

    return this.transformResponse('Password reset code sent', response);
  }

  @Patch('')
  @ApiOperation({ summary: 'Update the users password upon successful verification' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password successfully reset',
    type: ResetPasswordResponseDto,
  })
  @Throttle({ default: ThrottleGroups.STRICT })
  async resetPassword(@Body() data: ResetPasswordDto) {
    const response = await this.resetPasswordService.resetPassword(data);

    return this.transformResponse('Successfully Reset password', response);
  }

  @Post('/verify')
  @ApiOperation({ summary: 'Verify the reset password code' })
  @ApiResponse({
    status: 200,
    description: 'Successfully Verified Reset Password Code',
    type: ResetPasswordResponseDto,
  })
  @Throttle({ default: ThrottleGroups.STRICT })
  async verifyResetPassword(@Body() data: VerifyResetPasswordCodeDto) {
    const response = await this.resetPasswordService.verifyCode(data);

    return this.transformResponse('Successfully Verified Reset Password Code', response);
  }
}
