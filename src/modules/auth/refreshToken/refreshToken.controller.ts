import { Body, Controller, HttpStatus, Inject, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { BaseController } from '../../../base';
import { RefreshTokenDto } from './dtos/refreshToken.dto';
import { RefreshTokenService } from './refreshToken.service';
import { ThrottleGroups } from '../../../constants/constants';
@ApiTags('Auth')
@Controller('/auth/refresh-token')
export class RefreshTokenController extends BaseController {
  @Inject(RefreshTokenService)
  private readonly refreshTokenService: RefreshTokenService;

  @Post('')
  @ApiOperation({ summary: 'Refresh JWT using a valid refresh token' })
  @ApiBody({ type: RefreshTokenDto })
  @Throttle({ default: ThrottleGroups.AUTH })
  async create(
    @Body()
    data: RefreshTokenDto,
  ) {
    const tokens = await this.refreshTokenService.refreshAuthToken(data.token);

    return this.transformResponse('User token refreshed successfully', tokens, HttpStatus.CREATED);
  }
}
