import { Body, Controller, HttpStatus, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BaseController } from '../../../base/base.controller';
import { UserModel } from '../../../database/models/user/user.model';
import { User } from '../../../decorators/User';
import { JwtAuthGuard } from '../../auth/strategies/jwt-auth.guard';
import { PlaidLinkTokenExchangeDto } from './dto/link_external_account.dto';
import { LinkExternalAccountService } from './link_external_account.service';

@ApiTags('Link External Account')
@ApiBearerAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('external-accounts/')
export class LinkExternalAccountController extends BaseController {
  @Inject(LinkExternalAccountService)
  private readonly linkExternalAccountService: LinkExternalAccountService;

  @Post('plaid/exchange')
  @ApiOperation({ summary: 'Exchange public_token for access_token and link new bank account' })
  async exchangeToken(@Body() body: PlaidLinkTokenExchangeDto, @User() user: UserModel) {
    this.logger.debug(
      `Received POST /external-accounts/plaid/exchange for user_id=${user.id}, body=${JSON.stringify(body)}`,
    );

    const result = await this.linkExternalAccountService.handleTokenExchangeAndAccountLink(body, user);
    return this.transformResponse(result.message, result, HttpStatus.CREATED);
  }

  @Post('plaid/update')
  @ApiOperation({ summary: 'Update existing Plaid bank account credentials' })
  async updatePlaidAccount(@Body() updateDto: PlaidLinkTokenExchangeDto, @User() user: UserModel) {
    this.logger.debug(
      `Received POST /external-accounts/plaid/update for user_id=${user.id}, body=${JSON.stringify(updateDto)}`,
    );

    const result = await this.linkExternalAccountService.handleCredentialUpdate(updateDto, user);
    return this.transformResponse(result.message, result, HttpStatus.OK);
  }
}
