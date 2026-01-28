import { BadRequestException, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * Custom decorator to extract idempotency key from request headers
 *
 * Purpose:
 * - Extracts the 'x-idempotency-key' header from HTTP requests
 * - Validates that the header is present and not empty
 * - Used for idempotent operations like withdrawals to prevent duplicate processing
 *
 * Usage:
 * @example
 * async withdraw(@IdempotencyKey() idempotencyKey: string, @Body() dto: WithdrawDto) {
 *   // idempotencyKey contains the value from x-idempotency-key header
 * }
 *
 * Security Benefits:
 * - Separates idempotency keys from business data in request body
 * - Follows industry standard practices (Stripe, PayPal, etc.)
 * - Validates presence of key before processing request
 * - Provides clear error message if key is missing
 *
 * Header Format:
 * - Header name: x-idempotency-key (case-insensitive)
 * - Value: Any string up to 40 characters
 * - Example: x-idempotency-key: withdrawal_abc123_1699564800
 *
 * @throws BadRequestException if idempotency key header is missing or empty
 */
export const IdempotencyKey = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request: Request = ctx.switchToHttp().getRequest();
  const idempotencyKey = request.headers['x-idempotency-key'] as string;

  // Validate that idempotency key is provided
  if (!idempotencyKey || idempotencyKey.trim() === '') {
    throw new BadRequestException(
      'Idempotency key is required. Please provide x-idempotency-key header with a unique value for this request.',
    );
  }

  // Validate max length (40 characters as per database constraint)
  if (idempotencyKey.length > 40) {
    throw new BadRequestException('Idempotency key cannot exceed 40 characters');
  }

  return idempotencyKey.trim();
});
