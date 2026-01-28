import { Global, Module } from '@nestjs/common';
import { EventEmitterModule as NestEventEmitterModule } from '@nestjs/event-emitter';
import { EventEmitterService } from './eventEmitter.service';

@Global()
@Module({
  imports: [NestEventEmitterModule.forRoot({})],
  providers: [EventEmitterService],
  exports: [EventEmitterService],
})
export class EventEmitterModule {}
