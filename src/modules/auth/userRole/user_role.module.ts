import { Module } from '@nestjs/common';
import { UserRoleRepository } from './user_role.repository';

@Module({
  imports: [],
  providers: [UserRoleRepository],
  exports: [UserRoleRepository],
})
export class UserRoleModule {}
