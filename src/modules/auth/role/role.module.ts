import { Module } from '@nestjs/common';
import { RoleRepository } from './role.repository';

@Module({
  imports: [],
  providers: [RoleRepository],
  exports: [RoleRepository],
})
export class RoleModule {}
