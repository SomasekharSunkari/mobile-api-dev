import { Body, Controller, Inject, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BaseController } from '../../../base/base.controller';
import { CreatePushNotificationDto } from './dto/createPushNotification.dto';
import { PushNotificationTestService } from './pushNotification.service';

@Controller('test/push-notification')
export class PushNotificationController extends BaseController {
  @Inject(PushNotificationTestService)
  private readonly pushNotificationService: PushNotificationTestService;

  @ApiOperation({ summary: 'Send push notification' })
  @ApiBody({ type: CreatePushNotificationDto })
  @ApiResponse({
    status: 200,
    description: 'Push notification sent successfully',
  })
  @Post('')
  async sendPushNotification(@Body() data: CreatePushNotificationDto) {
    const result = await this.pushNotificationService.sendPushNotification(data.tokens, data);
    return this.transformResponse('Push notification sent successfully', result);
  }
}
