import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { RequestContext } from '../config/request-context.config';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const timezone = req.header('x-timezone') ?? 'UTC';
    const traceId = req.header('x-trace-id') ?? randomUUID();
    const userId = res.locals.userId ?? undefined;
    const method = req.method;
    const path = req.originalUrl || req.url;
    const url = `${req.protocol}://${req.get('host')}${path}`;
    const appVersion = req.header('x-app-version') ?? undefined;
    const deviceType = req.header('x-device-type') ?? undefined;

    // Set x-trace-id in response headers for client tracking
    res.setHeader('x-trace-id', traceId);

    RequestContext.run({ timezone, traceId, userId, method, path, url, appVersion, deviceType }, () => next());
  }
}
