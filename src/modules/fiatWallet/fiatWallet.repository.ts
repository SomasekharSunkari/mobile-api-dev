import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database/base/base.repository';
import { FiatWalletModel } from '../../database/models/fiatWallet/fiatWallet.model';

@Injectable()
export class FiatWalletRepository extends BaseRepository<FiatWalletModel> {
  constructor() {
    super(FiatWalletModel);
  }
}
