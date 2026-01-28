import { InternalServerErrorException } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { RestrictionException } from '../exceptions/restriction_exception';
import { IpCountryBanService } from '../modules/auth/ipCountryBan/ipCountryBan.service';
import { UtilsService } from '../utils/utils.service';
import { AccessBlockMiddleware } from './accessBlock.middleware';

describe('AccessBlockMiddleware', () => {
  let middleware: AccessBlockMiddleware;
  let mockBanService: Partial<IpCountryBanService>;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    mockBanService = {
      checkAndBlockAccess: jest.fn(),
    };

    middleware = new AccessBlockMiddleware(mockBanService as IpCountryBanService);

    req = {
      clientIp: '123.123.123.123',
      originalUrl: '/api/test',
      geoInfo: { country: 'US' },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    next = jest.fn();

    jest.spyOn(UtilsService, 'getGeoInfoFromIp').mockReturnValue(null);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should call next() if access is not blocked', async () => {
    (mockBanService.checkAndBlockAccess as jest.Mock).mockResolvedValue(null);

    await middleware.use(req as Request, res as Response, next);

    expect(mockBanService.checkAndBlockAccess).toHaveBeenCalledWith(req.clientIp, req.geoInfo.country);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should block access and throw RestrictionException if result is truthy', async () => {
    const blockResponse = 'Access denied from your location';

    (mockBanService.checkAndBlockAccess as jest.Mock).mockResolvedValue(blockResponse);

    try {
      await middleware.use(req as Request, res as Response, next);
      fail('Expected RestrictionException to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(RestrictionException);
    }
    expect(mockBanService.checkAndBlockAccess).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('should handle internal error and throw InternalServerErrorException', async () => {
    const errorMessage = 'Database failure';
    (mockBanService.checkAndBlockAccess as jest.Mock).mockRejectedValue(new Error(errorMessage));

    await expect(middleware.use(req as Request, res as Response, next)).rejects.toThrow(InternalServerErrorException);
    expect(mockBanService.checkAndBlockAccess).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
