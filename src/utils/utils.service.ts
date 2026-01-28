import { Injectable, Logger } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as geoip from 'geoip-lite';
import { DateTime } from 'luxon';
import { Readable } from 'stream';

@Injectable()
export class UtilsService {
  private static readonly logger = new Logger(UtilsService.name);

  public static generateCode(length: number = 6): string {
    let code = '';
    for (let i = 0; i < length; i++) {
      code += crypto.randomInt(0, 10);
    }
    return code;
  }

  public static async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  public static async comparePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  public static isDatePassed(date: Date | string): boolean {
    date = new Date(date);
    const dateToCheck = DateTime.fromISO(date.toISOString()); // Replace with your date
    const now = DateTime.now();

    if (dateToCheck < now) {
      this.logger.log('The date has passed.');
      return true;
    } else {
      this.logger.log('The date has not passed.');
      return false;
    }
  }

  /**
   * Get country code and location info from IP address using geoip-lite.
   * @param ip - The IP address to lookup
   * @returns Object containing country code and other geo data, or null if not found
   */
  public static getGeoInfoFromIp(ip: string): geoip.Lookup | null {
    return geoip.lookup(ip);
  }

  /**
   * Convert 2-letter country code to 3-letter ISO code for external APIs like Sumsub
   * @param code - The 2-letter country code (e.g., "US", "NG")
   * @returns The 3-letter country code (e.g., "USA", "NGA")
   */
  public static convertTo3LetterCountryCode(code: string): string {
    const mapping: Record<string, string> = {
      US: 'USA',
      NG: 'NGA',
      CA: 'CAN',
      GB: 'GBR',
      DE: 'DEU',
      FR: 'FRA',
      // Add more mappings as needed
    };
    return mapping[code] || code;
  }

  /**
   * Generates a unique reference string in the format "OD-XXXXXXXXXXXXXXX".
   *
   * The numerical part consists of:
   * - A 13-digit Unix timestamp in milliseconds (Date.now()).
   * - A 4-digit random number suffix (padded with leading zeros if necessary).
   * This results in a 17-digit numerical identifier.
   *
   * @returns {string} The generated reference string, e.g., "OD-170119876543212345".
   */
  static generateTransactionReference(): string {
    const timestamp = Date.now();

    const randomSuffix = crypto.randomInt(0, 10000).toString().padStart(4, '0');

    return `OD-${timestamp}${randomSuffix}`;
  }

  static async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  static chunkedBase64Encode(buffer: Buffer, maxLength: number = 20000): string {
    this.logger.log('chunkedBase64Encode', 'UtilsService');

    const base64String = buffer.toString('base64');

    // If the base64 string is already within the limit, return it as is
    if (base64String.length <= maxLength) {
      return base64String;
    }

    // If it exceeds the limit, we need to truncate it properly
    this.logger.warn(
      `Base64 string length ${base64String.length} exceeds maxLength ${maxLength}, truncating`,
      'UtilsService',
    );

    // Truncate to the nearest multiple of 4 to maintain base64 alignment
    const truncatedLength = Math.floor(maxLength / 4) * 4;
    const truncatedString = base64String.substring(0, truncatedLength);

    // Add proper padding if needed
    const paddingNeeded = 4 - (truncatedLength % 4);
    if (paddingNeeded < 4) {
      return truncatedString + '='.repeat(paddingNeeded);
    }

    return truncatedString;
  }

  static decodeBase64String(base64String: string): Buffer {
    this.logger.log('decodeBase64String', 'UtilsService');
    return Buffer.from(base64String, 'base64');
  }

  /**
   * Generates an idempotency key for API operations.
   *
   * Creates a unique identifier using createId() and slices it to 30 characters
   * to comply with provider API limits (e.g., Fireblocks 40-char limit).
   *
   * @returns {string} A 30-character idempotency key
   * @example
   * const key = UtilsService.generateIdempotencyKey();
   * // Returns: "clm2x8k9q1p3r5t7v9w1y3a5c7e9g"
   */
  static generateIdempotencyKey(): string {
    return createId().slice(0, 20);
  }

  static generateIdempotencyKeyForTransaction(): string {
    return createId().slice(0, 40);
  }

  static convertToNegative(amount: number): number {
    return amount * -1;
  }

  static generateRandomPhoneNumber(): string {
    return `080${crypto.randomInt(0, 9000000000).toString().padStart(9, '0')}`;
  }

  static pick<T, K extends keyof T>(object: T, keys: K[]): Pick<T, K> {
    return keys.reduce(
      (acc, key) => {
        acc[key] = object[key];
        return acc;
      },
      {} as Pick<T, K>,
    );
  }
}
