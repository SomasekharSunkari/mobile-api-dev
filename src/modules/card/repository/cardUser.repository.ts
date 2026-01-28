import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../database/base/base.repository';
import { CardUserModel } from '../../../database/models/cardUser/cardUser.model';

@Injectable()
export class CardUserRepository extends BaseRepository<CardUserModel> {
  constructor() {
    super(CardUserModel);
  }
}
