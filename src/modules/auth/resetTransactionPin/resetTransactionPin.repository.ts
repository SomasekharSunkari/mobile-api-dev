import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../database';
import { ResetTransactionPinModel } from '../../../database/models/resetTransactionPin/resetTransactionPin.model';

@Injectable()
export class ResetTransactionPinRepository extends BaseRepository<ResetTransactionPinModel> {
  public constructor() {
    super(ResetTransactionPinModel);
  }
}
