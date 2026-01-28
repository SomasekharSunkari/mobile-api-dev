import { Controller, Get, HttpStatus, Inject, MessageEvent, Query, Sse, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { BaseController } from '../../base/base.controller';
import { Pagination } from '../../database/base/base.interface';
import { UserModel } from '../../database/models/user/user.model';
import { User } from '../../decorators/User';
import { StreamService } from '../../services/streams/stream.service';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { InAppNotificationService } from './inAppNotification.service';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController extends BaseController {
  @Inject(InAppNotificationService)
  private readonly inAppNotificationService: InAppNotificationService;

  @Inject(StreamService)
  private readonly streamService: StreamService;

  @Sse('unread/stream')
  @ApiOperation({ summary: 'Stream real-time unread in-app notification count via SSE' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'SSE connection established for unread notification count',
    content: {
      'text/event-stream': {
        schema: {
          type: 'string',
          example: 'data: {"type":"connected","timestamp":"2024-01-01T00:00:00.000Z"}\n\n',
        },
      },
    },
  })
  streamUnreadCount(@User() user: UserModel): Observable<MessageEvent> {
    return this.streamService.getUserUnreadNotificationCountStream(user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all notifications for a user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Notifications fetched successfully' })
  async getNotifications(@User() user: UserModel, @Query() pagination: Pagination) {
    const notifications = await this.inAppNotificationService.findAllNotificationsByUser(user.id, pagination);
    return this.transformResponse('Notifications fetched successfully', notifications);
  }
}
