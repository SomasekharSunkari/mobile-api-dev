import { Inject, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { WaasAdapter } from '../../adapters/waas/waas.adapter';
import { IBank } from '../../database/models/bank';
import { CountryRepository } from '../country/country.repository';
import { BankRepository } from './bank.repository';
import { BankQueryDto } from './dtos/bankQuery.dto';
import { VerifyBankAccountDto } from './dtos/verifyBankAccount.dto';

@Injectable()
export class BankService {
  @Inject(BankRepository)
  private readonly bankRepository: BankRepository;

  @Inject(WaasAdapter)
  private readonly waasAdapter: WaasAdapter;

  @Inject(CountryRepository)
  private readonly countryRepository: CountryRepository;

  private readonly logger: Logger = new Logger(BankService.name);

  async findAll(query: BankQueryDto): Promise<IBank[]> {
    try {
      this.logger.log('Fetching all banks');

      // get the country id from the country code
      const country = await this.countryRepository.findOne({ code: query.countryCode?.toUpperCase() });

      if (!country) {
        throw new NotFoundException('Country not found');
      }

      const banks = await this.waasAdapter.getBankList({
        country: country.code?.toUpperCase(),
      });

      if (banks) {
        banks.sort((a, b) => a.bankName.localeCompare(b.bankName));
      }

      return banks.map((bank) => ({
        id: bank.bankRef,
        name: bank.bankName,
        code: bank.nibssBankCode,
        country_id: country.id,
        logo: '',
        status: 'active',
        short_name: bank.bankName,
      }));
    } catch (error) {
      this.logger.error('Error fetching banks', error);
      throw new InternalServerErrorException(error.message);
    }
  }

  async verifyBankAccount(payload: VerifyBankAccountDto) {
    try {
      const country = await this.countryRepository.findOne({ code: payload.country_code?.toUpperCase() });

      if (!country) {
        throw new NotFoundException('Country not found');
      }

      if (country.code?.toUpperCase() === 'NG') {
        const response = await this.waasAdapter.verifyBankAccount({
          accountNumber: payload.account_number,
          amount: '1',
          bankRef: payload.bank_ref,
        });

        return response;
      }

      throw new NotFoundException('Country not supported');
    } catch (error) {
      this.logger.error(error.message, 'BankService.verifyBankAccount');
      this.logger.log(error.message, 'BankService.verifyBankAccount');
      throw new InternalServerErrorException('Account Number is invalid');
    }
  }
}
