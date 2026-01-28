import { Body, Controller, HttpStatus, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { BaseController } from '../../../base';
import { ThrottleGroups } from '../../../constants/constants';
import { UserModel } from '../../../database';
import { AccountActionCodeModel } from '../../../database/models/accountActionCode/accountActionCode.model';
import { User } from '../../../decorators/User';
import { JwtAuthGuard } from '../strategies/jwt-auth.guard';
import { AccountActionCodeService } from './accountActionCode.service';
import { AccountActionType, SendAccountActionCodeMailDto } from './dtos/sendAccountActionCodeMail.dto';
import { VerifyAccountActionEmailCodeDto } from './dtos/verifyAccountActionEmailCode.dto';

@ApiTags('AccountActionCode')
@ApiBearerAuth('access-token')
@Controller('/auth/account-action-code')
@UseGuards(JwtAuthGuard)
export class AccountActionCodeController extends BaseController {
  @Inject(AccountActionCodeService)
  private readonly accountActionCodeService: AccountActionCodeService;

  @Post('/initiate')
  @ApiOperation({ summary: 'Initiate account action verification' })
  @ApiBody({ type: SendAccountActionCodeMailDto })
  @ApiResponse({
    status: 201,
    description: 'Account action verification initiated successfully',
    type: AccountActionCodeModel,
  })
  @Throttle({ default: ThrottleGroups.STRICT })
  async sendAccountActionCodeMail(@User() user: UserModel, @Body() data: SendAccountActionCodeMailDto) {
    const action = data.action || AccountActionType.DEACTIVATE;
    const response = await this.accountActionCodeService.createAccountActionCode(user, action);

    return this.transformResponse('Account action verification initiated successfully', response, HttpStatus.CREATED);
  }

  @Post('/verify')
  @ApiOperation({ summary: 'Verify account action code' })
  @ApiBody({ type: VerifyAccountActionEmailCodeDto })
  @ApiResponse({
    status: 200,
    description: 'Account action code verified successfully',
  })
  @Throttle({ default: ThrottleGroups.STRICT })
  async verifyCode(@User() user: UserModel, @Body() data: VerifyAccountActionEmailCodeDto) {
    const response = await this.accountActionCodeService.verifyAccountActionCode(data.code, user);

    return this.transformResponse('Account action code verified successfully', response, HttpStatus.OK);
  }
}
