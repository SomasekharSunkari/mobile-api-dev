/**
 * DTO for resending OTP during high-risk login flow.
 * User identification is handled via security context (IP + device fingerprint)
 * from the existing OTP session stored in Redis.
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class ResendOtpDto {
  // No properties required - user is identified from security context
}
