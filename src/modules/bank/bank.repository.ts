import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database';
import { BankModel } from '../../database/models/bank';

@Injectable()
export class BankRepository extends BaseRepository<BankModel> {
  constructor() {
    super(BankModel);
  }
}
