import { Injectable } from '@nestjs/common';
import { VirtualAccountModel } from '../../database/models/virtualAccount';
import { BaseRepository } from '../../database';

@Injectable()
export class VirtualAccountRepository extends BaseRepository<VirtualAccountModel> {
  constructor() {
    super(VirtualAccountModel);
  }
}
