import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../database';
import { VerificationTokenModel } from '../../../database/models/verificationToken/verificationToken.model';

@Injectable()
export class VerificationTokenRepository extends BaseRepository<VerificationTokenModel> {
  constructor() {
    super(VerificationTokenModel);
  }
}
