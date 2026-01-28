import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database/base/base.repository';
import { ExternalAccountModel } from '../../database/models/externalAccount/externalAccount.model';
import { UtilsService } from '../../utils/utils.service';

@Injectable()
export class ExternalAccountRepository extends BaseRepository<ExternalAccountModel> {
  constructor() {
    super(ExternalAccountModel);
  }

  public async findByUserId(user_id: string): Promise<ExternalAccountModel[]> {
    return (await this.query().modify('notDeleted').where({ user_id })) as ExternalAccountModel[];
  }

  public getPublicValues(
    externalAccount: ExternalAccountModel,
  ): Partial<Pick<ExternalAccountModel, ReturnType<typeof ExternalAccountModel.publicProperty>[number]>> {
    const externalAccountJson = externalAccount.toJSON() as Partial<ExternalAccountModel>;
    return UtilsService.pick(externalAccountJson, ExternalAccountModel.publicProperty());
  }
}
