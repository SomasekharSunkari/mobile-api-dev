import { SetMetadata } from '@nestjs/common';

export const THROTTLE_MESSAGE_KEY = 'throttle_message';

/**
 * Decorator to set a custom message for throttle exceptions on a specific endpoint.
 * Use this in combination with @Throttle() to customize the "Too Many Requests" message.
 *
 * @param message - The custom message to return when rate limit is exceeded
 *
 * @example
 * ```typescript
 * @Post('send-otp')
 * @Throttle({ default: ThrottleGroups.STRICT })
 * @ThrottleMessage('Please wait before requesting another verification code')
 * async sendOtp() { ... }
 * ```
 */
export const ThrottleMessage = (message: string) => SetMetadata(THROTTLE_MESSAGE_KEY, message);
