import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CountryModel } from '../../database/models/country/country.model'; // <-- import CountryModel
import { CountryRepository } from './country.repository';

@Injectable()
export class CountryService {
  @Inject(CountryRepository)
  private readonly countryRepository: CountryRepository;

  /**
   * Validate a country exists and is supported.
   * If invalid, throws NotFoundException.
   * Otherwise, returns the CountryModel.
   */
  async validateCountryExists(country_id: string): Promise<CountryModel> {
    const country = await this.countryRepository.findById(country_id);

    if (!country) {
      throw new NotFoundException('Country not found');
    }

    if (!country.is_supported) {
      throw new NotFoundException('Country not supported');
    }

    return country;
  }

  public async findAll() {
    return this.countryRepository.findAll(undefined, { limit: 300, orderBy: 'created_at', order: 'asc' });
  }
}
