import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerException, ThrottlerGuard } from '@nestjs/throttler';
import { THROTTLE_MESSAGE_KEY } from '../../decorators/throttle-message.decorator';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected reflector: Reflector;

  /**
   * Throws a throttling exception with a custom message if one is set via @ThrottleMessage decorator.
   * Falls back to the default message if no custom message is provided.
   */
  protected throwThrottlingException(context: ExecutionContext): Promise<void> {
    const customMessage = this.reflector.getAllAndOverride<string>(THROTTLE_MESSAGE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    throw new ThrottlerException(customMessage);
  }
}
