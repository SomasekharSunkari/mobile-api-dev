import { ForbiddenException, Logger, UnauthorizedException } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { EnvironmentService } from './config/environment';
import { UserModel } from './database';
import { IPermission } from './database/models/permission';
import { IRole } from './database/models/role';
import { IUserRole, UserRoleModel } from './database/models/userRole';
import { ROLES } from './modules/auth/guard';
import { TokenPayload } from './modules/auth/strategies/tokenPayload.interface';

export interface AuthorizationUserRole {
  role: IRole;
  permissions: IPermission[];
}

export class DecodeAndDecompressAuthHeader {
  private static readonly logger = new Logger(DecodeAndDecompressAuthHeader.name);
  static async handle(req: Request, res: Response, next: NextFunction) {
    //
    const exemptedPaths = [
      /^\/auth\/login$/,
      /^\/auth\/admin\/login$/,
      /^\/auth\/verify-otp$/,
      /^\/auth\/resend-otp$/,
      /^\/auth\/login-biometric$/,
      /^\/auth\/signup(\/[a-zA-Z]+)?(\/[a-zA-Z]+)?$/,
      /^\/auth\/register(\/[a-zA-Z]+)?(\/[a-zA-Z]+)?$/,
      /^\/auth\/reset-password(\/[a-zA-Z]+)?(\/[a-zA-Z]+)?/,
      /^\/auth\/refresh-token(\/[a-zA-Z]+)?(\/[a-zA-Z]+)?$/,
      /^\/auth\/account-verification(\/[a-zA-Z]+)?(\/[a-zA-Z]+)?/,
      /^\/auth\/kyc\/process-webhook(\/[a-zA-Z]+)?(\/[a-zA-Z]+)?/,
      /^\/users\/verify\/email$/,
      /^\/docs/,
      /^\/docs-json/,
      /^\/countries/,
      /^\/healthz$/,
      /^\/auth\/check-if-user-exists$/,
      /^\/test\/card\/create$/,
      /^\/support\/contact$/,

      /^\/grafana\/account$/,
      /^\/proxy\/zerohash/,
      /^\/views\/sumsub\/verification/,
      /^\/views\/plaid\/link/,
      // Firebase-related endpoints (e.g. notifications, auth hooks)
      // Forgot password request endpoint
      // Refresh access token
      // Initiate two-factor authentication
      // Validate two-factor authentication token
      // Password reset initiation (excluding change-password endpoint)
      // OAuth login endpoints (e.g. Google, Facebook)
      /**
       * ================================
       * Webhook endpoints
       * ================================
       *
       * These endpoints are used to handle webhooks from external services
       * We don't need to validate the token for these endpoints
       * We will handle the webhook validation in the webhookLoggerMiddleware which will run after this middleware
       *
       */
      /^\/kyc\/sumsub\/webhook$/,
      /^\/exchange\/yellowcard\/webhook$/,

      /^\/s3-bucket\/upload$/,

      /^\/paga\/top-up$/,
    ];

    const webhookPaths = [
      /^\/webhooks\/plaid(?:\/.*)?$/,
      /^\/webhooks\/fireblocks(?:\/.*)?$/,
      /^\/webhooks\/zerohash(?:\/.*)?$/,
      /^\/webhooks\/zerohash\/local(?:\/.*)?$/,
      /^\/webhooks\/paga(?:\/.*)?$/,
      /^\/webhooks\/sumsub(?:\/.*)?$/,
      /^\/webhooks\/yellowcard(?:\/.*)?$/,
    ];

    const path = new URL(req?.url, `https://${req.headers.host}`);

    if (path.pathname.includes('/webhooks') || DecodeAndDecompressAuthHeader.isRouteExempted(webhookPaths, req)) {
      /**
       * This is a webhook endpoint, so we don't need to validate the token
       * We will handle the webhook validation in the webhookLoggerMiddleware which will run after this middleware
       */
      this.logger.log(
        'Webhook endpoint detected, skipping authentication because guard for each webhook is implemented',
        {
          metadata: { path: path.pathname },
        },
      );
      return next();
    }

    if (DecodeAndDecompressAuthHeader.isRouteExempted(exemptedPaths, req)) {
      return next();
    }

    try {
      const jwtPayload = DecodeAndDecompressAuthHeader.decodeJwtToken(req);

      const { roles, permissions }: { roles: string[]; permissions: string[] } =
        await DecodeAndDecompressAuthHeader.getAuthorizationPrincipals(jwtPayload);

      res.locals.roles = roles ?? [];
      res.locals.permissions = permissions ?? [];
      res.locals.userId = jwtPayload.id ?? null;
      res.locals.userEmail = jwtPayload.email ?? null;
      res.locals.phone = jwtPayload.phone ?? null;

      const completeRequest = next();

      return completeRequest;
    } catch (e) {
      this.logger.error(e.message, 'DecodeAndDecompressAuthHeader.handle');
      return next(e);
    }
  }

