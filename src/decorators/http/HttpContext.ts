import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { UserModel } from '../../database';
import { HttpContextManagement } from './http_context.interface';

export const HttpContext = createParamDecorator((_data: unknown, ctx: ExecutionContext): HttpContextManagement => {
  const request: Request = ctx.switchToHttp().getRequest();
  const userObject = request.user as UserModel;

  return {
    auth: {
      user: userObject,
    },
    deviceInfo: {
      deviceInfo: request.deviceInfo,
      geoInfo: request.geoInfo,
    },
  };
});
