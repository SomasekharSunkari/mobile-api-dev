import { Test, TestingModule } from '@nestjs/testing';
import { LocationRestrictionService } from './locationRestriction.service';
import { TransactionMonitoringAdapter } from '../../../adapters/transaction-monitoring/transaction-monitoring-adapter';
import { SecurityContext } from '../../../decorators/http/http_context.interface';
import { RestrictedRegionException } from '../../../exceptions/restricted_region_exception';

describe('LocationRestrictionService', () => {
  let service: LocationRestrictionService;
  let mockTransactionMonitoringAdapter: jest.Mocked<TransactionMonitoringAdapter>;

  const mockSecurityContext: SecurityContext = {
    clientIp: '159.102.105.250',
    fingerprint: 'test-fingerprint',
    deviceInfo: {
      device_name: 'Test Device',
      device_type: 'mobile',
      os: 'iOS',
      browser: 'Safari',
    },
  };

  beforeEach(async () => {
    mockTransactionMonitoringAdapter = {
      ipCheck: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationRestrictionService,
        {
          provide: TransactionMonitoringAdapter,
          useValue: mockTransactionMonitoringAdapter,
        },
      ],
    }).compile();

    service = module.get<LocationRestrictionService>(LocationRestrictionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateRegionalAccess', () => {
    it('should allow operation when location data is not available', async () => {
      mockTransactionMonitoringAdapter.ipCheck.mockResolvedValue(null);

      await expect(service.validateRegionalAccess(mockSecurityContext)).resolves.not.toThrow();

      expect(mockTransactionMonitoringAdapter.ipCheck).toHaveBeenCalledWith({
        ipAddress: mockSecurityContext.clientIp,
        userId: 'regional_access_check',
      });
    });

    it('should allow operation when user is not in restricted location', async () => {
      const locationData = {
        city: 'Los Angeles',
        region: 'California',
        country: 'US',
        isVpn: false,
      };

      mockTransactionMonitoringAdapter.ipCheck.mockResolvedValue(locationData);

      await expect(service.validateRegionalAccess(mockSecurityContext)).resolves.not.toThrow();

      expect(mockTransactionMonitoringAdapter.ipCheck).toHaveBeenCalledWith({
        ipAddress: mockSecurityContext.clientIp,
        userId: 'regional_access_check',
      });
    });

    it('should allow operation when user is not in US', async () => {
      const locationData = {
        city: 'Toronto',
        region: 'Ontario',
        country: 'CA',
        isVpn: false,
      };

      mockTransactionMonitoringAdapter.ipCheck.mockResolvedValue(locationData);

      await expect(service.validateRegionalAccess(mockSecurityContext)).resolves.not.toThrow();

      expect(mockTransactionMonitoringAdapter.ipCheck).toHaveBeenCalledWith({
        ipAddress: mockSecurityContext.clientIp,
        userId: 'regional_access_check',
      });
    });

    it('should throw RestrictedRegionException when user is in restricted location', async () => {
      const locationData = {
        city: 'New York',
        region: 'New York',
        country: 'US',
        isVpn: false,
      };

      mockTransactionMonitoringAdapter.ipCheck.mockResolvedValue(locationData);

      try {
        await service.validateRegionalAccess(mockSecurityContext);
        fail('Expected RestrictedRegionException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RestrictedRegionException);
        expect(error.message).toBe('USD transactions are restricted from New York due to regulatory requirements.');
        expect(error.type).toBe('RESTRICTED_REGION_EXCEPTION');
        expect(error.statusCode).toBe(403);
      }

      expect(mockTransactionMonitoringAdapter.ipCheck).toHaveBeenCalledWith({
        ipAddress: mockSecurityContext.clientIp,
        userId: 'regional_access_check',
      });
    });

    it('should handle adapter errors gracefully and not throw', async () => {
      const error = new Error('Network error');
      mockTransactionMonitoringAdapter.ipCheck.mockRejectedValue(error);

      await expect(service.validateRegionalAccess(mockSecurityContext)).resolves.not.toThrow();

      expect(mockTransactionMonitoringAdapter.ipCheck).toHaveBeenCalledWith({
        ipAddress: mockSecurityContext.clientIp,
        userId: 'regional_access_check',
      });
    });

    it('should re-throw RestrictedRegionException from adapter', async () => {
      const restrictedRegionError = new RestrictedRegionException('New York');
      mockTransactionMonitoringAdapter.ipCheck.mockRejectedValue(restrictedRegionError);

      try {
        await service.validateRegionalAccess(mockSecurityContext);
        fail('Expected RestrictedRegionException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RestrictedRegionException);
        expect(error).toBe(restrictedRegionError);
      }

      expect(mockTransactionMonitoringAdapter.ipCheck).toHaveBeenCalledWith({
        ipAddress: mockSecurityContext.clientIp,
        userId: 'regional_access_check',
      });
    });

    it('should throw RestrictedRegionException for different restricted locations', async () => {
      const locationData = {
        country: 'US',
        region: 'California',
        city: 'Los Angeles',
        isVpn: false,
      };

      mockTransactionMonitoringAdapter.ipCheck.mockResolvedValue(locationData);

      try {
        await service.validateRegionalAccess(mockSecurityContext, 'California');
        fail('Expected RestrictedRegionException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RestrictedRegionException);
        expect(error.message).toBe('USD transactions are restricted from California due to regulatory requirements.');
        expect(error.type).toBe('RESTRICTED_REGION_EXCEPTION');
        expect(error.statusCode).toBe(403);
      }
    });

    it('should throw RestrictedRegionException for locations with spaces in names', async () => {
      const locationData = {
        country: 'US',
        region: 'Los Angeles',
        city: 'Los Angeles',
        isVpn: false,
      };

      mockTransactionMonitoringAdapter.ipCheck.mockResolvedValue(locationData);

      try {
        await service.validateRegionalAccess(mockSecurityContext, 'Los Angeles');
        fail('Expected RestrictedRegionException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RestrictedRegionException);
        expect(error.message).toBe('USD transactions are restricted from Los Angeles due to regulatory requirements.');
        expect(error.type).toBe('RESTRICTED_REGION_EXCEPTION');
        expect(error.statusCode).toBe(403);
      }
    });

    it('should throw RestrictedRegionException when user is in restricted country array', async () => {
      const locationData = {
        country: 'BY',
        region: 'Minsk',
        city: 'Minsk',
        isVpn: false,
      };

      mockTransactionMonitoringAdapter.ipCheck.mockResolvedValue(locationData);

      try {
        await service.validateRegionalAccess(mockSecurityContext, undefined, ['BY', 'CN']);
        fail('Expected RestrictedRegionException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RestrictedRegionException);
        expect(error.message).toBe('USD transactions are restricted from BY, CN due to regulatory requirements.');
        expect(error.type).toBe('RESTRICTED_REGION_EXCEPTION');
        expect(error.statusCode).toBe(403);
      }
    });

    it('should throw RestrictedRegionException when user country matches by name in array', async () => {
      const locationData = {
        country: 'by',
        region: 'Minsk',
        city: 'Minsk',
        isVpn: false,
      };

      mockTransactionMonitoringAdapter.ipCheck.mockResolvedValue(locationData);

      try {
        await service.validateRegionalAccess(mockSecurityContext, undefined, ['BY', 'Belarus']);
        fail('Expected RestrictedRegionException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RestrictedRegionException);
        expect(error.message).toBe('USD transactions are restricted from BY, Belarus due to regulatory requirements.');
      }
    });

    it('should throw RestrictedRegionException when user is in restricted location array', async () => {
      const locationData = {
        country: 'US',
        region: 'Arizona',
        city: 'Phoenix',
        isVpn: false,
      };

      mockTransactionMonitoringAdapter.ipCheck.mockResolvedValue(locationData);

      try {
        await service.validateRegionalAccess(mockSecurityContext, ['Arizona', 'Delaware']);
        fail('Expected RestrictedRegionException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RestrictedRegionException);
        expect(error.message).toBe(
          'USD transactions are restricted from Arizona, Delaware due to regulatory requirements.',
        );
        expect(error.type).toBe('RESTRICTED_REGION_EXCEPTION');
        expect(error.statusCode).toBe(403);
      }
    });

    it('should throw RestrictedRegionException when user location matches by code in array', async () => {
      const locationData = {
        country: 'US',
        region: 'arizona',
        city: 'Phoenix',
        isVpn: false,
      };

      mockTransactionMonitoringAdapter.ipCheck.mockResolvedValue(locationData);

      try {
        await service.validateRegionalAccess(mockSecurityContext, ['AZ', 'Arizona', 'DE', 'Delaware']);
        fail('Expected RestrictedRegionException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RestrictedRegionException);
        expect(error.message).toBe(
          'USD transactions are restricted from AZ, Arizona, DE, Delaware due to regulatory requirements.',
        );
      }
    });

    it('should use custom message when provided', async () => {
      const locationData = {
        country: 'US',
        region: 'Arizona',
        city: 'Phoenix',
        isVpn: false,
      };

      mockTransactionMonitoringAdapter.ipCheck.mockResolvedValue(locationData);

      const customMessage =
        'Card operations are not available in your current location due to regulatory requirements.';

      try {
        await service.validateRegionalAccess(mockSecurityContext, ['Arizona'], undefined, customMessage);
        fail('Expected RestrictedRegionException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RestrictedRegionException);
        expect(error.message).toBe(customMessage);
        expect(error.type).toBe('RESTRICTED_REGION_EXCEPTION');
        expect(error.statusCode).toBe(403);
      }
    });

    it('should use custom type when provided', async () => {
      const locationData = {
        country: 'US',
        region: 'Arizona',
        city: 'Phoenix',
        isVpn: false,
      };

      mockTransactionMonitoringAdapter.ipCheck.mockResolvedValue(locationData);

      try {
        await service.validateRegionalAccess(
          mockSecurityContext,
          ['Arizona'],
          undefined,
          undefined,
          'CARD_RESTRICTED_REGION_EXCEPTION',
        );
        fail('Expected RestrictedRegionException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RestrictedRegionException);
        expect(error.type).toBe('CARD_RESTRICTED_REGION_EXCEPTION');
        expect(error.statusCode).toBe(403);
      }
    });

    it('should use default type when custom type is not provided', async () => {
      const locationData = {
        country: 'US',
        region: 'Arizona',
        city: 'Phoenix',
        isVpn: false,
      };

      mockTransactionMonitoringAdapter.ipCheck.mockResolvedValue(locationData);

      try {
        await service.validateRegionalAccess(mockSecurityContext, ['Arizona']);
        fail('Expected RestrictedRegionException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RestrictedRegionException);
        expect(error.type).toBe('RESTRICTED_REGION_EXCEPTION');
        expect(error.statusCode).toBe(403);
      }
    });

    it('should use both custom message and custom type when provided', async () => {
      const locationData = {
        country: 'US',
        region: 'Arizona',
        city: 'Phoenix',
        isVpn: false,
      };

      mockTransactionMonitoringAdapter.ipCheck.mockResolvedValue(locationData);

      const customMessage =
        'Card operations are not available in your current location due to regulatory requirements.';

      try {
        await service.validateRegionalAccess(
          mockSecurityContext,
          ['Arizona'],
          undefined,
          customMessage,
          'CARD_RESTRICTED_REGION_EXCEPTION',
        );
        fail('Expected RestrictedRegionException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RestrictedRegionException);
        expect(error.message).toBe(customMessage);
        expect(error.type).toBe('CARD_RESTRICTED_REGION_EXCEPTION');
        expect(error.statusCode).toBe(403);
      }
    });

    it('should allow operation when user country is not in restricted countries array', async () => {
      const locationData = {
        country: 'CA',
        region: 'Ontario',
        city: 'Toronto',
        isVpn: false,
      };

      mockTransactionMonitoringAdapter.ipCheck.mockResolvedValue(locationData);

      await expect(service.validateRegionalAccess(mockSecurityContext, undefined, ['BY', 'CN'])).resolves.not.toThrow();
    });

    it('should allow operation when user location is not in restricted locations array', async () => {
      const locationData = {
        country: 'US',
        region: 'California',
        city: 'Los Angeles',
        isVpn: false,
      };

      mockTransactionMonitoringAdapter.ipCheck.mockResolvedValue(locationData);

      await expect(service.validateRegionalAccess(mockSecurityContext, ['Arizona', 'Delaware'])).resolves.not.toThrow();
    });

    it('should handle empty restricted countries array', async () => {
      const locationData = {
        country: 'BY',
        region: 'Minsk',
        city: 'Minsk',
        isVpn: false,
      };

      mockTransactionMonitoringAdapter.ipCheck.mockResolvedValue(locationData);

      await expect(service.validateRegionalAccess(mockSecurityContext, undefined, [])).resolves.not.toThrow();
    });

    it('should handle empty restricted locations array by defaulting to New York', async () => {
      const locationData = {
        country: 'US',
        region: 'New York',
        city: 'New York',
        isVpn: false,
      };

      mockTransactionMonitoringAdapter.ipCheck.mockResolvedValue(locationData);

      try {
        await service.validateRegionalAccess(mockSecurityContext, []);
        fail('Expected RestrictedRegionException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RestrictedRegionException);
        expect(error.message).toBe('USD transactions are restricted from New York due to regulatory requirements.');
      }
    });
  });
});
