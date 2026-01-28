import { Module } from '@nestjs/common';
import { LoginEventService } from './loginEvent.service';
import { LoginEventRepository } from './loginEvent.repository';

@Module({
  providers: [LoginEventService, LoginEventRepository],
  exports: [LoginEventService, LoginEventRepository],
})
export class LoginEventModule {}
