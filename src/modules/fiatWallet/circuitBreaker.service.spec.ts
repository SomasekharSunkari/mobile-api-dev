import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitterEventsEnum } from '../../services/eventEmitter/eventEmitter.interface';
import { EventEmitterService } from '../../services/eventEmitter/eventEmitter.service';
import { RedisService } from '../../services/redis/redis.service';
import { CircuitBreakerService } from './circuitBreaker.service';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;
  let redisService: jest.Mocked<RedisService>;
  let eventEmitterService: jest.Mocked<EventEmitterService>;

  const mockRedisClient = {
    zadd: jest.fn(),
    zremrangebyscore: jest.fn(),
    zcount: jest.fn(),
    incr: jest.fn(),
  };

  beforeEach(async () => {
    const mockRedisService = {
      getClient: jest.fn().mockReturnValue(mockRedisClient),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      expire: jest.fn(),
    };

    const mockEventEmitterService = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CircuitBreakerService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: EventEmitterService,
          useValue: mockEventEmitterService,
        },
      ],
    }).compile();

    service = module.get<CircuitBreakerService>(CircuitBreakerService);
    redisService = module.get(RedisService);
    eventEmitterService = module.get(EventEmitterService);

    jest.clearAllMocks();
  });

  describe('recordAttempt', () => {
    it('should record a successful attempt', async () => {
      const provider = 'ninepayment';
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      mockRedisClient.zadd.mockResolvedValue(1);
      mockRedisClient.zremrangebyscore.mockResolvedValue(0);
      mockRedisClient.zcount.mockResolvedValue(0);
      redisService.expire.mockResolvedValue(1);
      redisService.get.mockResolvedValue('CLOSED');

      await service.recordAttempt(provider, true);

      expect(mockRedisClient.zadd).toHaveBeenCalledWith(`circuit-breaker:${provider}:successes`, now, `${now}`);
      expect(mockRedisClient.zremrangebyscore).toHaveBeenCalledWith(
        `circuit-breaker:${provider}:successes`,
        '-inf',
        now - 900000,
      );
      expect(redisService.expire).toHaveBeenCalledWith(`circuit-breaker:${provider}:successes`, 900);

      jest.restoreAllMocks();
    });

    it('should record a failed attempt', async () => {
      const provider = 'ninepayment';
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      mockRedisClient.zadd.mockResolvedValue(1);
      mockRedisClient.zremrangebyscore.mockResolvedValue(0);
      mockRedisClient.zcount.mockResolvedValue(0);
      redisService.expire.mockResolvedValue(1);
      redisService.get.mockResolvedValue('CLOSED');

      await service.recordAttempt(provider, false);

      expect(mockRedisClient.zadd).toHaveBeenCalledWith(`circuit-breaker:${provider}:failures`, now, `${now}`);
      expect(mockRedisClient.zremrangebyscore).toHaveBeenCalledWith(
        `circuit-breaker:${provider}:failures`,
        '-inf',
        now - 900000,
      );
      expect(redisService.expire).toHaveBeenCalledWith(`circuit-breaker:${provider}:failures`, 900);

      jest.restoreAllMocks();
    });

    it('should trigger state change when failure threshold is exceeded', async () => {
      const provider = 'ninepayment';
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      mockRedisClient.zadd.mockResolvedValue(1);
      mockRedisClient.zremrangebyscore.mockResolvedValue(0);
      mockRedisClient.zcount.mockResolvedValueOnce(6).mockResolvedValueOnce(4);
      redisService.expire.mockResolvedValue(1);
      redisService.get.mockResolvedValue('CLOSED');
      redisService.set.mockResolvedValue('OK');

      await service.recordAttempt(provider, false);

      expect(redisService.set).toHaveBeenCalledWith(`circuit-breaker:${provider}:state`, 'OPEN', 1800);
      expect(redisService.set).toHaveBeenCalledWith(`circuit-breaker:${provider}:opened-at`, now.toString(), 360);
      expect(eventEmitterService.emit).toHaveBeenCalledWith(EventEmitterEventsEnum.CIRCUIT_BREAKER_OPENED, {
        provider,
        failureRate: 0.6,
        failures: 6,
        total: 10,
        timestamp: expect.any(String),
      });

      jest.restoreAllMocks();
    });

    it('should close circuit from HALF_OPEN when failure rate improves', async () => {
      const provider = 'ninepayment';
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      mockRedisClient.zadd.mockResolvedValue(1);
      mockRedisClient.zremrangebyscore.mockResolvedValue(0);
      mockRedisClient.zcount.mockResolvedValueOnce(2).mockResolvedValueOnce(8);
      redisService.expire.mockResolvedValue(1);
      redisService.get.mockResolvedValue('HALF_OPEN');
      redisService.set.mockResolvedValue('OK');
      redisService.del.mockResolvedValue(1);

      await service.recordAttempt(provider, true);

      expect(redisService.set).toHaveBeenCalledWith(`circuit-breaker:${provider}:state`, 'CLOSED', 1800);
      expect(redisService.del).toHaveBeenCalledWith(`circuit-breaker:${provider}:opened-at`);
      expect(redisService.del).toHaveBeenCalledWith(`circuit-breaker:${provider}:half-open-attempts`);
      expect(eventEmitterService.emit).toHaveBeenCalledWith(EventEmitterEventsEnum.CIRCUIT_BREAKER_CLOSED, {
        provider,
        failureRate: 0.2,
        failures: 2,
        total: 10,
        timestamp: expect.any(String),
      });

      jest.restoreAllMocks();
    });

    it('should not change state if minimum attempts not reached', async () => {
      const provider = 'ninepayment';
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      mockRedisClient.zadd.mockResolvedValue(1);
      mockRedisClient.zremrangebyscore.mockResolvedValue(0);
      mockRedisClient.zcount.mockResolvedValueOnce(3).mockResolvedValueOnce(2);
      redisService.expire.mockResolvedValue(1);
      redisService.get.mockResolvedValue('CLOSED');

      await service.recordAttempt(provider, false);

      expect(redisService.set).not.toHaveBeenCalledWith(
        `circuit-breaker:${provider}:state`,
        expect.any(String),
        expect.any(Number),
      );

      jest.restoreAllMocks();
    });
  });

  describe('canProceed', () => {
    it('should allow requests when circuit is CLOSED', async () => {
      const provider = 'ninepayment';
      redisService.get.mockResolvedValue('CLOSED');

      const result = await service.canProceed(provider);

      expect(result).toEqual({ allowed: true });
      expect(redisService.get).toHaveBeenCalledWith(`circuit-breaker:${provider}:state`);
    });

    it('should allow requests when state is null (defaults to CLOSED)', async () => {
      const provider = 'ninepayment';
      redisService.get.mockResolvedValue(null);

      const result = await service.canProceed(provider);

      expect(result).toEqual({ allowed: true });
    });

    it('should block requests when circuit is OPEN and duration not elapsed', async () => {
      const provider = 'ninepayment';
      const now = Date.now();
      const openedAt = now - 60000; // 1 minute ago
      jest.spyOn(Date, 'now').mockReturnValue(now);

      redisService.get.mockResolvedValueOnce('OPEN').mockResolvedValueOnce(openedAt.toString());

      const result = await service.canProceed(provider);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Withdrawal service temporarily unavailable');
      expect(result.reason).toContain('240 second(s)');

      jest.restoreAllMocks();
    });

    it('should transition to HALF_OPEN when circuit is OPEN and duration elapsed', async () => {
      const provider = 'ninepayment';
      const now = Date.now();
      const openedAt = now - 350000; // More than 300 seconds ago
      jest.spyOn(Date, 'now').mockReturnValue(now);

      redisService.get.mockResolvedValueOnce('OPEN').mockResolvedValueOnce(openedAt.toString());
      redisService.set.mockResolvedValue('OK');
      redisService.del.mockResolvedValue(1);

      const result = await service.canProceed(provider);

      expect(result).toEqual({ allowed: true });
      expect(redisService.set).toHaveBeenCalledWith(`circuit-breaker:${provider}:state`, 'HALF_OPEN', 1800);
      expect(redisService.del).toHaveBeenCalledWith(`circuit-breaker:${provider}:half-open-attempts`);

      jest.restoreAllMocks();
    });

    it('should allow test attempts when circuit is HALF_OPEN and under max attempts', async () => {
      const provider = 'ninepayment';

      redisService.get.mockResolvedValueOnce('HALF_OPEN').mockResolvedValueOnce('2');
      mockRedisClient.incr.mockResolvedValue(3);
      redisService.expire.mockResolvedValue(1);

      const result = await service.canProceed(provider);

      expect(result).toEqual({ allowed: true });
      expect(mockRedisClient.incr).toHaveBeenCalledWith(`circuit-breaker:${provider}:half-open-attempts`);
      expect(redisService.expire).toHaveBeenCalledWith(`circuit-breaker:${provider}:half-open-attempts`, 60);
    });

    it('should block requests when circuit is HALF_OPEN and max attempts reached', async () => {
      const provider = 'ninepayment';

      redisService.get.mockResolvedValueOnce('HALF_OPEN').mockResolvedValueOnce('3');

      const result = await service.canProceed(provider);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Service recovery testing in progress. Please try again shortly.');
      expect(mockRedisClient.incr).not.toHaveBeenCalled();
    });

    it('should handle null openedAt when circuit is OPEN', async () => {
      const provider = 'ninepayment';
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      redisService.get.mockResolvedValueOnce('OPEN').mockResolvedValueOnce(null);

      const result = await service.canProceed(provider);

      expect(result.allowed).toBe(false);

      jest.restoreAllMocks();
    });

    it('should handle half-open attempts as 0 when null', async () => {
      const provider = 'ninepayment';

      redisService.get.mockResolvedValueOnce('HALF_OPEN').mockResolvedValueOnce(null);
      mockRedisClient.incr.mockResolvedValue(1);
      redisService.expire.mockResolvedValue(1);

      const result = await service.canProceed(provider);

      expect(result).toEqual({ allowed: true });
      expect(mockRedisClient.incr).toHaveBeenCalled();
    });
  });

  describe('forceOpen', () => {
    it('should manually force circuit to OPEN state', async () => {
      const provider = 'ninepayment';
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      redisService.set.mockResolvedValue('OK');

      await service.forceOpen(provider);

      expect(redisService.set).toHaveBeenCalledWith(`circuit-breaker:${provider}:state`, 'OPEN', 1800);
      expect(redisService.set).toHaveBeenCalledWith(`circuit-breaker:${provider}:opened-at`, now.toString(), 360);

      jest.restoreAllMocks();
    });
  });

  describe('forceClose', () => {
    it('should manually force circuit to CLOSED state', async () => {
      const provider = 'ninepayment';

      redisService.set.mockResolvedValue('OK');
      redisService.del.mockResolvedValue(1);

      await service.forceClose(provider);

      expect(redisService.set).toHaveBeenCalledWith(`circuit-breaker:${provider}:state`, 'CLOSED', 1800);
      expect(redisService.del).toHaveBeenCalledWith(`circuit-breaker:${provider}:opened-at`);
      expect(redisService.del).toHaveBeenCalledWith(`circuit-breaker:${provider}:half-open-attempts`);
    });
  });

  describe('getStats', () => {
    it('should return circuit breaker statistics', async () => {
      const provider = 'ninepayment';
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      mockRedisClient.zcount.mockResolvedValueOnce(3).mockResolvedValueOnce(7);
      redisService.get.mockResolvedValueOnce('CLOSED').mockResolvedValueOnce(null);

      const result = await service.getStats(provider);

      expect(result).toEqual({
        state: 'CLOSED',
        failures: 3,
        successes: 7,
        failureRate: 0.3,
        openedAt: null,
      });
      expect(mockRedisClient.zcount).toHaveBeenCalledWith(`circuit-breaker:${provider}:failures`, now - 900000, now);
      expect(mockRedisClient.zcount).toHaveBeenCalledWith(`circuit-breaker:${provider}:successes`, now - 900000, now);

      jest.restoreAllMocks();
    });

    it('should return zero failure rate when no attempts recorded', async () => {
      const provider = 'ninepayment';
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      mockRedisClient.zcount.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      redisService.get.mockResolvedValueOnce('CLOSED').mockResolvedValueOnce(null);

      const result = await service.getStats(provider);

      expect(result).toEqual({
        state: 'CLOSED',
        failures: 0,
        successes: 0,
        failureRate: 0,
        openedAt: null,
      });

      jest.restoreAllMocks();
    });

    it('should return statistics with opened timestamp when circuit is OPEN', async () => {
      const provider = 'ninepayment';
      const now = Date.now();
      const openedAt = now - 100000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      mockRedisClient.zcount.mockResolvedValueOnce(8).mockResolvedValueOnce(2);
      redisService.get.mockResolvedValueOnce('OPEN').mockResolvedValueOnce(openedAt.toString());

      const result = await service.getStats(provider);

      expect(result).toEqual({
        state: 'OPEN',
        failures: 8,
        successes: 2,
        failureRate: 0.8,
        openedAt,
      });

      jest.restoreAllMocks();
    });
  });

  describe('checkAndUpdateState - edge cases', () => {
    it('should open circuit from HALF_OPEN state when failure threshold exceeded', async () => {
      const provider = 'ninepayment';
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      mockRedisClient.zadd.mockResolvedValue(1);
      mockRedisClient.zremrangebyscore.mockResolvedValue(0);
      mockRedisClient.zcount.mockResolvedValueOnce(6).mockResolvedValueOnce(4);
      redisService.expire.mockResolvedValue(1);
      redisService.get.mockResolvedValue('HALF_OPEN');
      redisService.set.mockResolvedValue('OK');

      await service.recordAttempt(provider, false);

      expect(redisService.set).toHaveBeenCalledWith(`circuit-breaker:${provider}:state`, 'OPEN', 1800);
      expect(eventEmitterService.emit).toHaveBeenCalledWith(
        EventEmitterEventsEnum.CIRCUIT_BREAKER_OPENED,
        expect.any(Object),
      );

      jest.restoreAllMocks();
    });

    it('should not reopen circuit if already OPEN and failure threshold exceeded', async () => {
      const provider = 'ninepayment';
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      mockRedisClient.zadd.mockResolvedValue(1);
      mockRedisClient.zremrangebyscore.mockResolvedValue(0);
      mockRedisClient.zcount.mockResolvedValueOnce(9).mockResolvedValueOnce(1);
      redisService.expire.mockResolvedValue(1);
      redisService.get.mockResolvedValueOnce('OPEN').mockResolvedValueOnce('OPEN');
      redisService.set.mockResolvedValue('OK');

      const emitCallCount = eventEmitterService.emit.mock.calls.length;

      await service.recordAttempt(provider, false);

      expect(eventEmitterService.emit).toHaveBeenCalledTimes(emitCallCount);

      jest.restoreAllMocks();
    });

    it('should not close circuit if CLOSED and failure rate is below threshold', async () => {
      const provider = 'ninepayment';
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      mockRedisClient.zadd.mockResolvedValue(1);
      mockRedisClient.zremrangebyscore.mockResolvedValue(0);
      mockRedisClient.zcount.mockResolvedValueOnce(2).mockResolvedValueOnce(8);
      redisService.expire.mockResolvedValue(1);
      redisService.get.mockResolvedValue('CLOSED');

      const emitCallCount = eventEmitterService.emit.mock.calls.length;

      await service.recordAttempt(provider, true);

      expect(redisService.set).not.toHaveBeenCalledWith(
        `circuit-breaker:${provider}:state`,
        'CLOSED',
        expect.any(Number),
      );
      expect(eventEmitterService.emit).toHaveBeenCalledTimes(emitCallCount);

      jest.restoreAllMocks();
    });
  });

  describe('state key generation', () => {
    it('should generate correct keys for different providers', async () => {
      const provider1 = 'ninepayment';
      const provider2 = 'waas';

      redisService.get.mockResolvedValue('CLOSED');

      await service.canProceed(provider1);
      await service.canProceed(provider2);

      expect(redisService.get).toHaveBeenCalledWith(`circuit-breaker:${provider1}:state`);
      expect(redisService.get).toHaveBeenCalledWith(`circuit-breaker:${provider2}:state`);
    });

    it('should default to CLOSED for unknown circuit state', async () => {
      const provider = 'ninepayment';

      // Mock an unknown/invalid state
      redisService.get.mockResolvedValue('UNKNOWN_STATE' as any);

      const result = await service.canProceed(provider);

      expect(result).toEqual({ allowed: true });
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete lifecycle: CLOSED -> OPEN -> HALF_OPEN -> CLOSED', async () => {
      const provider = 'ninepayment';
      let now = Date.now();
      const dateSpy = jest.spyOn(Date, 'now');

      dateSpy.mockReturnValue(now);
      mockRedisClient.zadd.mockResolvedValue(1);
      mockRedisClient.zremrangebyscore.mockResolvedValue(0);
      redisService.expire.mockResolvedValue(1);
      redisService.set.mockResolvedValue('OK');
      redisService.del.mockResolvedValue(1);

      // Start in CLOSED state
      redisService.get.mockResolvedValue('CLOSED');
      let result = await service.canProceed(provider);
      expect(result.allowed).toBe(true);

      // Record failures to trigger OPEN
      mockRedisClient.zcount.mockResolvedValueOnce(6).mockResolvedValueOnce(4);
      redisService.get.mockResolvedValue('CLOSED');
      await service.recordAttempt(provider, false);

      // Verify OPEN state blocks requests
      now = now + 60000; // 1 minute later
      dateSpy.mockReturnValue(now);
      const openedAt = now - 60000;
      redisService.get.mockResolvedValueOnce('OPEN').mockResolvedValueOnce(openedAt.toString());
      result = await service.canProceed(provider);
      expect(result.allowed).toBe(false);

      // Wait for open duration to pass and transition to HALF_OPEN
      now = now + 350000; // 5+ minutes later
      dateSpy.mockReturnValue(now);
      redisService.get.mockResolvedValueOnce('OPEN').mockResolvedValueOnce(openedAt.toString());
      result = await service.canProceed(provider);
      expect(result.allowed).toBe(true);
      expect(redisService.set).toHaveBeenCalledWith(`circuit-breaker:${provider}:state`, 'HALF_OPEN', 1800);

      // Record success to close circuit
      mockRedisClient.zcount.mockResolvedValueOnce(2).mockResolvedValueOnce(8);
      redisService.get.mockResolvedValue('HALF_OPEN');
      await service.recordAttempt(provider, true);

      expect(redisService.set).toHaveBeenCalledWith(`circuit-breaker:${provider}:state`, 'CLOSED', 1800);
      expect(eventEmitterService.emit).toHaveBeenCalledWith(
        EventEmitterEventsEnum.CIRCUIT_BREAKER_CLOSED,
        expect.any(Object),
      );

      dateSpy.mockRestore();
    });

    it('should handle HALF_OPEN state with multiple test attempts', async () => {
      const provider = 'ninepayment';

      redisService.get.mockResolvedValue('HALF_OPEN');
      mockRedisClient.incr.mockResolvedValue(1);
      redisService.expire.mockResolvedValue(1);

      // First test attempt
      redisService.get.mockResolvedValueOnce('HALF_OPEN').mockResolvedValueOnce('0');
      let result = await service.canProceed(provider);
      expect(result.allowed).toBe(true);

      // Second test attempt
      redisService.get.mockResolvedValueOnce('HALF_OPEN').mockResolvedValueOnce('1');
      result = await service.canProceed(provider);
      expect(result.allowed).toBe(true);

      // Third test attempt
      redisService.get.mockResolvedValueOnce('HALF_OPEN').mockResolvedValueOnce('2');
      result = await service.canProceed(provider);
      expect(result.allowed).toBe(true);

      // Fourth attempt should be blocked
      redisService.get.mockResolvedValueOnce('HALF_OPEN').mockResolvedValueOnce('3');
      result = await service.canProceed(provider);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Service recovery testing in progress. Please try again shortly.');
    });
  });
});
