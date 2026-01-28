import { HttpStatus } from '@nestjs/common';

export class ServiceUnavailableException {
  public readonly type: string = 'SERVICE_UNAVAILABLE_EXCEPTION';
  public readonly statusCode: number = HttpStatus.SERVICE_UNAVAILABLE;
  public readonly message: string;
  constructor(message?: string) {
    this.message = message || 'Service unavailable. Please try again later.';
  }
}
