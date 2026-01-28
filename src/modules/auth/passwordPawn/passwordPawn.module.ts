import { Module } from '@nestjs/common';
import { PasswordPawnService } from './passwordPawn.service';

@Module({
  exports: [PasswordPawnService],
  providers: [PasswordPawnService],
})
export class PasswordPawnModule {}
