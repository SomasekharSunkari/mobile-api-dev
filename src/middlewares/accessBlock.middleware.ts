import { Inject, Injectable, InternalServerErrorException, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { RestrictionErrorType, RestrictionException } from '../exceptions/restriction_exception';
import { IpCountryBanService } from '../modules/auth/ipCountryBan/ipCountryBan.service';
import { UtilsService } from '../utils/utils.service';

@Injectable()
export class AccessBlockMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AccessBlockMiddleware.name);

  constructor(@Inject(IpCountryBanService) private readonly banService: IpCountryBanService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const ip = req.clientIp;
    const geoInfo = UtilsService.getGeoInfoFromIp(ip);
    const country = geoInfo?.country || req.geoInfo?.country || 'unknown';
    const path = req.originalUrl;

    try {
      const result = await this.banService.checkAndBlockAccess(ip, country);

      if (result) {
        // Log the blocked attempt for audit purposes
        this.logger.warn(`Blocked access attempt: IP=${ip}, Country=${country}, Path=${path}`);

        // Respond with the blocked access message
        throw new RestrictionException(RestrictionErrorType.ERR_COMPLIANCE_COUNTRY_BANNED, result, { country });
      }

      // Proceed to the next middleware/handler
      next();
    } catch (error) {
      // Only log errors in non-test environments

      this.logger.error(`Error in AccessBlockMiddleware: ${error?.message}`, error?.stack);

      // Only wrap non-RestrictionException errors
      if (error instanceof RestrictionException) {
        throw error;
      }
      // Handle the error gracefully
      throw new InternalServerErrorException({
        message: 'Internal Server Error',
        error: error?.message,
        timestamp: new Date().toISOString(),
        path,
      });
    }
  }
}
