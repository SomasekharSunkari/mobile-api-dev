import { HttpStatus } from '@nestjs/common';

export enum DoshPointsExceptionType {
  EVENT_NOT_FOUND = 'DOSH_POINTS_EVENT_NOT_FOUND',
  EVENT_INACTIVE = 'DOSH_POINTS_EVENT_INACTIVE',
  EVENT_NOT_STARTED = 'DOSH_POINTS_EVENT_NOT_STARTED',
  EVENT_ENDED = 'DOSH_POINTS_EVENT_ENDED',
  ALREADY_EARNED = 'DOSH_POINTS_ALREADY_EARNED',
}

export class DoshPointsException {
  public readonly type: DoshPointsExceptionType;
  public readonly statusCode: number = HttpStatus.BAD_REQUEST;
  public readonly message: string;

  constructor(type: DoshPointsExceptionType, eventCode: string) {
    this.type = type;

    switch (type) {
      case DoshPointsExceptionType.EVENT_NOT_FOUND:
        this.message = `Dosh Points event '${eventCode}' not found`;
        break;
      case DoshPointsExceptionType.EVENT_INACTIVE:
        this.message = `Dosh Points event '${eventCode}' is not active`;
        break;
      case DoshPointsExceptionType.EVENT_NOT_STARTED:
        this.message = `Dosh Points event '${eventCode}' has not started yet`;
        break;
      case DoshPointsExceptionType.EVENT_ENDED:
        this.message = `Dosh Points event '${eventCode}' has ended`;
        break;
      case DoshPointsExceptionType.ALREADY_EARNED:
        this.message = `User has already earned points for event '${eventCode}'`;
        break;
    }
  }
}
