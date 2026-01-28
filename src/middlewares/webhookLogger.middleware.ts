import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { AppLoggerService } from '../services/logger/logger.service';
//import { DecodeAndDecompressAuthHeader } from '../app.middleware';

@Injectable()
export class WebhookLoggerMiddleware implements NestMiddleware {
  @Inject(AppLoggerService)
  private readonly logger: AppLoggerService;

  async use(req: Request, _res: Response, next: NextFunction) {
    const isWebhookUrl = req.baseUrl.includes('/webhooks');

    if (!isWebhookUrl) {
      return next();
    }

    this.logger.logHttpRequest(req.method, req.originalUrl, 200, {
      body: req.body,
      headers: req.headers,
      operation: 'http_request',
    });

    return next();
  }
}
