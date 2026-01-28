import { Body, Controller, Get, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BaseController } from '../../base/base.controller';
import { UserModel } from '../../database';
import { User } from '../../decorators/User';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { CreateContactSupportDto } from './dto/createContactSupport.dto';
import { CreateSupportTicketDto } from './dto/createSupportTicket.dto';
import { SupportService } from './support.service';

@ApiTags('Support')
@Controller('support')
export class SupportController extends BaseController {
  @Inject(SupportService)
  private readonly supportService: SupportService;

  @Post('ticket')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a new support ticket' })
  @ApiResponse({ status: 201, description: 'Support ticket created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async createSupportTicket(@Body() createSupportTicketDto: CreateSupportTicketDto, @User() user: UserModel) {
    await this.supportService.createSupportTicket(createSupportTicketDto, user.email, 'ticket', user);
    return this.transformResponse('Support ticket submitted successfully');
  }

  @Post('contact')
  @ApiOperation({ summary: 'Contact support (unauthenticated)' })
  @ApiResponse({ status: 201, description: 'Support message submitted successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async contactSupport(@Body() createSupportTicketDto: CreateContactSupportDto) {
    await this.supportService.createSupportTicket(createSupportTicketDto, createSupportTicketDto.user_email, 'contact');
    return this.transformResponse('Support message submitted successfully');
  }

  @Get('jwt-token')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get Zendesk JWT token for messaging authentication' })
  @ApiResponse({ status: 200, description: 'JWT token generated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getZendeskJwtToken(@User() user: UserModel) {
    const token = await this.supportService.generateZendeskJwtToken(user);
    return this.transformResponse('JWT token generated successfully', { token });
  }
}
