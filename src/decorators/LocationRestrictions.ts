import { SetMetadata } from '@nestjs/common';

export const LOCATION_RESTRICTIONS_KEY = 'location_restrictions';

export interface LocationRestrictionsMetadata {
  restrictedCountries?: string | string[];
  restrictedLocation?: string | string[];
  customMessage?: string;
  customType?: string;
}

export const LocationRestrictions = (metadata: LocationRestrictionsMetadata) =>
  SetMetadata(LOCATION_RESTRICTIONS_KEY, metadata);
