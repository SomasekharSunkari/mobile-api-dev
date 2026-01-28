import { HttpStatus } from '@nestjs/common';

export class OtpRequiredException {
  public readonly type: string = 'OTP_REQUIRED_EXCEPTION';
  public readonly statusCode: number = HttpStatus.BAD_REQUEST;
  public readonly message: string;
  public readonly data: {
    otpMessage: string;
    requiresOtp: true;
    maskedContact: string;
  };

  constructor(otpMessage: string, maskedContact: string) {
    this.message = otpMessage;
    this.data = {
      otpMessage,
      requiresOtp: true,
      maskedContact,
    };
  }
}
