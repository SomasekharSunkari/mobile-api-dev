import { BadRequestException, Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import * as requestIp from 'request-ip';

@Injectable()
export class IpMiddleware implements NestMiddleware {
  private readonly logger = new Logger(IpMiddleware.name);

  use(req: Request, _: Response, next: NextFunction) {
    // Extract IP address
    req.clientIp = requestIp.getClientIp(req);

    // Validate required security headers for auth routes
    this.validateRequiredHeaders(req);

    next();
  }

  private validateRequiredHeaders(req: Request): void {
    const fingerprint = req.headers['x-fingerprint'];

    // Check if both required headers are present
    if (!fingerprint) {
      this.logger.warn(`Missing X-Fingerprint header for ${req.method} ${req.originalUrl}`);
      throw new BadRequestException({
        message: 'X-Fingerprint header is required',
        error: 'Missing Required Header',
        statusCode: 400,
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      });
    }
  }
}
