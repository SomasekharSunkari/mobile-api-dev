import { BadRequestException, Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { add, divide, max, multiply, subtract } from 'mathjs';
import { ExchangeAdapter } from '../../adapters/exchange/exchange.adapter';
import { GetExchangeRatesResponse } from '../../adapters/exchange/exchange.interface';
import { CurrencyUtility, SUPPORTED_CURRENCIES } from '../../currencies';
import { RateTransactionType } from '../../database';
import { PlatformServiceKey } from '../../database/models/platformStatus/platformStatus.interface';
import { EventEmitterEventsEnum } from '../../services/eventEmitter/eventEmitter.interface';
import { EventEmitterService } from '../../services/eventEmitter/eventEmitter.service';
import { RateConfigRepository } from '../rateConfig/rateConfig.repository';
import { RateRepository } from './rate.repository';

@Injectable()
export class RateService {
  private readonly logger = new Logger(RateService.name);

  @Inject(ExchangeAdapter)
  private readonly exchangeAdapter: ExchangeAdapter;

  @Inject(RateRepository)
  private readonly rateRepository: RateRepository;

  @Inject(EventEmitterService)
  private readonly eventEmitterService: EventEmitterService;

  @Inject(RateConfigRepository)
  private readonly rateConfigRepository: RateConfigRepository;

  async getRate(currencyCode: string, _amount: number, type?: RateTransactionType) {
    const rateConfig = await this.rateConfigRepository.findOne({
      provider: this.exchangeAdapter.getProviderName(),
    });

    if (!rateConfig?.isActive) {
      this.logger.error(`Failed to get rate config for provider ${this.exchangeAdapter.getProviderName()}`);

      this.eventEmitterService.emit(EventEmitterEventsEnum.SERVICE_STATUS_FAILURE, {
        serviceKey: PlatformServiceKey.RATE_GENERATION,
        reason: `Failed to get active rate config for provider: ${this.exchangeAdapter.getProviderName()}`,
      });

      throw new BadRequestException('Failed to get rate with this, try again later');
    }

    const rateType = type ?? RateTransactionType.BUY;

    let exchangeRates: GetExchangeRatesResponse[];
    try {
      exchangeRates = await this.exchangeAdapter.getExchangeRates({ currencyCode });
    } catch (error) {
      this.logger.error(`Failed to get exchange rates: ${error.message}`);

      this.eventEmitterService.emit(EventEmitterEventsEnum.SERVICE_STATUS_FAILURE, {
        serviceKey: PlatformServiceKey.RATE_GENERATION,
        reason: error.message,
      });

      throw error;
    }

    const providerRate = exchangeRates.find((rate) => rate.code === currencyCode);

    if (!providerRate) {
      throw new BadRequestException('No exchange rate found for currency');
    }

    const buyRate = CurrencyUtility.formatCurrencyAmountToSmallestUnit(providerRate.buy, currencyCode);

    const sellRate = CurrencyUtility.formatCurrencyAmountToSmallestUnit(providerRate.sell, currencyCode);

    const providerRateAmount = rateType?.toLowerCase() === RateTransactionType.BUY ? sellRate : buyRate;

    const buyingCurrencyCode =
      rateType?.toLowerCase() === RateTransactionType.BUY ? currencyCode : SUPPORTED_CURRENCIES.USD.code;

    const sellingCurrencyCode =
      rateType?.toLowerCase() === RateTransactionType.SELL ? currencyCode : SUPPORTED_CURRENCIES.USD.code;

    // Adjust rate by markup percentage: add markup percentage when converting NGN to USD (SELL),
    // subtract markup percentage when converting USD to NGN (BUY)
    const providerRateInMainUnit = CurrencyUtility.formatCurrencyAmountToMainUnit(providerRateAmount, currencyCode);

    // Convert the adjusted rate back to smallest unit for storage
    const rateInSmallestUnit = CurrencyUtility.formatCurrencyAmountToSmallestUnit(providerRateInMainUnit, currencyCode);

    // check if the rate is already in the database
    let exchangeRate = await this.rateRepository.findOne({
      buying_currency_code: buyingCurrencyCode,
      selling_currency_code: sellingCurrencyCode,
      provider: this.exchangeAdapter.getProviderName(),
      provider_rate: rateType?.toLowerCase() === RateTransactionType.BUY ? sellRate : buyRate,
      rate: rateInSmallestUnit,
    });

    if (!exchangeRate) {
      // first time we are getting the rate, so we need to create a new record
      exchangeRate = await this.rateRepository.create({
        provider: this.exchangeAdapter.getProviderName(),
        buying_currency_code: buyingCurrencyCode,
        selling_currency_code: sellingCurrencyCode,
        provider_rate: rateType?.toLowerCase() === RateTransactionType.BUY ? sellRate : buyRate,
        provider_rate_ref: providerRate.rateRef,
        rate: rateInSmallestUnit,
      });
    }

    this.eventEmitterService.emit(EventEmitterEventsEnum.SERVICE_STATUS_SUCCESS, {
      serviceKey: PlatformServiceKey.RATE_GENERATION,
    });

    // Store values before deleting properties
    const incrementedRate = exchangeRate.rate; // rate with partner added
    const providerRateValue = exchangeRate.provider_rate; // no partner added to the rate

    delete exchangeRate.provider_rate;
    delete exchangeRate.provider_rate_ref;
    delete exchangeRate.expires_at;
    delete exchangeRate.created_at;
    delete exchangeRate.updated_at;
    delete exchangeRate.deleted_at;

    const fiatExchange = rateConfig.fiatExchange;

    return {
      ...exchangeRate,
      // Rate config data
      provider: rateConfig.provider,
      config: rateConfig.config,
      description: rateConfig.description,
      // Flattened fee values for backward compatibility
      service_fee: fiatExchange?.service_fee?.value ?? 0,
      service_fee_currency: fiatExchange?.service_fee?.currency ?? null,
      is_service_fee_percentage: fiatExchange?.service_fee?.is_percentage ?? false,
      partner_fee: fiatExchange?.partner_fee?.value ?? 0,
      partner_fee_currency: fiatExchange?.partner_fee?.currency ?? null,
      is_partner_fee_percentage: fiatExchange?.partner_fee?.is_percentage ?? false,
      disbursement_fee: fiatExchange?.disbursement_fee?.value ?? 0,
      disbursement_fee_currency: fiatExchange?.disbursement_fee?.currency ?? null,
      is_disbursement_fee_percentage: fiatExchange?.disbursement_fee?.is_percentage ?? false,
      ngn_withdrawal_fee: fiatExchange?.ngn_withdrawal_fee?.value ?? 0,
      is_ngn_withdrawal_fee_percentage: fiatExchange?.ngn_withdrawal_fee?.is_percentage ?? false,
      ngn_withdrawal_fee_cap: fiatExchange?.ngn_withdrawal_fee?.cap ?? 0,
      is_active: rateConfig.isActive,
      incrementedRate,
      rate: providerRateValue,
    };
  }

  /**
   * Calculates the effective USD to NGN exchange rate after accounting for provider fees.
   *
   * This method computes the final exchange rate by:
   * 1. Deducting USD fees (network + withdrawal) from the original amount
   * 2. Converting the net amount to NGN using the provider rate
   * 3. Calculating the effective rate that gives the best value to the user
   *
   * @param amount - The original USD amount the user wants to convert (provided by user)
   * @param ngnProviderRate - The current USD to NGN exchange rate from Yellowcard provider
   * @param usdProviderNetworkFee - The network fee in USD charged by ZeroHash
   * @param usdProviderWithdrawalFee - The withdrawal fee in USD charged by ZeroHash
   * @returns The final effective exchange rate (USD to NGN) after all fees
   */
  getRateInNGN(
    amount: number,
    ngnProviderRate: number,
    usdProviderNetworkFee: number,
    usdProviderWithdrawalFee: number,
  ) {
    // Calculate total USD fees by combining network and withdrawal fees from ZeroHash
    const usdFee = add(usdProviderNetworkFee, usdProviderWithdrawalFee);

    // Subtract USD fees from the original amount to get the net amount for conversion
    const convertedAmount = subtract(amount, usdFee);

    // Calculate NGN amount by multiplying net USD amount with the NGN exchange rate
    const ngnAmount = multiply(convertedAmount, ngnProviderRate);

    // Calculate NGN amount with fees deducted (same calculation as above)
    const ngnAmountWithFee = multiply(subtract(amount, usdFee), ngnProviderRate);

    // Take the maximum of both NGN amounts to ensure best value for user
    const finalNgnAmount = max(ngnAmount, ngnAmountWithFee);

    // Calculate first rate: final NGN amount divided by original USD amount
    const firstRate = divide(finalNgnAmount, amount);

    // Calculate second rate: (1 - fee percentage) * NGN provider rate
    // This gives the effective rate after accounting for fee percentage
    const secondRate = multiply(subtract(1, divide(usdFee, amount)), ngnProviderRate);

    // Return the better of the two calculated rates
    const finalRate = max(firstRate, secondRate);

    return finalRate;
  }

  async validateRateOrThrow(rateId: string, amount: number, type?: RateTransactionType) {
    this.logger.debug(`Validating rate ${rateId} for amount ${amount} and type ${type}`);
    const rate = await this.rateRepository.findOne({
      id: rateId,
    });

    if (!rate) {
      this.logger.error(`Rate not found for rate id ${rateId}`);
      throw new BadRequestException('Rate not found');
    }

    if (rate.rate <= 0) {
      this.logger.error(`Invalid exchange rate for rate id ${rateId}`);
      throw new BadRequestException('Invalid exchange rate');
    }

    if (!rate.provider) {
      this.logger.error(`Exchange rate provider is missing for rate id ${rateId}`);
      throw new InternalServerErrorException('Exchange rate provider is missing');
    }

    const currencyCode = type === RateTransactionType.BUY ? rate.buying_currency_code : rate.selling_currency_code;
    const providerRate = await this.getRate(currencyCode, amount, type);

    if (providerRate.rate !== rate.rate) {
      this.logger.error(`Exchange rate mismatch for rate id ${rateId}`);
      throw new BadRequestException('Exchange rate mismatch');
    }

    return rate;
  }
}
