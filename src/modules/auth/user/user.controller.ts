import { Body, Controller, Get, HttpStatus, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { BaseController } from '../../../base';
import { ThrottleGroups } from '../../../constants/constants';
import { UserModel } from '../../../database';
import { Roles } from '../../../decorators/Role';
import { User } from '../../../decorators/User';
import { SecurityContext } from '../../../decorators/http/http_context.interface';
import { SecurityContext as SecurityContextDecorator } from '../../../decorators/security-context.decorator';
import { ThrottleMessage } from '../../../decorators/throttle-message.decorator';
import { ROLES, RolesGuard } from '../guard';
import { JwtAuthGuard } from '../strategies/jwt-auth.guard';
import { GetUploadUrlDto } from '../userProfile/dto/getUploadUrl.dto';
import { UpdateUserDto } from '../userProfile/dto/updateUser.dto';
import { UpdateUserResponseDto } from '../userProfile/dto/updateUserResponse.dto';
import { ChangePasswordDto } from './dtos/changePassword.dto';
import { ChangePasswordResponseDto } from './dtos/changePasswordResponse.dto';
import { SearchUserDto } from './dtos/searchUser.dto';
import { UpdateDisableLoginRestrictionsDto } from './dtos/updateDisableLoginRestrictions.dto';
import { VerifyPasswordDto } from './dtos/verifiyPassword.dto';
import { UserService } from './user.service';

@ApiTags('User')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('/auth/user')
export class UserController extends BaseController {
  @Inject(UserService)
  private readonly userService: UserService;

  @Patch('/:userId/disable-login-restrictions')
  @Roles(ROLES.ADMIN, ROLES.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Update disable_login_restrictions flag for a user (Admin only)' })
  @ApiBody({ type: UpdateDisableLoginRestrictionsDto })
  @ApiResponse({
    status: 200,
    description: 'disable_login_restrictions updated successfully',
    type: UserModel,
  })
  async updateDisableLoginRestrictions(
    @Param('userId') userId: string,
    @Body() data: UpdateDisableLoginRestrictionsDto,
  ) {
    const updatedUser = await this.userService.updateDisableLoginRestrictions(userId, data.disable_login_restrictions);

    return this.transformResponse('disable_login_restrictions updated successfully', updatedUser, HttpStatus.OK);
  }

  @Get()
  @ApiOperation({ summary: 'Get current user information' })
  @ApiResponse({
    status: 200,
    description: 'User fetched successfully',
  })
  async getUser(@User() user: UserModel, @SecurityContextDecorator() securityContext: SecurityContext) {
    const userWithDetails = await this.userService.getUserDetails(user.id, securityContext);
    return this.transformResponse('User fetched successfully', { user: userWithDetails });
  }

  @Patch()
  @ApiOperation({ summary: 'Update user profile details' })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    type: UpdateUserResponseDto,
  })
  @Throttle({ default: ThrottleGroups.STRICT })
  async updateProfile(
    @User()
    user: UserModel,
    @Body() data: UpdateUserDto,
  ) {
    const userId = user.id;
    const updatedUser = await this.userService.updateProfile(userId, data);

    return this.transformResponse('User Updated successfully', updatedUser, HttpStatus.CREATED);
  }

  @Patch('/change-password')
  @ApiOperation({ summary: 'Change user password' })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    type: ChangePasswordResponseDto,
  })
  @Throttle({ default: ThrottleGroups.STRICT })
  async changePassword(
    @User()
    user: UserModel,
    @Body() data: ChangePasswordDto,
  ) {
    const userId = user.id;
    const updatedUser = await this.userService.changePassword(userId, data);

    return this.transformResponse('Password changed successfully', updatedUser, HttpStatus.OK);
  }

  @Get('beneficiaries')
  @ApiOperation({ summary: 'Get all beneficiaries for the user' })
  @ApiResponse({
    status: 200,
    description: 'Beneficiaries fetched successfully',
    type: [UserModel],
  })
  async getBeneficiaries(@User() user: UserModel, @Query() searchDto: SearchUserDto) {
    const beneficiaries = await this.userService.searchUsers(user, searchDto);
    return this.transformResponse('Beneficiaries fetched successfully', beneficiaries);
  }

  @Post('/password/verify')
  @ApiOperation({ summary: 'Verify account deactivation password' })
  @ApiBody({ type: VerifyPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password verified successfully',
    type: Boolean,
  })
  @Throttle({ default: ThrottleGroups.STRICT })
  @ThrottleMessage('You have exceeded the maximum number of attempts. Please try again later.')
  async verifyPassword(@User() user: UserModel, @Body() data: VerifyPasswordDto) {
    const response = await this.userService.verifyPassword(user.id, data);

    return this.transformResponse('Password Verified', response, HttpStatus.CREATED);
  }

  @Post('/profile-image/upload-url')
  @ApiOperation({ summary: 'Get profile image upload URL' })
  @ApiBody({ type: GetUploadUrlDto })
  @ApiResponse({
    status: 200,
    description: 'Upload URL generated successfully',
  })
  async getUploadUrl(@User() user: UserModel, @Body() data: GetUploadUrlDto) {
    const response = await this.userService.getUploadUrl(user.id, data.content_type);

    return this.transformResponse('Upload URL generated successfully', response, HttpStatus.OK);
  }
}
