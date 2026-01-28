import { HttpStatus } from '@nestjs/common';
import { CurrencyUtility } from '../currencies/currencies';

export enum LimitExceededExceptionType {
  DAILY_LIMIT_EXCEEDED_EXCEPTION = 'DAILY_LIMIT_EXCEEDED_EXCEPTION',
  WEEKLY_LIMIT_EXCEEDED_EXCEPTION = 'WEEKLY_LIMIT_EXCEEDED_EXCEPTION',
  MONTHLY_LIMIT_EXCEEDED_EXCEPTION = 'MONTHLY_LIMIT_EXCEEDED_EXCEPTION',
  TRANSACTION_LIMIT_EXCEEDED_EXCEPTION = 'TRANSACTION_LIMIT_EXCEEDED_EXCEPTION',
  PENDING_LIMIT_EXCEEDED_EXCEPTION = 'PENDING_LIMIT_EXCEEDED_EXCEPTION',
  WEEKLY_COUNT_LIMIT_EXCEEDED_EXCEPTION = 'WEEKLY_COUNT_LIMIT_EXCEEDED_EXCEPTION',
  PLATFORM_WEEKLY_LIMIT_EXCEEDED_EXCEPTION = 'PLATFORM_WEEKLY_LIMIT_EXCEEDED_EXCEPTION',
  LIMIT_EXCEEDED_EXCEPTION = 'LIMIT_EXCEEDED_EXCEPTION',
}

export class LimitExceededException {
  public readonly type: LimitExceededExceptionType;
  public readonly statusCode: number = HttpStatus.BAD_REQUEST;
  public readonly message: string;

  constructor(
    limitType: string,
    currentValue: number,
    limitValue: number,
    currency: string,
    exceptionType: LimitExceededExceptionType,
  ) {
    this.type = exceptionType;

    // Format limitType to replace underscores with spaces
    const formattedLimitType = limitType.replace(/_/g, ' ');

    // For count-based limit exceptions, we don't need currency formatting
    // as we're dealing with counts, not monetary amounts
    if (exceptionType === LimitExceededExceptionType.PENDING_LIMIT_EXCEEDED_EXCEPTION) {
      this.message = `You've reached your pending ${formattedLimitType} limit of ${limitValue}. Please wait for your existing transactions to complete.`;
      return;
    }

    if (exceptionType === LimitExceededExceptionType.WEEKLY_COUNT_LIMIT_EXCEEDED_EXCEPTION) {
      this.message = `You've reached your weekly ${formattedLimitType} limit of ${limitValue} transactions. Please try again later.`;
      return;
    }

    if (exceptionType === LimitExceededExceptionType.PLATFORM_WEEKLY_LIMIT_EXCEEDED_EXCEPTION) {
      this.message = 'Something went wrong. Please try again later.';
      return;
    }

    // Format amounts using CurrencyUtility for monetary exceptions
    const formattedCurrentAmount = CurrencyUtility.formatCurrencyAmountToMainUnit(currentValue, currency);
    const formattedLimitAmount = CurrencyUtility.formatCurrencyAmountToMainUnit(limitValue, currency);

    // Format amounts with commas
    const formattedCurrentAmountString = CurrencyUtility.formatCurrencyAmountToLocaleString(
      formattedCurrentAmount,
      currency,
    );
    const formattedLimitAmountString = CurrencyUtility.formatCurrencyAmountToLocaleString(
      formattedLimitAmount,
      currency,
    );

    // Generate message based on exception type
    switch (exceptionType) {
      case LimitExceededExceptionType.DAILY_LIMIT_EXCEEDED_EXCEPTION:
        this.message = `You've exceeded your daily ${formattedLimitType} limit of ${formattedLimitAmountString}. Current daily total: ${formattedCurrentAmountString}.`;
        break;
      case LimitExceededExceptionType.WEEKLY_LIMIT_EXCEEDED_EXCEPTION:
        this.message = `You've exceeded your weekly ${formattedLimitType} limit of ${formattedLimitAmountString}. Current weekly total: ${formattedCurrentAmountString}.`;
        break;
      case LimitExceededExceptionType.MONTHLY_LIMIT_EXCEEDED_EXCEPTION:
        this.message = `You've exceeded your monthly ${formattedLimitType} limit of ${formattedLimitAmountString}. Current monthly total: ${formattedCurrentAmountString}.`;
        break;
      case LimitExceededExceptionType.TRANSACTION_LIMIT_EXCEEDED_EXCEPTION:
        this.message = `The amount entered exceeds your transaction limit of ${formattedLimitAmountString}. Please enter a lower amount or upgrade your account to continue.`;
        break;
      default:
        this.message = `The amount entered exceeds your ${formattedLimitType} limit of ${formattedLimitAmountString}. Please enter a lower amount or upgrade your account to continue.`;
    }
  }
}
