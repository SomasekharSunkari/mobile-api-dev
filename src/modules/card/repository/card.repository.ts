import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../database/base/base.repository';
import { ICardStatus } from '../../../database/models/card/card.interface';
import { CardModel } from '../../../database/models/card/card.model';

@Injectable()
export class CardRepository extends BaseRepository<CardModel> {
  constructor() {
    super(CardModel);
  }

  async findNonCanceledCardByUserId(userId: string): Promise<CardModel | undefined> {
    return (await this.query().where({ user_id: userId }).whereNot({ status: ICardStatus.CANCELED }).first()) as
      | CardModel
      | undefined;
  }

  async findLastCanceledCardWithBalance(userId: string): Promise<CardModel | undefined> {
    return (await this.query()
      .where({ user_id: userId, status: ICardStatus.CANCELED })
      .whereNot('balance', 0)
      .orderBy('updated_at', 'desc')
      .first()) as CardModel | undefined;
  }
}
