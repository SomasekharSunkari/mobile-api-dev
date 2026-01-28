import { DateTime } from 'luxon';
import { DoshPointsTransactionType } from '../../../database/models/doshPointsEvent/doshPointsEvent.interface';
import { DoshPointsEventModel } from '../../../database/models/doshPointsEvent/doshPointsEvent.model';
import { DoshPointsException, DoshPointsExceptionType } from '../../../exceptions/dosh_points_exception';
import { DoshPointsEventService } from './doshPointsEvent.service';

describe('DoshPointsEventService', () => {
  let service: DoshPointsEventService;

  const mockEventRepository = {
    findOne: jest.fn(),
  };

  const mockEvent: DoshPointsEventModel = {
    id: 'event-123',
    code: 'ONBOARDING_BONUS',
    name: 'Onboarding Bonus',
    description: 'Points for completing onboarding',
    transaction_type: DoshPointsTransactionType.CREDIT,
    default_points: 10,
    is_active: true,
    is_one_time_per_user: true,
    start_date: null,
    end_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as DoshPointsEventModel;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new DoshPointsEventService();
    (service as any).eventRepository = mockEventRepository;
    (service as any).logger = { log: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() };
  });

  describe('findByCode', () => {
    it('should return event when found and valid', async () => {
      mockEventRepository.findOne.mockResolvedValue(mockEvent);

      const result = await service.findByCode('ONBOARDING_BONUS');

      expect(result).toBe(mockEvent);
      expect(mockEventRepository.findOne).toHaveBeenCalledWith({ code: 'ONBOARDING_BONUS' });
    });

    it('should throw EVENT_NOT_FOUND when event does not exist', async () => {
      mockEventRepository.findOne.mockResolvedValue(null);

      try {
        await service.findByCode('INVALID_CODE');
        fail('Expected exception to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(DoshPointsException);
        expect(error.type).toBe(DoshPointsExceptionType.EVENT_NOT_FOUND);
        expect(error.message).toBe("Dosh Points event 'INVALID_CODE' not found");
      }
    });

    it('should throw EVENT_INACTIVE when event is not active', async () => {
      const inactiveEvent = { ...mockEvent, is_active: false };
      mockEventRepository.findOne.mockResolvedValue(inactiveEvent);

      try {
        await service.findByCode('ONBOARDING_BONUS');
        fail('Expected exception to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(DoshPointsException);
        expect(error.type).toBe(DoshPointsExceptionType.EVENT_INACTIVE);
        expect(error.message).toBe("Dosh Points event 'ONBOARDING_BONUS' is not active");
      }
    });

    it('should throw EVENT_NOT_STARTED when event has not started yet', async () => {
      const futureStart = DateTime.now().plus({ days: 1 }).toJSDate();
      const futureEvent = { ...mockEvent, start_date: futureStart };
      mockEventRepository.findOne.mockResolvedValue(futureEvent);

      try {
        await service.findByCode('ONBOARDING_BONUS');
        fail('Expected exception to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(DoshPointsException);
        expect(error.type).toBe(DoshPointsExceptionType.EVENT_NOT_STARTED);
        expect(error.message).toBe("Dosh Points event 'ONBOARDING_BONUS' has not started yet");
      }
    });

    it('should throw EVENT_ENDED when event has ended', async () => {
      const pastEnd = DateTime.now().minus({ days: 1 }).toJSDate();
      const endedEvent = { ...mockEvent, end_date: pastEnd };
      mockEventRepository.findOne.mockResolvedValue(endedEvent);

      try {
        await service.findByCode('ONBOARDING_BONUS');
        fail('Expected exception to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(DoshPointsException);
        expect(error.type).toBe(DoshPointsExceptionType.EVENT_ENDED);
        expect(error.message).toBe("Dosh Points event 'ONBOARDING_BONUS' has ended");
      }
    });

    it('should return event when within valid date range', async () => {
      const pastStart = DateTime.now().minus({ days: 1 }).toJSDate();
      const futureEnd = DateTime.now().plus({ days: 1 }).toJSDate();
      const validEvent = { ...mockEvent, start_date: pastStart, end_date: futureEnd };
      mockEventRepository.findOne.mockResolvedValue(validEvent);

      const result = await service.findByCode('ONBOARDING_BONUS');

      expect(result).toBe(validEvent);
    });

    it('should return event when start_date is null (no start restriction)', async () => {
      const futureEnd = DateTime.now().plus({ days: 1 }).toJSDate();
      const noStartEvent = { ...mockEvent, start_date: null, end_date: futureEnd };
      mockEventRepository.findOne.mockResolvedValue(noStartEvent);

      const result = await service.findByCode('ONBOARDING_BONUS');

      expect(result).toBe(noStartEvent);
    });

    it('should return event when end_date is null (no end restriction)', async () => {
      const pastStart = DateTime.now().minus({ days: 1 }).toJSDate();
      const noEndEvent = { ...mockEvent, start_date: pastStart, end_date: null };
      mockEventRepository.findOne.mockResolvedValue(noEndEvent);

      const result = await service.findByCode('ONBOARDING_BONUS');

      expect(result).toBe(noEndEvent);
    });
  });
});
