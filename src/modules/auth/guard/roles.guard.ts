import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  matchRoles(roles: string[], userRoles: string[]) {
    return roles.some((role) => userRoles.includes(role));
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride('roles', [context.getHandler(), context.getClass()]);
    if (!roles) {
      return true;
    }
    const res: Response = context.switchToHttp().getResponse();

    const userRoles = res.locals.roles;

    const isMatched = this.matchRoles(roles, userRoles);

    if (!isMatched) {
      throw new ForbiddenException('You are not permitted to access this endpoint');
    }

    return isMatched;
  }
}
