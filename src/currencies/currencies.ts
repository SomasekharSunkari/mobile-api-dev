/**
 * ISO 4217 Currency Implementation
 *
 * ISO 4217 is an international standard established by the International Organization for
 * Standardization (ISO) that defines alpha and numeric codes for currencies.
 *
 * The standard uses:
 * - Three-letter alphabetic codes (e.g., USD, NGN)
 * - Three-digit numeric codes (e.g., 840 for USD, 566 for NGN)
 *
 * The first two letters of the alphabetic code typically represent the ISO 3166-1 alpha-2
 * country code (e.g., "US" for United States, "NG" for Nigeria) and the third letter usually
 * represents the first letter of the currency name (e.g., "D" for Dollar, "N" for Naira).
 *
 * The ISO 4217 standard also specifies the minor unit (decimal places) for each currency.
 * This is essential for financial calculations and displaying currency values correctly.
 *
 * References:
 * - https://en.wikipedia.org/wiki/ISO_4217
 * - https://www.iso.org/iso-4217-currency-codes.html
 */

import { floor } from 'mathjs';

/**
 * Currency interface based on ISO 4217 standard
 */
export interface Currency {
  code: string; // Three-letter alphabetic code (e.g., USD, NGN)
  numericCode: string; // Three-digit numeric code (e.g., 840, 566)
  name: string; // Full currency name
  symbol: string; // Currency symbol (e.g., $, ₦)
  minorUnit: number; // Number of digits after decimal point
  country: string; // Country or region where the currency is used
  countryCode: string; // Two-letter ISO 3166-1 alpha-2 country code (e.g., US, NG)
  displayName: string; // Display name for notifications (e.g., USDC for USD)
  walletName: string; // Wallet name for notifications (e.g., US Wallet for USD)
}

/**
 * Supported currencies in the system according to ISO 4217 standard
 */
export const SUPPORTED_CURRENCIES: Record<string, Currency> = {
  USD: {
    code: 'USD',
    numericCode: '840',
    name: 'US Dollar',
    symbol: '$',
    minorUnit: 100,
    country: 'United States',
    countryCode: 'US',
    displayName: 'USDC',
    walletName: 'US Wallet',
  },
  NGN: {
    code: 'NGN',
    numericCode: '566',
    name: 'Nigerian Naira',
    symbol: '₦',
    minorUnit: 100,
    country: 'Nigeria',
    countryCode: 'NG',
    displayName: 'NGN',
    walletName: 'NGN Wallet',
  },
};

/**
 * List of supported currency codes for easy access
 */
export const SUPPORTED_CURRENCY_CODES = Object.keys(SUPPORTED_CURRENCIES);

export enum CurrencyCode {
  USD = 'USD',
  NGN = 'NGN',
}

/**
 *
 * Utility class for currency operations
 *
 */
export class CurrencyUtility {
  /**
   * Checks if a currency code is supported by the system
   *
   * @param currencyCode The three-letter ISO 4217 currency code to check
   * @returns Boolean indicating whether the currency is supported
   */
  public static isSupportedCurrency(currencyCode: string): boolean {
    if (!currencyCode) return false;

    const normalizedCode = currencyCode.toUpperCase().trim();
    return SUPPORTED_CURRENCY_CODES.includes(normalizedCode);
  }

  /**
   * Gets currency details if supported
   *
   * @param currencyCode The three-letter ISO 4217 currency code
   * @returns The currency details or undefined if not supported
   */
  public static getCurrency(currencyCode: string): Currency | undefined {
    if (!this.isSupportedCurrency(currencyCode)) return undefined;

    const normalizedCode = currencyCode.toUpperCase().trim();
    return SUPPORTED_CURRENCIES[normalizedCode];
  }

  /**
   * Gets the country code for a given currency
   *
   * @param currencyCode The three-letter ISO 4217 currency code
   * @returns The two-letter ISO 3166-1 alpha-2 country code or undefined if not supported
   */
  public static getCurrencyCountryCode(currencyCode: string): string | undefined {
    const currency = this.getCurrency(currencyCode);
    return currency?.countryCode;
  }

  /**
   * Formats an amount according to the currency's specifications
   *
   * @param amount The amount to format in the smallest unit (e.g., cents for USD, kobo for NGN)
   * @param currencyCode The three-letter ISO 4217 currency code
   * @param locale The locale to use for formatting (defaults to en-US)
   * @returns Formatted amount with currency symbol or code, or null if currency not supported
   */
  public static formatCurrencyAmountToMainUnit(
    amount: number,
    currencyCode: string,
    // locale: string = 'en-US',
  ): number {
    const currency = this.getCurrency(currencyCode);

    if (!currency) return null;

    // Convert from smallest unit (cents/kobo) to main unit (dollars/naira)
    const mainUnitAmount = amount / currency.minorUnit;

    return Number(mainUnitAmount ?? 0);
  }

  /**
   * Formats an amount according to the currency's specifications
   *
   * @param amount The amount to format in the smallest unit (e.g., cents for USD, kobo for NGN)
   * @param currencyCode The three-letter ISO 4217 currency code
   * @param locale The locale to use for formatting (defaults to en-US)
   * @returns Formatted amount with currency symbol or code, or null if currency not supported
   */
  public static formatCurrencyAmountToSmallestUnit(
    amount: number,
    currencyCode: string,
    // locale: string = 'en-US',
  ): number {
    const currency = this.getCurrency(currencyCode);

    // convert the amount to the smallest unit;
    const smallestUnitAmount = floor(amount * currency.minorUnit);

    return Number(smallestUnitAmount ?? 0);
  }

  public static getCurrencyLocale(currencyCode: string): string {
    if (currencyCode.toUpperCase() === 'USD') return 'en-US';
    if (currencyCode.toUpperCase() === 'NGN') return 'en-NG';
    return 'en-US';
  }

  public static formatCurrencyAmountToLocaleString(amount: number, currencyCode: string): string {
    const locale = CurrencyUtility.getCurrencyLocale(currencyCode);
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
    }).format(amount);
  }
}
