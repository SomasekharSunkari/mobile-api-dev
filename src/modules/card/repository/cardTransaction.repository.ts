import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../database/base/base.repository';
import { FetchQuery, IPaginatedResponse } from '../../../database/base/base.interface';
import { CardTransactionModel } from '../../../database/models/cardTransaction/cardTransaction.model';
import {
  CardTransactionStatus,
  CardTransactionType,
} from '../../../database/models/cardTransaction/cardTransaction.interface';

@Injectable()
export class CardTransactionRepository extends BaseRepository<CardTransactionModel> {
  constructor() {
    super(CardTransactionModel);
  }

  async findPreviousSuccessfulDeposits(cardId: string, excludeTransactionId?: string): Promise<CardTransactionModel[]> {
    const query = this.query()
      .where({
        card_id: cardId,
        transaction_type: CardTransactionType.DEPOSIT,
        status: CardTransactionStatus.SUCCESSFUL,
      })
      .whereNot({ merchant_name: 'Balance Transfer' });

    if (excludeTransactionId) {
      query.whereNot({ id: excludeTransactionId });
    }

    return (await query) as CardTransactionModel[];
  }

  async findByIdWithCardLastFourDigits(id: string, userId: string): Promise<CardTransactionModel> {
    return (await this.query()
      .where({ id, user_id: userId })
      .withGraphFetched('card')
      .modifyGraph('card', (builder) => {
        builder.select('last_four_digits');
      })
      .first()) as CardTransactionModel;
  }

  async findAllWithCardLastFourDigits(
    query: Record<string, any>,
    params: FetchQuery,
  ): Promise<IPaginatedResponse<CardTransactionModel>> {
    return this.findAll(query, params, {
      graphFetch: 'card',
      graphModifier: {
        relationship: 'card',
        modifier: (builder) => {
          builder.select('last_four_digits');
        },
      },
    });
  }
}
