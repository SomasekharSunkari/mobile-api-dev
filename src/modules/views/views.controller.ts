import { Controller, Get, Query, Render } from '@nestjs/common';

@Controller('views')
export class ViewsController {
  @Get('sumsub/verification')
  @Render('sumsub/verification')
  async sumsubVerification(@Query('accessToken') accessToken: string) {
    return {
      accessToken,
    };
  }

  @Get('plaid/link')
  @Render('plaid/link')
  async plaidLink(@Query('linkToken') linkToken: string, @Query('accessToken') accessToken: string) {
    return {
      linkToken,
      accessToken,
    };
  }
}
