import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IUser } from '../../../../database';
import { VerificationTokenService } from '../../verificationToken/verificationToken.service';

export const IGNORE_IF_FIELDS_KEY = 'ignore_if_fields';
export const IgnoreIfFields = (fields: string[]) => SetMetadata(IGNORE_IF_FIELDS_KEY, fields);

@Injectable()
export class VerificationTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verificationTokenService: VerificationTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest();

    const ignoreIfFields = this.reflector.get<string[]>(IGNORE_IF_FIELDS_KEY, context.getHandler()) || [];

    if (ignoreIfFields.some((field) => request.body[field])) {
      return true;
    }

    const user = request.user as IUser;
    if (!user?.id) {
      throw new UnauthorizedException('You are not authorized to access this resource');
    }

    const userId = user.id;
    const verificationToken = request.body.verification_token;

    if (!verificationToken) {
      throw new BadRequestException('Verification token is required');
    }

    const tokenRecord = await this.verificationTokenService.verifyToken(verificationToken);

    if (tokenRecord.user_id !== userId) {
      throw new BadRequestException('Invalid verification token');
    }

    return true;
  }
}
