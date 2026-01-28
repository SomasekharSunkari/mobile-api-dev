import { HttpStatus } from '@nestjs/common';
import { RestrictedRegionException } from './restricted_region_exception';

describe('RestrictedRegionException', () => {
  it('should create exception with default type and default message', () => {
    const exception = new RestrictedRegionException('New York');

    expect(exception.type).toBe('RESTRICTED_REGION_EXCEPTION');
    expect(exception.statusCode).toBe(HttpStatus.FORBIDDEN);
    expect(exception.message).toBe('USD transactions are restricted from New York due to regulatory requirements.');
  });

  it('should create exception with default type and custom message', () => {
    const customMessage = 'Card operations are not available in your current location due to regulatory requirements.';
    const exception = new RestrictedRegionException('New York', customMessage);

    expect(exception.type).toBe('RESTRICTED_REGION_EXCEPTION');
    expect(exception.statusCode).toBe(HttpStatus.FORBIDDEN);
    expect(exception.message).toBe(customMessage);
  });

  it('should create exception with custom type and default message', () => {
    const exception = new RestrictedRegionException('New York', undefined, 'CARD_RESTRICTED_REGION_EXCEPTION');

    expect(exception.type).toBe('CARD_RESTRICTED_REGION_EXCEPTION');
    expect(exception.statusCode).toBe(HttpStatus.FORBIDDEN);
    expect(exception.message).toBe('USD transactions are restricted from New York due to regulatory requirements.');
  });

  it('should create exception with custom type and custom message', () => {
    const customMessage = 'Card operations are not available in your current location due to regulatory requirements.';
    const exception = new RestrictedRegionException('New York', customMessage, 'CARD_RESTRICTED_REGION_EXCEPTION');

    expect(exception.type).toBe('CARD_RESTRICTED_REGION_EXCEPTION');
    expect(exception.statusCode).toBe(HttpStatus.FORBIDDEN);
    expect(exception.message).toBe(customMessage);
  });

  it('should use default type when custom type is not provided', () => {
    const exception = new RestrictedRegionException('Arizona');

    expect(exception.type).toBe('RESTRICTED_REGION_EXCEPTION');
    expect(exception.statusCode).toBe(HttpStatus.FORBIDDEN);
  });
});
