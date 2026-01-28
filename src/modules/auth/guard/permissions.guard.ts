import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  matchPermission(permissions: string[], userPermissions: string[]) {
    return permissions.some((permission) => userPermissions.includes(permission));
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permissions = this.reflector.getAllAndOverride('permissions', [context.getHandler(), context.getClass()]);

    if (!permissions) {
      return true;
    }
    const res: Response = context.switchToHttp().getResponse();

    const userPermissions = res.locals.permissions;

    const isMatched = this.matchPermission(permissions, userPermissions);

    if (!isMatched) {
      throw new ForbiddenException('You are not permitted to access this endpoint');
    }

    return isMatched;
  }
}
