import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../database/base';
import { PasswordResetModel } from '../../../database/models/passwordReset/passwordReset.model';

@Injectable()
export class ResetPasswordRepository extends BaseRepository<PasswordResetModel> {
  constructor() {
    super(PasswordResetModel);
  }
}
