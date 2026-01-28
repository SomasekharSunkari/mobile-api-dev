import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitterEventsEnum } from './eventEmitter.interface';
import { EventEmitterService } from './eventEmitter.service';

describe('EventEmitterService', () => {
  let service: EventEmitterService;
  let mockEventEmitter2: jest.Mocked<EventEmitter2>;

  const mockEventEmitter2Instance = {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    removeAllListeners: jest.fn(),
    listenerCount: jest.fn(),
    listeners: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventEmitterService,
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter2Instance,
        },
      ],
    }).compile();

    service = module.get<EventEmitterService>(EventEmitterService);
    mockEventEmitter2 = module.get<EventEmitter2>(EventEmitter2) as jest.Mocked<EventEmitter2>;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('service instantiation', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should extend EventEmitter2', () => {
      expect(service).toBeInstanceOf(EventEmitter2);
    });

    it('should have eventEmitter injected', () => {
      expect(service['eventEmitter']).toBeDefined();
      expect(service['eventEmitter']).toBe(mockEventEmitter2);
    });
  });

  describe('emit method', () => {
    let loggerSpy: jest.SpyInstance;

    beforeEach(() => {
      loggerSpy = jest.spyOn(service['logger'], 'log').mockImplementation();
    });

    afterEach(() => {
      loggerSpy.mockRestore();
    });

    it('should emit REQUIRE_PASSWORD_RESET event with user ID', () => {
      const userId = 'test-user-123';
      // Mock the parent class emit method
      const superEmitSpy = jest.spyOn(EventEmitter2.prototype, 'emit').mockReturnValue(true);
      const listenerCountSpy = jest.spyOn(service, 'listenerCount').mockReturnValue(0);

      const result = service.emit(EventEmitterEventsEnum.REQUIRE_PASSWORD_RESET, userId);

      expect(superEmitSpy).toHaveBeenCalledWith(EventEmitterEventsEnum.REQUIRE_PASSWORD_RESET, userId);
      expect(loggerSpy).toHaveBeenCalledWith(
        `Emitting event=${EventEmitterEventsEnum.REQUIRE_PASSWORD_RESET} with values=${userId}`,
      );
      expect(result).toBe(true);

      superEmitSpy.mockRestore();
      listenerCountSpy.mockRestore();
    });

    it('should emit FORGOT_PASSWORD event with user data', () => {
      const userData = { email: 'test@example.com', userId: 'user-456' };
      const superEmitSpy = jest.spyOn(EventEmitter2.prototype, 'emit').mockReturnValue(true);
      const listenerCountSpy = jest.spyOn(service, 'listenerCount').mockReturnValue(0);

      const result = service.emit(EventEmitterEventsEnum.FORGOT_PASSWORD, userData);

      expect(superEmitSpy).toHaveBeenCalledWith(EventEmitterEventsEnum.FORGOT_PASSWORD, userData);
      expect(loggerSpy).toHaveBeenCalledWith(
        `Emitting event=${EventEmitterEventsEnum.FORGOT_PASSWORD} with values=${userData}`,
      );
      expect(result).toBe(true);

      superEmitSpy.mockRestore();
      listenerCountSpy.mockRestore();
    });

    it('should emit event with multiple values', () => {
      const value1 = 'first-value';
      const value2 = { data: 'object-value' };
      const value3 = 123;
      const superEmitSpy = jest.spyOn(EventEmitter2.prototype, 'emit').mockReturnValue(true);
      const listenerCountSpy = jest.spyOn(service, 'listenerCount').mockReturnValue(0);

      const result = service.emit(EventEmitterEventsEnum.REQUIRE_PASSWORD_RESET, value1, value2, value3);

      expect(superEmitSpy).toHaveBeenCalledWith(EventEmitterEventsEnum.REQUIRE_PASSWORD_RESET, value1, value2, value3);
      expect(loggerSpy).toHaveBeenCalledWith(
        `Emitting event=${EventEmitterEventsEnum.REQUIRE_PASSWORD_RESET} with values=${value1},${value2},${value3}`,
      );
      expect(result).toBe(true);

      superEmitSpy.mockRestore();
      listenerCountSpy.mockRestore();
    });

    it('should emit event with no values', () => {
      const superEmitSpy = jest.spyOn(EventEmitter2.prototype, 'emit').mockReturnValue(true);
      const listenerCountSpy = jest.spyOn(service, 'listenerCount').mockReturnValue(0);

      const result = service.emit(EventEmitterEventsEnum.FORGOT_PASSWORD);

      expect(superEmitSpy).toHaveBeenCalledWith(EventEmitterEventsEnum.FORGOT_PASSWORD);
      expect(loggerSpy).toHaveBeenCalledWith(`Emitting event=${EventEmitterEventsEnum.FORGOT_PASSWORD} with values=`);
      expect(result).toBe(true);

      superEmitSpy.mockRestore();
      listenerCountSpy.mockRestore();
    });

    it('should return false when emit fails', () => {
      const userId = 'test-user-123';
      const superEmitSpy = jest.spyOn(EventEmitter2.prototype, 'emit').mockReturnValue(false);
      const listenerCountSpy = jest.spyOn(service, 'listenerCount').mockReturnValue(0);

      const result = service.emit(EventEmitterEventsEnum.REQUIRE_PASSWORD_RESET, userId);

      expect(superEmitSpy).toHaveBeenCalledWith(EventEmitterEventsEnum.REQUIRE_PASSWORD_RESET, userId);
      expect(loggerSpy).toHaveBeenCalledWith(
        `Emitting event=${EventEmitterEventsEnum.REQUIRE_PASSWORD_RESET} with values=${userId}`,
      );
      expect(result).toBe(false);

      superEmitSpy.mockRestore();
      listenerCountSpy.mockRestore();
    });

    it('should handle undefined and null values', () => {
      const undefinedValue = undefined;
      const nullValue = null;
      const superEmitSpy = jest.spyOn(EventEmitter2.prototype, 'emit').mockReturnValue(true);
      const listenerCountSpy = jest.spyOn(service, 'listenerCount').mockReturnValue(0);

      const result = service.emit(EventEmitterEventsEnum.FORGOT_PASSWORD, undefinedValue, nullValue);

      expect(superEmitSpy).toHaveBeenCalledWith(EventEmitterEventsEnum.FORGOT_PASSWORD, undefinedValue, nullValue);
      expect(loggerSpy).toHaveBeenCalledWith(`Emitting event=${EventEmitterEventsEnum.FORGOT_PASSWORD} with values=,`);
      expect(result).toBe(true);

      superEmitSpy.mockRestore();
      listenerCountSpy.mockRestore();
    });

    it('should handle complex object values', () => {
      const complexObject = {
        user: { id: 'user-123', email: 'test@example.com' },
        metadata: { timestamp: new Date(), source: 'api' },
        nested: { deep: { value: 'test' } },
      };
      const superEmitSpy = jest.spyOn(EventEmitter2.prototype, 'emit').mockReturnValue(true);
      const listenerCountSpy = jest.spyOn(service, 'listenerCount').mockReturnValue(0);

      const result = service.emit(EventEmitterEventsEnum.REQUIRE_PASSWORD_RESET, complexObject);

      expect(superEmitSpy).toHaveBeenCalledWith(EventEmitterEventsEnum.REQUIRE_PASSWORD_RESET, complexObject);
      expect(loggerSpy).toHaveBeenCalledWith(
        `Emitting event=${EventEmitterEventsEnum.REQUIRE_PASSWORD_RESET} with values=${complexObject}`,
      );
      expect(result).toBe(true);

      superEmitSpy.mockRestore();
      listenerCountSpy.mockRestore();
    });
  });

  describe('logger logging', () => {
    let loggerSpy: jest.SpyInstance;

    beforeEach(() => {
      loggerSpy = jest.spyOn(service['logger'], 'log').mockImplementation();
      jest.spyOn(EventEmitter2.prototype, 'emit').mockReturnValue(true);
      jest.spyOn(service, 'listenerCount').mockReturnValue(0);
    });

    afterEach(() => {
      loggerSpy.mockRestore();
      jest.restoreAllMocks();
    });

    it('should always log when emitting events', () => {
      service.emit(EventEmitterEventsEnum.REQUIRE_PASSWORD_RESET, 'user-123');

      expect(loggerSpy).toHaveBeenCalledTimes(2);
      expect(loggerSpy).toHaveBeenNthCalledWith(
        1,
        `Emitting event=${EventEmitterEventsEnum.REQUIRE_PASSWORD_RESET} with values=user-123`,
      );
      expect(loggerSpy).toHaveBeenNthCalledWith(2, `Event emit result=true listeners count=0`);
    });

    it('should log correct event name and values format', () => {
      const testValues = ['value1', { key: 'value2' }, 123];
      service.emit(EventEmitterEventsEnum.FORGOT_PASSWORD, ...testValues);

      expect(loggerSpy).toHaveBeenCalledWith(
        `Emitting event=${EventEmitterEventsEnum.FORGOT_PASSWORD} with values=${testValues}`,
      );
    });
  });

  describe('method delegation', () => {
    it('should delegate emit call to parent EventEmitter2 instance', () => {
      const event = EventEmitterEventsEnum.REQUIRE_PASSWORD_RESET;
      const values = ['test-value'];
      const superEmitSpy = jest.spyOn(EventEmitter2.prototype, 'emit').mockReturnValue(true);

      service.emit(event, ...values);

      expect(superEmitSpy).toHaveBeenCalledTimes(1);
      expect(superEmitSpy).toHaveBeenCalledWith(event, ...values);

      superEmitSpy.mockRestore();
    });

    it('should preserve return value from delegated emit call', () => {
      const superEmitSpy = jest.spyOn(EventEmitter2.prototype, 'emit').mockReturnValue(false);

      const result = service.emit(EventEmitterEventsEnum.FORGOT_PASSWORD);

      expect(result).toBe(false);

      superEmitSpy.mockRestore();
    });
  });

  describe('emitAsync method', () => {
    let loggerSpy: jest.SpyInstance;

    beforeEach(() => {
      loggerSpy = jest.spyOn(service['logger'], 'log').mockImplementation();
    });

    afterEach(() => {
      loggerSpy.mockRestore();
    });

    it('should emit REQUIRE_PASSWORD_RESET event asynchronously with user ID', async () => {
      const userId = 'test-user-123';
      const superEmitAsyncSpy = jest.spyOn(EventEmitter2.prototype, 'emitAsync').mockResolvedValue([]);
      const listenerCountSpy = jest.spyOn(service, 'listenerCount').mockReturnValue(0);

      const result = await service.emitAsync(EventEmitterEventsEnum.REQUIRE_PASSWORD_RESET, userId);

      expect(superEmitAsyncSpy).toHaveBeenCalledWith(EventEmitterEventsEnum.REQUIRE_PASSWORD_RESET, userId);
      expect(loggerSpy).toHaveBeenCalledWith(
        `Emitting async event=${EventEmitterEventsEnum.REQUIRE_PASSWORD_RESET} with values=${userId}`,
      );
      expect(result).toEqual([]);

      superEmitAsyncSpy.mockRestore();
      listenerCountSpy.mockRestore();
    });

    it('should emit FORGOT_PASSWORD event asynchronously with user data', async () => {
      const userData = { email: 'test@example.com', userId: 'user-456' };
      const superEmitAsyncSpy = jest.spyOn(EventEmitter2.prototype, 'emitAsync').mockResolvedValue([]);
      const listenerCountSpy = jest.spyOn(service, 'listenerCount').mockReturnValue(0);

      const result = await service.emitAsync(EventEmitterEventsEnum.FORGOT_PASSWORD, userData);

      expect(superEmitAsyncSpy).toHaveBeenCalledWith(EventEmitterEventsEnum.FORGOT_PASSWORD, userData);
      expect(loggerSpy).toHaveBeenCalledWith(
        `Emitting async event=${EventEmitterEventsEnum.FORGOT_PASSWORD} with values=${userData}`,
      );
      expect(result).toEqual([]);

      superEmitAsyncSpy.mockRestore();
      listenerCountSpy.mockRestore();
    });

    it('should emit event asynchronously with multiple values', async () => {
      const value1 = 'first-value';
      const value2 = { data: 'object-value' };
      const value3 = 123;
      const superEmitAsyncSpy = jest.spyOn(EventEmitter2.prototype, 'emitAsync').mockResolvedValue([]);
      const listenerCountSpy = jest.spyOn(service, 'listenerCount').mockReturnValue(0);

      const result = await service.emitAsync(EventEmitterEventsEnum.REQUIRE_PASSWORD_RESET, value1, value2, value3);

      expect(superEmitAsyncSpy).toHaveBeenCalledWith(
        EventEmitterEventsEnum.REQUIRE_PASSWORD_RESET,
        value1,
        value2,
        value3,
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        `Emitting async event=${EventEmitterEventsEnum.REQUIRE_PASSWORD_RESET} with values=${value1},${value2},${value3}`,
      );
      expect(result).toEqual([]);

      superEmitAsyncSpy.mockRestore();
      listenerCountSpy.mockRestore();
    });

    it('should emit event asynchronously with no values', async () => {
      const superEmitAsyncSpy = jest.spyOn(EventEmitter2.prototype, 'emitAsync').mockResolvedValue([]);
      const listenerCountSpy = jest.spyOn(service, 'listenerCount').mockReturnValue(0);

      const result = await service.emitAsync(EventEmitterEventsEnum.FORGOT_PASSWORD);

      expect(superEmitAsyncSpy).toHaveBeenCalledWith(EventEmitterEventsEnum.FORGOT_PASSWORD);
      expect(loggerSpy).toHaveBeenCalledWith(
        `Emitting async event=${EventEmitterEventsEnum.FORGOT_PASSWORD} with values=`,
      );
      expect(result).toEqual([]);

      superEmitAsyncSpy.mockRestore();
      listenerCountSpy.mockRestore();
    });

    it('should handle undefined and null values asynchronously', async () => {
      const undefinedValue = undefined;
      const nullValue = null;
      const superEmitAsyncSpy = jest.spyOn(EventEmitter2.prototype, 'emitAsync').mockResolvedValue([]);
      const listenerCountSpy = jest.spyOn(service, 'listenerCount').mockReturnValue(0);

      const result = await service.emitAsync(EventEmitterEventsEnum.FORGOT_PASSWORD, undefinedValue, nullValue);

      expect(superEmitAsyncSpy).toHaveBeenCalledWith(EventEmitterEventsEnum.FORGOT_PASSWORD, undefinedValue, nullValue);
      expect(loggerSpy).toHaveBeenCalledWith(
        `Emitting async event=${EventEmitterEventsEnum.FORGOT_PASSWORD} with values=,`,
      );
      expect(result).toEqual([]);

      superEmitAsyncSpy.mockRestore();
      listenerCountSpy.mockRestore();
    });

    it('should handle complex object values asynchronously', async () => {
      const complexObject = {
        user: { id: 'user-123', email: 'test@example.com' },
        metadata: { timestamp: new Date(), source: 'api' },
        nested: { deep: { value: 'test' } },
      };
      const superEmitAsyncSpy = jest.spyOn(EventEmitter2.prototype, 'emitAsync').mockResolvedValue([]);
      const listenerCountSpy = jest.spyOn(service, 'listenerCount').mockReturnValue(0);

      const result = await service.emitAsync(EventEmitterEventsEnum.REQUIRE_PASSWORD_RESET, complexObject);

      expect(superEmitAsyncSpy).toHaveBeenCalledWith(EventEmitterEventsEnum.REQUIRE_PASSWORD_RESET, complexObject);
      expect(loggerSpy).toHaveBeenCalledWith(
        `Emitting async event=${EventEmitterEventsEnum.REQUIRE_PASSWORD_RESET} with values=${complexObject}`,
      );
      expect(result).toEqual([]);

      superEmitAsyncSpy.mockRestore();
      listenerCountSpy.mockRestore();
    });

    it('should return results from async listeners', async () => {
      const mockResults = ['result1', 'result2', 'result3'];
      const superEmitAsyncSpy = jest.spyOn(EventEmitter2.prototype, 'emitAsync').mockResolvedValue(mockResults);
      const listenerCountSpy = jest.spyOn(service, 'listenerCount').mockReturnValue(3);

      const result = await service.emitAsync(EventEmitterEventsEnum.REQUIRE_PASSWORD_RESET, 'user-123');

      expect(result).toEqual(mockResults);
      expect(loggerSpy).toHaveBeenCalledWith(`Event emitAsync result=${mockResults} listeners count=3`);

      superEmitAsyncSpy.mockRestore();
      listenerCountSpy.mockRestore();
    });
  });

  describe('emitAsync logger logging', () => {
    let loggerSpy: jest.SpyInstance;

    beforeEach(() => {
      loggerSpy = jest.spyOn(service['logger'], 'log').mockImplementation();
      jest.spyOn(EventEmitter2.prototype, 'emitAsync').mockResolvedValue([]);
      jest.spyOn(service, 'listenerCount').mockReturnValue(0);
    });

    afterEach(() => {
      loggerSpy.mockRestore();
      jest.restoreAllMocks();
    });

    it('should always log when emitting events asynchronously', async () => {
      await service.emitAsync(EventEmitterEventsEnum.REQUIRE_PASSWORD_RESET, 'user-123');

      expect(loggerSpy).toHaveBeenCalledTimes(2);
      expect(loggerSpy).toHaveBeenNthCalledWith(
        1,
        `Emitting async event=${EventEmitterEventsEnum.REQUIRE_PASSWORD_RESET} with values=user-123`,
      );
      expect(loggerSpy).toHaveBeenNthCalledWith(2, `Event emitAsync result= listeners count=0`);
    });

    it('should log correct event name and values format for async', async () => {
      const testValues = ['value1', { key: 'value2' }, 123];
      await service.emitAsync(EventEmitterEventsEnum.FORGOT_PASSWORD, ...testValues);

      expect(loggerSpy).toHaveBeenCalledWith(
        `Emitting async event=${EventEmitterEventsEnum.FORGOT_PASSWORD} with values=${testValues}`,
      );
    });
  });

  describe('emitAsync method delegation', () => {
    it('should delegate emitAsync call to parent EventEmitter2 instance', async () => {
      const event = EventEmitterEventsEnum.REQUIRE_PASSWORD_RESET;
      const values = ['test-value'];
      const superEmitAsyncSpy = jest.spyOn(EventEmitter2.prototype, 'emitAsync').mockResolvedValue([]);

      await service.emitAsync(event, ...values);

      expect(superEmitAsyncSpy).toHaveBeenCalledTimes(1);
      expect(superEmitAsyncSpy).toHaveBeenCalledWith(event, ...values);

      superEmitAsyncSpy.mockRestore();
    });

    it('should preserve return value from delegated emitAsync call', async () => {
      const mockResults = ['listener1-result', 'listener2-result'];
      const superEmitAsyncSpy = jest.spyOn(EventEmitter2.prototype, 'emitAsync').mockResolvedValue(mockResults);

      const result = await service.emitAsync(EventEmitterEventsEnum.FORGOT_PASSWORD);

      expect(result).toEqual(mockResults);

      superEmitAsyncSpy.mockRestore();
    });
  });
});
