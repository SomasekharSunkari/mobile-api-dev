import { Module } from '@nestjs/common';
import { RoleModule } from '../role/role.module';
import { UserModule } from '../user/user.module';
import { UserRoleModule } from '../userRole/user_role.module';
import { AccountVerificationController } from './accountVerification.controller';
import { AccountVerificationRepository } from './accountVerification.repository';
import { AccountVerificationService } from './accountVerification.service';

@Module({
  imports: [UserModule, UserRoleModule, RoleModule],
  controllers: [AccountVerificationController],
  providers: [AccountVerificationRepository, AccountVerificationService],
  exports: [AccountVerificationRepository, AccountVerificationService],
})
export class AccountVerificationModule {}
