import { Body, Controller, Inject, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { BaseController } from '../../../base';
import { ThrottleGroups } from '../../../constants/constants';
import { UserModel } from '../../../database';
import { User } from '../../../decorators/User';
import { JwtAuthGuard } from '../strategies/jwt-auth.guard';
import { ChangePinDto } from './dtos/changePin.dto';
import { SetPinDto } from './dtos/setPin.dto';
import { SetPinResponseDto } from './dtos/setPinResponse.dto';
import { ValidateTransactionPinDto } from './dtos/validateTransactionPin.dto';
import { TransactionPinService } from './transactionPin.service';

/**
 * Controller for user security endpoints (e.g., setting transaction PIN).
 * Handles HTTP requests and responses for user security features.
 */
@UseGuards(JwtAuthGuard)
@ApiTags('Auth - User Security')
@Controller('auth/transaction-pins')
export class TransactionPinController extends BaseController {
  @Inject(TransactionPinService)
  private readonly transactionPinService: TransactionPinService;

  /**
   * Set a transaction PIN for the authenticated user.
   * @param dto - The PIN and confirmation PIN
   * @param req - The HTTP request (should contain authenticated user)
   * @returns Standardized API response
   */
  @Post('')
  @Throttle({ default: ThrottleGroups.STRICT })
  @ApiOperation({ summary: 'Set transaction PIN for user' })
  @ApiBody({ type: SetPinDto })
  @ApiResponse({
    status: 200,
    description: 'Transaction PIN set successfully',
    type: SetPinResponseDto,
  })
  @ApiBearerAuth('access_token')
  async setTransactionPin(
    @User()
    user: UserModel,
    @Body() dto: SetPinDto,
  ): Promise<any> {
    this.logger.log(`PIN set attempt for userId=${user.id}`, 'UserSecurityController');

    const result = await this.transactionPinService.setPin(user.id, dto);
    return this.transformResponse('Transaction PIN set successfully', result);
  }

  /**
   * Change transaction PIN for the authenticated user.
   * @param dto - The current PIN and new PIN details
   * @param req - The HTTP request (should contain authenticated user)
   * @returns Standardized API response
   */
  @Patch('')
  @Throttle({ default: ThrottleGroups.STRICT })
  @ApiOperation({ summary: 'Change transaction PIN for user' })
  @ApiBody({ type: ChangePinDto })
  @ApiResponse({
    status: 200,
    description: 'Transaction PIN changed successfully',
    type: SetPinResponseDto,
  })
  @ApiBearerAuth('access_token')
  async changeTransactionPin(@User() user: UserModel, @Body() dto: ChangePinDto): Promise<any> {
    this.logger.log(`PIN change attempt for userId=${user?.id}`, 'UserSecurityController');
    const userId = user?.id;
    const result = await this.transactionPinService.changePin(userId, dto);
    return this.transformResponse('Transaction PIN changed successfully', result);
  }

  /**
   * Validate transaction PIN for the authenticated user.
   * @param dto - The PIN to validate
   * @param user - The authenticated user
   * @returns Standardized API response with isValid property
   */
  @Post('validate')
  @Throttle({ default: ThrottleGroups.DEFAULT })
  @ApiOperation({ summary: 'Validate transaction PIN for user' })
  @ApiBody({ type: ValidateTransactionPinDto })
  @ApiResponse({
    status: 200,
    description: 'Transaction PIN validation result',
  })
  @ApiBearerAuth('access_token')
  async validateTransactionPin(@User() user: UserModel, @Body() dto: ValidateTransactionPinDto): Promise<any> {
    this.logger.log(`PIN validation attempt for userId=${user.id}`, 'UserSecurityController');
    const result = await this.transactionPinService.validateTransactionPin(user.id, dto.pin);
    return this.transformResponse('Transaction PIN validated', result);
  }
}
