import { Injectable } from '@nestjs/common';
import { CountryModel } from '../../database';
import { BaseRepository } from '../../database/base';

@Injectable()
export class CountryRepository extends BaseRepository<CountryModel> {
  constructor() {
    super(CountryModel);
  }

  public async findById(id: string): Promise<CountryModel | undefined> {
    const result = await this.query().findById(id);
    return result as CountryModel;
  }
}
