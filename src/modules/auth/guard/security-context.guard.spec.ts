import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { RegionalAccessGuard } from './security-context.guard';
import { LocationRestrictionService } from '../locationRestriction/locationRestriction.service';
import { LocationRestrictionsMetadata } from '../../../decorators/LocationRestrictions';
import { RestrictedRegionException } from '../../../exceptions/restricted_region_exception';

describe('RegionalAccessGuard', () => {
  let guard: RegionalAccessGuard;
  let locationRestrictionService: jest.Mocked<LocationRestrictionService>;
  let reflector: jest.Mocked<Reflector>;

  const mockRequest = {
    headers: {
      'x-fingerprint': 'test-fingerprint',
      'x-device-name': 'Test Device',
      'x-device-type': 'mobile',
      'x-os': 'iOS',
      'x-browser': 'Safari',
    },
    clientIp: '159.102.105.250',
  } as unknown as Request;

  const mockResponse = {
    locals: {},
  } as unknown as Response;

  const mockExecutionContext = {
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(mockRequest),
      getResponse: jest.fn().mockReturnValue(mockResponse),
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
  } as unknown as ExecutionContext;

  beforeEach(async () => {
    locationRestrictionService = {
      validateRegionalAccess: jest.fn(),
    } as any;

    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegionalAccessGuard,
        {
          provide: LocationRestrictionService,
          useValue: locationRestrictionService,
        },
        {
          provide: Reflector,
          useValue: reflector,
        },
      ],
    }).compile();

    guard = module.get<RegionalAccessGuard>(RegionalAccessGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should allow access when no restrictions are defined', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    locationRestrictionService.validateRegionalAccess.mockResolvedValue(undefined);

    const result = await guard.canActivate(mockExecutionContext);

    expect(result).toBe(true);
    expect(locationRestrictionService.validateRegionalAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        clientIp: '159.102.105.250',
        fingerprint: 'test-fingerprint',
      }),
      undefined,
      undefined,
      undefined,
      undefined,
    );
  });

  it('should pass customType from metadata to location restriction service', async () => {
    const restrictions: LocationRestrictionsMetadata = {
      restrictedLocation: ['New York'],
      customMessage: 'Custom message',
      customType: 'CARD_RESTRICTED_REGION_EXCEPTION',
    };

    reflector.getAllAndOverride.mockReturnValue(restrictions);
    locationRestrictionService.validateRegionalAccess.mockResolvedValue(undefined);

    const result = await guard.canActivate(mockExecutionContext);

    expect(result).toBe(true);
    expect(locationRestrictionService.validateRegionalAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        clientIp: '159.102.105.250',
        fingerprint: 'test-fingerprint',
      }),
      restrictions.restrictedLocation,
      restrictions.restrictedCountries,
      restrictions.customMessage,
      restrictions.customType,
    );
  });

  it('should pass undefined customType when not provided in metadata', async () => {
    const restrictions: LocationRestrictionsMetadata = {
      restrictedLocation: ['New York'],
      customMessage: 'Custom message',
    };

    reflector.getAllAndOverride.mockReturnValue(restrictions);
    locationRestrictionService.validateRegionalAccess.mockResolvedValue(undefined);

    const result = await guard.canActivate(mockExecutionContext);

    expect(result).toBe(true);
    expect(locationRestrictionService.validateRegionalAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        clientIp: '159.102.105.250',
        fingerprint: 'test-fingerprint',
      }),
      restrictions.restrictedLocation,
      restrictions.restrictedCountries,
      restrictions.customMessage,
      undefined,
    );
  });

  it('should throw RestrictedRegionException when location restriction service throws', async () => {
    const restrictions: LocationRestrictionsMetadata = {
      restrictedLocation: ['New York'],
      customType: 'CARD_RESTRICTED_REGION_EXCEPTION',
    };

    const exception = new RestrictedRegionException('New York', undefined, 'CARD_RESTRICTED_REGION_EXCEPTION');
    reflector.getAllAndOverride.mockReturnValue(restrictions);
    locationRestrictionService.validateRegionalAccess.mockRejectedValue(exception);

    try {
      await guard.canActivate(mockExecutionContext);
      fail('Expected RestrictedRegionException to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(RestrictedRegionException);
      expect(error).toBe(exception);
      expect(error.type).toBe('CARD_RESTRICTED_REGION_EXCEPTION');
    }

    expect(locationRestrictionService.validateRegionalAccess).toHaveBeenCalledWith(
      expect.any(Object),
      restrictions.restrictedLocation,
      restrictions.restrictedCountries,
      restrictions.customMessage,
      restrictions.customType,
    );
  });

  it('should store security context in response locals', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    locationRestrictionService.validateRegionalAccess.mockResolvedValue(undefined);

    await guard.canActivate(mockExecutionContext);

    expect(mockResponse.locals.securityContext).toBeDefined();
    expect(mockResponse.locals.securityContext.clientIp).toBe('159.102.105.250');
    expect(mockResponse.locals.securityContext.fingerprint).toBe('test-fingerprint');
    expect(mockResponse.locals.securityContext.deviceInfo).toEqual({
      device_name: 'Test Device',
      device_type: 'mobile',
      os: 'iOS',
      browser: 'Safari',
    });
  });
});
