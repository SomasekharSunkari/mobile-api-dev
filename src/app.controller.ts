import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';
import { BaseController } from './base';

@Controller()
export class AppController extends BaseController {
  @Inject(AppService)
  private readonly appService: AppService;

  @Get('/healthz')
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Returns service status, Git metadata, and connection status for Redis and database',
    schema: {
      example: {
        statusCode: 200,
        message: 'OneDosh health service',
        data: {
          status: 'ok',
          commit: 'abc123...',
          branch: 'main',
          buildTime: '2025-05-05T15:27:25.966Z',
          timestamp: '2025-05-05T15:30:00.000Z',
          services: {
            database: {
              status: 'ok',
            },
            redis: {
              status: 'ok',
            },
          },
        },
        timestamp: '2025-05-05T15:30:00.000Z',
      },
    },
  })
  async getHealthz() {
    this.logger.log('getHealthz');
    const data = await this.appService.getHealth();

    return this.transformResponse(`OneDosh health service`, data);
  }
}
