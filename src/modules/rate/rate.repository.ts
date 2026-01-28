import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database';
import { ExchangeRateModel } from '../../database/models/exchangeRate';

@Injectable()
export class RateRepository extends BaseRepository<ExchangeRateModel> {
  constructor() {
    super(ExchangeRateModel);
  }
}
