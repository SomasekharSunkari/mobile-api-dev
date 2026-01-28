import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpStatus,
  Inject,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { BaseController } from '../../../base';
import { ThrottleGroups } from '../../../constants/constants';
import { UserModel } from '../../../database';
import { AccountDeactivationLogModel } from '../../../database/models/accountDeactivationLog/accountDeactivationLog.model';
import { Roles } from '../../../decorators/Role';
import { User } from '../../../decorators/User';
import { IgnoreIfFields, ROLES, RolesGuard, VerificationTokenGuard } from '../guard';
import { JwtAuthGuard } from '../strategies/jwt-auth.guard';
import { AccountDeactivationService } from './accountDeactivation.service';
import { ActivateAccountDto } from './dtos/activateAccount.dto';
import { CreateAccountDeactivationDto } from './dtos/createAccountDeactivation.dto';
import { ReactivateAccountDto, ReactivateAccountResponseDto } from './dtos/reactivateAccount.dto';

@ApiTags('AccountDeactivation')
@ApiBearerAuth('access-token')
@Controller('/auth/account-deactivation')
@UseGuards(JwtAuthGuard)
export class AccountDeactivationController extends BaseController {
  @Inject(AccountDeactivationService)
  private readonly accountDeactivationService: AccountDeactivationService;

  @Post('/')
  @UseGuards(VerificationTokenGuard)
  @IgnoreIfFields(['email_verification_code', 'user_id'])
  @ApiOperation({
    summary: 'Create account deactivation',
    description:
      'Restricts an account. Users can restrict their own account with verification. Admins can restrict any user by providing user_id.',
  })
  @ApiBody({ type: CreateAccountDeactivationDto })
  @ApiResponse({
    status: 200,
    description: 'Account deactivation created successfully',
    type: AccountDeactivationLogModel,
  })
  @Throttle({ default: ThrottleGroups.STRICT })
  async createDeactivation(@User() user: UserModel, @Body() data: CreateAccountDeactivationDto) {
    const response = await this.accountDeactivationService.createAccountDeactivation(user, data);

    return this.transformResponse('You have successfully deactivated your account', response, HttpStatus.CREATED);
  }

  @Post('/activate')
  @ApiOperation({
    summary: 'Activate account',
    description:
      'Activates a restricted account. Users can only activate their own account if they were the one who restricted it. Admins can activate any account.',
  })
  @ApiBody({ type: ActivateAccountDto })
  @ApiResponse({
    status: 200,
    description: 'Account activated successfully',
    type: AccountDeactivationLogModel,
  })
  @ApiResponse({
    status: 400,
    description: 'Account was restricted by admin - contact support',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - only admins can activate other users accounts',
  })
  @Throttle({ default: ThrottleGroups.STRICT })
  async activateAccount(@User() user: UserModel, @Body() data: ActivateAccountDto) {
    const response = await this.accountDeactivationService.activateAccount(data, user);

    return this.transformResponse('Account Activated Successfully', response, HttpStatus.OK);
  }

  @Get('/active')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Get current active deactivation record for a user' })
  @ApiResponse({
    status: 200,
    description: 'Active deactivation record retrieved successfully',
    type: AccountDeactivationLogModel,
  })
  async getActiveDeactivationRecord(@User() user: UserModel) {
    const response = await this.accountDeactivationService.getActiveDeactivationRecord(user.id);

    return this.transformResponse('Active deactivation record retrieved successfully', response, HttpStatus.OK);
  }

  @Get('/logs/:userId')
  @Roles(ROLES.ADMIN, ROLES.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Get all deactivation logs for a user (admin only)' })
  @ApiParam({ name: 'userId', description: 'User ID to get logs for' })
  @ApiResponse({
    status: 200,
    description: 'Deactivation logs retrieved successfully',
    type: [AccountDeactivationLogModel],
  })
  async getDeactivationLogsForUser(@Param('userId') userId: string) {
    const response = await this.accountDeactivationService.getDeactivationLogsForUser(userId);

    return this.transformResponse('Deactivation logs retrieved successfully', response, HttpStatus.OK);
  }

  @Post('/reactivate')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Reactivate account with support document' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['user_id', 'reactivation_description'],
      properties: {
        user_id: {
          type: 'string',
          description: 'User ID of the account to reactivate',
        },
        reactivation_description: {
          type: 'string',
          description: 'Description/reason for account reactivation',
        },
        support_document: {
          type: 'string',
          format: 'binary',
          description: 'Support document file (optional)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Account reactivated successfully',
    type: ReactivateAccountResponseDto,
  })
  @Throttle({ default: ThrottleGroups.STRICT })
  @UseInterceptors(
    FileInterceptor('support_document', {
      fileFilter(req, file, callback) {
        const allowedMimeTypes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];
        if (allowedMimeTypes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(new BadRequestException('Invalid file type. Allowed: JPEG, PNG, GIF, PDF, DOC, DOCX'), false);
        }
      },
    }),
  )
  async reactivateAccountWithDocument(
    @User() admin: UserModel,
    @Body() data: ReactivateAccountDto,
    @UploadedFile() supportDocument?: Express.Multer.File,
  ) {
    const response = await this.accountDeactivationService.reactivateAccountWithDocument(data, admin, supportDocument);

    return this.transformResponse('Account reactivated successfully', response, HttpStatus.OK);
  }
}