  private static async throwIfUserRequiresPasswordReset(user: UserModel) {
    if (user?.require_password_reset) {
      throw new ForbiddenException('Your account requires a password reset, please reset your password');
    }
  }

  private static async getAuthorizationPrincipals(jwtPayload: TokenPayload) {
    let roles: string[] = [];
    let permissions: string[] = [];

    const authorizationUserRoles = await DecodeAndDecompressAuthHeader.getUserRole(jwtPayload);

    const transformedResponse = DecodeAndDecompressAuthHeader.transformRolesIdsObject(authorizationUserRoles);

    roles = transformedResponse.roles;
    permissions = transformedResponse.permissions;

    return { roles, permissions };
  }

  private static async getUserRole(payload: TokenPayload): Promise<AuthorizationUserRole[]> {
    const userRoles: IUserRole[] = await UserRoleModel.query()
      .where('user_id', payload.id)
      .withGraphFetched('[role.permissions]');

    const isUserActive = userRoles.some((userRole) => userRole.role?.slug === ROLES.ACTIVE_USER);

    if (!isUserActive) {
      throw new ForbiddenException(
        'Your account is not active yet, Verify your email or Phone to activate your account',
      );
    }

    const authorizationUserRoles = userRoles.map((userRole) => {
      const role = userRole.role;
      const permissions = userRole.role.permissions;
      delete userRole.role;

      return { role, permissions };
    });

    return authorizationUserRoles;
  }

  private static transformRolesIdsObject(data: AuthorizationUserRole[]) {
    let roles: string[] = [];
    let permissions: string[] = [];

    for (const payload of data) {
      roles = [...roles, payload.role.slug];
      permissions = [...permissions, ...new Set([...payload.permissions.map((permission) => permission.name)])];
    }

    return { roles, permissions };
  }

  private static decodeJwtToken(req: Request): TokenPayload {
    const requestAuthorization: string = req.headers.authorization;

    if (!requestAuthorization) {
      throw new UnauthorizedException('Authentication failed, Bearer token not provided');
    }

    const [authBearer, token] = requestAuthorization.split(' ');

    if (authBearer !== 'Bearer') {
      throw new UnauthorizedException('Authentication failed, Bearer keyword not provided');
    }

    let decoded: TokenPayload;

    try {
      const secret = EnvironmentService.getValue('JWT_SECRET_TOKEN') as string;

      decoded = jwt.verify(token, secret) as TokenPayload;
    } catch (e: any) {
      this.logger.error(e.message, 'DecodeAndDecompressAuthHeader.decodeJwtToken');
      throw new UnauthorizedException('Invalid authentication token');
    }

    return decoded;
  }

  static isRouteExempted(exemptedPaths: RegExp[], req: Request) {
    //
    const url = new URL(req?.url, `https://${req.headers.host}`);
    let exempted = false;
    for (const path of exemptedPaths) {
      if (path.test(url.pathname)) {
        exempted = true;
      }
    }

    return exempted;
  }
}
