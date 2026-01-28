import { Module } from '@nestjs/common';
import { CountryController } from './country.controller';
import { CountryRepository } from './country.repository';
import { CountryService } from './country.service';

@Module({
  controllers: [CountryController],
  providers: [CountryRepository, CountryService],
  exports: [CountryRepository, CountryService],
})
export class CountryModule {}
