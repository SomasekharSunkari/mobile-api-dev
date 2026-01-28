import { Body, Controller, Delete, Get, HttpStatus, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { BaseController } from '../../../base';
import { ThrottleGroups } from '../../../constants/constants';
import { UserModel } from '../../../database';
import { AccountDeleteRequestModel } from '../../../database/models/accountDeleteRequest/accountDeleteRequest.model';
import { Roles } from '../../../decorators/Role';
import { User } from '../../../decorators/User';
import { ROLES } from '../guard/roles.enum';
import { RolesGuard } from '../guard/roles.guard';
import { JwtAuthGuard } from '../strategies/jwt-auth.guard';
import { AccountDeleteRequestService } from './accountDeleteRequest.service';
import { AccountDeleteRequestDto } from './dtos/accountDeleteRequest.dto';
import { AccountDeleteResponseDto } from './dtos/accountDeleteResponse.dto';
import { VerifyAccountDeleteRequestDto } from './dtos/verifyAccountDeleteRequest.dto';

@ApiTags('AccountDeleteRequest')
@ApiBearerAuth('access-token')
@Controller('/auth/account-delete-request')
@UseGuards(JwtAuthGuard)
export class AccountDeleteRequestController extends BaseController {
  @Inject(AccountDeleteRequestService)
  private readonly accountDeleteRequestService: AccountDeleteRequestService;

  @Post('/mail/send')
  @ApiOperation({ summary: 'Send account delete request verification mail' })
  @ApiResponse({
    status: 200,
    description: 'Account delete request verification mail sent successfully',
    type: AccountDeleteRequestModel,
  })
  @Throttle({ default: ThrottleGroups.STRICT })
  async sendAccountDeleteRequestMail(@User() user: UserModel) {
    const response = await this.accountDeleteRequestService.sendAccountDeleteRequestMail(user);

    return this.transformResponse('Account Delete Request Email Code Sent', response, HttpStatus.CREATED);
  }

  @Post('/verify')
  @ApiOperation({ summary: 'Verify account delete request code' })
  @ApiBody({ type: VerifyAccountDeleteRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Account delete request code verified successfully',
  })
  @Throttle({ default: ThrottleGroups.STRICT })
  async verifyCode(@User() user: UserModel, @Body() data: VerifyAccountDeleteRequestDto) {
    const response = await this.accountDeleteRequestService.verifyAccountDeleteRequestCode(user, data);

    return this.transformResponse('Account delete request code verified successfully', response, HttpStatus.OK);
  }

  @Post('')
  @ApiOperation({ summary: 'Request account deletion' })
  @ApiBody({ type: AccountDeleteRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Account delete request created successfully',
    type: AccountDeleteResponseDto,
  })
  @Throttle({ default: ThrottleGroups.STRICT })
  async createDeleteRequest(@User() user: UserModel, @Body() data: AccountDeleteRequestDto) {
    const response = await this.accountDeleteRequestService.createDeleteRequest(user, data);

    return this.transformResponse('AccountDeleteRequest Successfully Created', response);
  }

  @Get('/admin/user/:userId')
  @Roles(ROLES.ADMIN, ROLES.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Get active delete request for a user (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Active delete request fetched successfully',
  })
  async getActiveDeleteRequest(@Param('userId') userId: string) {
    const response = await this.accountDeleteRequestService.getActiveDeleteRequest(userId);

    return this.transformResponse('Active delete request fetched successfully', response, HttpStatus.OK);
  }

  @Delete('/admin/user/:userId/cancel')
  @Roles(ROLES.ADMIN, ROLES.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Cancel account delete request (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Account delete request cancelled successfully',
  })
  async cancelDeleteRequest(@Param('userId') userId: string) {
    const response = await this.accountDeleteRequestService.cancelDeleteRequest(userId);

    return this.transformResponse('Account delete request cancelled successfully', response, HttpStatus.OK);
  }
}
