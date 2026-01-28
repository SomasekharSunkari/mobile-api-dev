import { Module } from '@nestjs/common';
import { UserRepository } from '../../auth/user/user.repository';
import { SystemUsersBeneficiaryController } from './systemUsersBeneficiary.controller';
import { SystemUsersBeneficiaryRepository } from './systemUsersBeneficiary.repository';
import { SystemUsersBeneficiaryService } from './systemUsersBeneficiary.service';

@Module({
  controllers: [SystemUsersBeneficiaryController],
  providers: [SystemUsersBeneficiaryRepository, SystemUsersBeneficiaryService, UserRepository],
  exports: [SystemUsersBeneficiaryRepository, SystemUsersBeneficiaryService],
})
export class SystemUsersBeneficiaryModule {}
