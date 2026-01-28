import { Inject, Injectable, Logger } from '@nestjs/common';
import { TransactionMonitoringAdapter } from '../../../adapters/transaction-monitoring/transaction-monitoring-adapter';
import { SecurityContext } from '../../../decorators/http/http_context.interface';
import { RestrictedRegionException } from '../../../exceptions/restricted_region_exception';

@Injectable()
export class LocationRestrictionService {
  private readonly logger = new Logger(LocationRestrictionService.name);

  @Inject(TransactionMonitoringAdapter)
  private readonly transactionMonitoringAdapter: TransactionMonitoringAdapter;

  /**
   * Validates regional access restrictions without requiring an applicantId
   * Used by guards that need to check location before user authentication
   * Throws ForbiddenException if the IP address is located in a restricted region
   */
  async validateRegionalAccess(
    securityContext: SecurityContext,
    restrictedLocation?: string | string[],
    restrictedCountries?: string | string[],
    customMessage?: string,
    customType?: string,
  ): Promise<void> {
    try {
      const locationData = await this.transactionMonitoringAdapter.ipCheck({
        ipAddress: securityContext.clientIp,
        userId: 'regional_access_check',
      });

      if (!locationData) {
        this.logger.warn(`Could not determine location for IP ${securityContext.clientIp}, allowing access`);
        return;
      }

      const userCountry = locationData.country?.toLowerCase();
      const userRegion = locationData.region?.toLowerCase();

      if (restrictedCountries) {
        const restrictedCountriesArray = Array.isArray(restrictedCountries)
          ? restrictedCountries
          : [restrictedCountries];
        if (restrictedCountriesArray.length > 0 && this.isRestrictedCountry(userCountry, restrictedCountriesArray)) {
          this.throwRestrictedException(
            restrictedCountriesArray.join(', '),
            securityContext,
            locationData,
            customMessage,
            customType,
          );
        }
      }

      const restrictedLocationArray = this.getRestrictedLocationArray(restrictedLocation);
      if (
        restrictedLocationArray.length > 0 &&
        this.isRestrictedLocation(userCountry, userRegion, restrictedLocationArray)
      ) {
        this.throwRestrictedException(
          restrictedLocationArray.join(', '),
          securityContext,
          locationData,
          customMessage,
          customType,
        );
      }
    } catch (error) {
      if (error instanceof RestrictedRegionException) {
        throw error;
      }
      this.logger.error(`Error checking regional access for IP ${securityContext.clientIp}: ${error.message}`);
    }
  }

  private isRestrictedCountry(userCountry: string, restrictedCountries: string[]): boolean {
    return restrictedCountries.some((country) => {
      const countryLower = country.toLowerCase();
      return countryLower === userCountry;
    });
  }

  private isRestrictedLocation(userCountry: string, userRegion: string, restrictedLocations: string[]): boolean {
    if (userCountry !== 'us') {
      return false;
    }
    return restrictedLocations.some((location) => {
      const locationLower = location.toLowerCase();
      return userRegion === locationLower;
    });
  }

  private getRestrictedLocationArray(restrictedLocation?: string | string[]): string[] {
    if (!restrictedLocation) {
      return ['New York'];
    }
    const array = Array.isArray(restrictedLocation) ? restrictedLocation : [restrictedLocation];
    return array.length > 0 ? array : ['New York'];
  }

  private throwRestrictedException(
    restrictedPlaces: string,
    securityContext: SecurityContext,
    locationData: any,
    customMessage?: string,
    customType?: string,
  ): void {
    this.logger.warn(`USD operation blocked from ${restrictedPlaces} IP: ${securityContext.clientIp}`, {
      ipAddress: securityContext.clientIp,
      location: locationData,
    });
    throw new RestrictedRegionException(restrictedPlaces, customMessage, customType);
  }
}
