import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { DeviceInfo, SecurityContext as ISecurityContext } from './http/http_context.interface';

/**
 * Custom decorator to extract security context from response locals (populated by RegionalAccessGuard).
 * Used for login security and OTP operations.
 *
 * @example
 * @UseGuards(RegionalAccessGuard)
 * async login(@Body() loginDto: LoginDto, @SecurityContext() securityContext: SecurityContext) {
 *   // securityContext contains { clientIp, fingerprint }
 * }
 */
export const SecurityContext = createParamDecorator((_data: unknown, ctx: ExecutionContext): ISecurityContext => {
  const response = ctx.switchToHttp().getResponse();

  // Get security context from response locals (set by RegionalAccessGuard)
  const securityContext = response.locals.securityContext;

  if (!securityContext) {
    // Fallback to direct extraction if guard is not applied
    const request: Request = ctx.switchToHttp().getRequest();
    const headers = request.headers;

    const clientIp = request.clientIp;
    const fingerprint = headers['x-fingerprint'] as string;

    const deviceInfo = {
      device_name: headers['x-device-name'],
      device_type: headers['x-device-type'],
      os: headers['x-os'],
      browser: headers['x-browser'],
    } as DeviceInfo;

    return {
      clientIp,
      fingerprint,
      deviceInfo,
    };
  }

  return securityContext;
});
