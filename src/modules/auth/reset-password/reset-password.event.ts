import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitterEventsEnum } from '../../../services/eventEmitter/eventEmitter.interface';
import { ResetPasswordService } from './reset-password.service';

@Injectable()
export class ResetPasswordEvent {
  @Inject(ResetPasswordService)
  private readonly resetPasswordService: ResetPasswordService;

  private logger = new Logger(ResetPasswordEvent.name);

  @OnEvent(EventEmitterEventsEnum.REQUIRE_PASSWORD_RESET)
  async handleRequirePasswordReset(userId: string) {
    this.logger.log('Require password reset for userId=', userId);
    this.logger.log(`Handling require password reset for userId=${userId}`);

    // lock the user account
    await this.resetPasswordService.requirePasswordReset(userId);
  }
}
