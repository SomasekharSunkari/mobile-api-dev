import { Inject, Injectable, Logger } from '@nestjs/common';
import { DateTime } from 'luxon';
import { DoshPointsEventModel } from '../../../database/models/doshPointsEvent/doshPointsEvent.model';
import { DoshPointsException, DoshPointsExceptionType } from '../../../exceptions/dosh_points_exception';
import { DoshPointsEventRepository } from './doshPointsEvent.repository';

@Injectable()
export class DoshPointsEventService {
  private readonly logger = new Logger(DoshPointsEventService.name);

  @Inject(DoshPointsEventRepository)
  private readonly eventRepository: DoshPointsEventRepository;

  /**
   * Find event by code and validate it
   * Checks that event exists, is active, and within date range
   * @param code - The event code (e.g., 'ONBOARDING_BONUS')
   * @returns The validated event
   * @throws DoshPointsException if event is invalid
   */
  public async findByCode(code: string): Promise<DoshPointsEventModel> {
    const event = await this.eventRepository.findOne({ code });

    if (!event) {
      throw new DoshPointsException(DoshPointsExceptionType.EVENT_NOT_FOUND, code);
    }

    if (!event.is_active) {
      throw new DoshPointsException(DoshPointsExceptionType.EVENT_INACTIVE, code);
    }

    const now = DateTime.now();

    if (event.start_date && DateTime.fromJSDate(new Date(event.start_date)) > now) {
      throw new DoshPointsException(DoshPointsExceptionType.EVENT_NOT_STARTED, code);
    }

    if (event.end_date && DateTime.fromJSDate(new Date(event.end_date)) < now) {
      throw new DoshPointsException(DoshPointsExceptionType.EVENT_ENDED, code);
    }

    return event;
  }
}
