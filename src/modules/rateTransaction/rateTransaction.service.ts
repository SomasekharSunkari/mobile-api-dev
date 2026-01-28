import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { divide, multiply } from 'mathjs';
import { Transaction } from 'objection';
import { ExchangeAdapter } from '../../adapters/exchange/exchange.adapter';
import { GetExchangeRatesResponse } from '../../adapters/exchange/exchange.interface';
import { CurrencyUtility, SUPPORTED_CURRENCIES } from '../../currencies';
import { IPaginatedResponse } from '../../database';
import {
  RateTransactionModel,
  RateTransactionStatus,
  RateTransactionType,
} from '../../database/models/rateTransaction';
import { LockerService } from '../../services/locker';
import { CreateRateTransactionDto, UpdateRateTransactionDto } from './dto';
import { RateTransactionRepository } from './rateTransaction.repository';

@Injectable()
export class RateTransactionService {
  @Inject(RateTransactionRepository)
  private readonly rateTransactionRepository: RateTransactionRepository;

  @Inject(LockerService)
  private readonly lockerService: LockerService;

  @Inject(ExchangeAdapter)
  private readonly exchangeAdapter: ExchangeAdapter;

  async create(userId: string, data: CreateRateTransactionDto, trx?: Transaction): Promise<RateTransactionModel> {
    const exchangeRate = await this.getExchangeRate(data.currency);

    const convertedAmount = this.convertAmountBasedOnTransactionType(data.type, data.amount, exchangeRate);

    const rateTransaction = await this.rateTransactionRepository.create(
      {
        converted_amount: CurrencyUtility.formatCurrencyAmountToSmallestUnit(convertedAmount, data.currency),
        amount: CurrencyUtility.formatCurrencyAmountToSmallestUnit(data.amount, data.currency),
        type: data.type,
        status: RateTransactionStatus.PENDING,
        provider: this.exchangeAdapter.getProviderName(),
        base_currency: SUPPORTED_CURRENCIES.USD.code,
        converted_currency: data.currency,
        user_id: userId,
        transaction_id: data.transaction_id,
        rate: data.type === RateTransactionType.BUY ? exchangeRate.buy : exchangeRate.sell,
      },
      trx,
    );

    return rateTransaction;
  }

  private convertAmountBasedOnTransactionType(
    type: RateTransactionType,
    amount: number,
    exchangeRate: GetExchangeRatesResponse,
  ) {
    if (type === RateTransactionType.BUY) {
      const result = divide(amount, exchangeRate.buy);
      return Number(result.toFixed(2));
    }
    const result = multiply(amount, exchangeRate.sell);
    return Number(result.toFixed(2));
  }

  private async getExchangeRate(currency: string) {
    const exchangeRates = await this.exchangeAdapter.getExchangeRates({ currencyCode: currency });

    const exchangeRate = exchangeRates.find((rate) => rate.code === currency);

    if (!exchangeRate) {
      throw new NotFoundException(`Exchange rate for currency ${currency} not found`);
    }

    return exchangeRate;
  }

  async findOne(filters: Partial<RateTransactionModel>): Promise<RateTransactionModel | null> {
    const rateTransaction = await this.rateTransactionRepository.findOne(filters);
    return rateTransaction;
  }

  async findAll(
    page = 1,
    limit = 10,
    filters: Partial<{
      user_id: string;
      transaction_id: string;
      type: RateTransactionType;
      status: RateTransactionStatus;
      base_currency: string;
      converted_currency: string;
    }> = {},
  ): Promise<IPaginatedResponse<RateTransactionModel>> {
    const query: Record<string, any> = {};

    if (filters.user_id) {
      query.user_id = filters.user_id;
    }

    if (filters.transaction_id) {
      query.transaction_id = filters.transaction_id;
    }

    if (filters.type) {
      query.type = filters.type;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.base_currency) {
      query.base_currency = filters.base_currency;
    }

    if (filters.converted_currency) {
      query.converted_currency = filters.converted_currency;
    }

    return this.rateTransactionRepository.findAll(query, { page, limit });
  }

  async findById(id: string): Promise<RateTransactionModel> {
    const rateTransaction = await this.rateTransactionRepository.findById(id);

    if (!rateTransaction) {
      throw new NotFoundException(`Rate transaction with ID ${id} not found`);
    }

    return rateTransaction as RateTransactionModel;
  }

  async update(id: string, data: UpdateRateTransactionDto): Promise<RateTransactionModel> {
    const rateTransaction = await this.rateTransactionRepository.update(id, data);
    return rateTransaction;
  }

  async updateStatus(
    id: string,
    status: RateTransactionStatus,
    metadata?: {
      failure_reason?: string;
    },
  ): Promise<RateTransactionModel> {
    // Use the locker service to ensure only one process can update this transaction at a time
    const lockKey = `rate-transaction:${id}:update-status`;

    // Lock will automatically be released when the callback completes or throws an error
    return await this.lockerService.withLock(lockKey, async () => {
      const updateData: Partial<RateTransactionModel> = { status };

      if (status === RateTransactionStatus.PROCESSING) {
        updateData.processed_at = DateTime.now().toSQL();
      } else if (status === RateTransactionStatus.COMPLETED) {
        updateData.completed_at = DateTime.now().toSQL();
      } else if (status === RateTransactionStatus.FAILED) {
        updateData.failed_at = DateTime.now().toSQL();
        if (metadata?.failure_reason) {
          updateData.failure_reason = metadata.failure_reason;
        }
      }

      return await this.rateTransactionRepository.update(id, updateData);
    });
  }
}
