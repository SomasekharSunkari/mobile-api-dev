import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import * as requestIp from 'request-ip';

export const IpAddress = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req: Request = ctx.switchToHttp().getRequest();
  return requestIp.getClientIp(req);
});
