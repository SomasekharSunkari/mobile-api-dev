import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { EventEmitterEventsEnum } from './eventEmitter.interface';

@Injectable()
export class EventEmitterService extends EventEmitter2 {
  @Inject(EventEmitter2)
  private readonly eventEmitter: EventEmitter2;
  private readonly logger: Logger = new Logger(EventEmitterService.name);

  constructor() {
    super();
  }

  emit(event: EventEmitterEventsEnum, ...values: any[]): boolean {
    this.logger.log(`Emitting event=${event} with values=${values}`);
    const result = super.emit(event, ...values);
    this.logger.log(`Event emit result=${result} listeners count=${this.listenerCount(event)}`);
    return result;
  }

  async emitAsync(event: EventEmitterEventsEnum, ...values: any[]): Promise<any[]> {
    this.logger.log(`Emitting async event=${event} with values=${values}`);
    const result = await super.emitAsync(event, ...values);
    this.logger.log(`Event emitAsync result=${result} listeners count=${this.listenerCount(event)}`);
    return result;
  }
}
