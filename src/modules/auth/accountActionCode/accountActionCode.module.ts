import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { AccountActionCodeController } from './accountActionCode.controller';
import { AccountActionCodeRepository } from './accountActionCode.repository';
import { AccountActionCodeService } from './accountActionCode.service';

@Module({
  controllers: [AccountActionCodeController],
  providers: [AccountActionCodeService, AccountActionCodeRepository],
  exports: [AccountActionCodeService],
  imports: [UserModule],
})
export class AccountActionCodeModule {}
