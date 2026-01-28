import { HttpStatus } from '@nestjs/common';

export class RestrictedRegionException {
  public readonly type: string;
  public readonly statusCode: number = HttpStatus.FORBIDDEN;
  public readonly message: string;
  constructor(restrictedLocation: string, customMessage?: string, customType?: string) {
    this.type = customType || 'RESTRICTED_REGION_EXCEPTION';
    this.message =
      customMessage || `USD transactions are restricted from ${restrictedLocation} due to regulatory requirements.`;
  }
}
