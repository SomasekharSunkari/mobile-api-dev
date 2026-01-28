import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { DeviceInfo, SecurityContext } from '../../../decorators/http/http_context.interface';
import { LOCATION_RESTRICTIONS_KEY, LocationRestrictionsMetadata } from '../../../decorators/LocationRestrictions';
import { LocationRestrictionService } from '../locationRestriction/locationRestriction.service';

/**
 * Guard that extracts security context from request headers, stores it in res.locals,
 * and validates regional access restrictions. Specifically blocks USD transactions
 * from New York IP addresses due to regulatory requirements.
 */
@Injectable()
export class RegionalAccessGuard implements CanActivate {
  @Inject(LocationRestrictionService)
  private readonly locationRestrictionService: LocationRestrictionService;

  @Inject(Reflector)
  private readonly reflector: Reflector;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const headers = request.headers;

    // Extract IP address from X-Forwarded-For header (get first IP and trim whitespace)
    const clientIp = request.clientIp;

    // Extract device fingerprint
    const fingerprint = headers['x-fingerprint'] as string;

    // Extract device information from headers
    const deviceInfo = {
      device_name: headers['x-device-name'],
      device_type: headers['x-device-type'],
      os: headers['x-os'],
      browser: headers['x-browser'],
    } as DeviceInfo;

    // Store security context in response locals for access throughout the request lifecycle
    const securityContext: SecurityContext = {
      clientIp,
      fingerprint,
      deviceInfo,
    };

    response.locals.securityContext = securityContext;

    // Get location restrictions from metadata if provided
    const restrictions: LocationRestrictionsMetadata | undefined = this.reflector.getAllAndOverride(
      LOCATION_RESTRICTIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    console.log('restrictions', restrictions);
    // Perform regional access validation using LocationRestrictionService
    await this.locationRestrictionService.validateRegionalAccess(
      securityContext,
      restrictions?.restrictedLocation,
      restrictions?.restrictedCountries,
      restrictions?.customMessage,
      restrictions?.customType,
    );

    return true;
  }
}
