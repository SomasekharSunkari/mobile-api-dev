import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { IUser } from '../database/models/user';

export const User = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const res: Request = ctx.switchToHttp().getRequest();
  const userObject = res.user as IUser;

  if (!userObject) {
    throw new ForbiddenException('You are not permitted to access this resource');
  }

  return userObject;
});
