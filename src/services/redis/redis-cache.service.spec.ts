import { Test, TestingModule } from '@nestjs/testing';
import { RedisConfigProvider } from '../../config/redis.config';
import { RedisCacheService } from './redis-cache.service';
import { RedisService } from './redis.service';

jest.mock('../../config/redis.config');

describe('RedisCacheService', () => {
  let service: RedisCacheService;
  let mockRedisService: jest.Mocked<RedisService>;
  let mockPipeline: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    (RedisConfigProvider as jest.Mock).mockImplementation(() => ({
      getConfig: jest.fn().mockReturnValue({
        ttl: 86400,
        keyPrefix: 'test:',
      }),
    }));

    mockPipeline = {
      hset: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };

    mockRedisService = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      hset: jest.fn(),
      hget: jest.fn(),
      hgetall: jest.fn(),
      hdel: jest.fn(),
      sadd: jest.fn(),
      smembers: jest.fn(),
      lpush: jest.fn(),
      lrange: jest.fn(),
      publish: jest.fn(),
      subscribe: jest.fn(),
      pipeline: jest.fn().mockReturnValue(mockPipeline),
      multi: jest.fn(),
      close: jest.fn(),
      getClient: jest.fn(),
    } as unknown as jest.Mocked<RedisService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisCacheService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<RedisCacheService>(RedisCacheService);
  });

  describe('Constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should use default TTL of 86400 when not provided', async () => {
      jest.clearAllMocks();

      (RedisConfigProvider as jest.Mock).mockImplementation(() => ({
        getConfig: jest.fn().mockReturnValue({
          ttl: undefined,
          keyPrefix: 'test:',
        }),
      }));

      const moduleWithDefaultTTL: TestingModule = await Test.createTestingModule({
        providers: [
          RedisCacheService,
          {
            provide: RedisService,
            useValue: mockRedisService,
          },
        ],
      }).compile();

      const serviceWithDefaultTTL = moduleWithDefaultTTL.get<RedisCacheService>(RedisCacheService);
      mockRedisService.set.mockResolvedValue('OK');

      await serviceWithDefaultTTL.set('key', { data: 'value' });

      expect(mockRedisService.set).toHaveBeenCalledWith('key', JSON.stringify({ data: 'value' }), 86400);
    });
  });

  describe('set', () => {
    it('should set a value with JSON serialization', async () => {
      mockRedisService.set.mockResolvedValue('OK');

      const result = await service.set('mykey', { name: 'test' });

      expect(result).toBe('OK');
      expect(mockRedisService.set).toHaveBeenCalledWith('mykey', '{"name":"test"}', 86400);
    });

    it('should set a value with custom TTL', async () => {
      mockRedisService.set.mockResolvedValue('OK');

      const result = await service.set('mykey', { name: 'test' }, 3600);

      expect(result).toBe('OK');
      expect(mockRedisService.set).toHaveBeenCalledWith('mykey', '{"name":"test"}', 3600);
    });

    it('should serialize string values', async () => {
      mockRedisService.set.mockResolvedValue('OK');

      await service.set('mykey', 'simple string');

      expect(mockRedisService.set).toHaveBeenCalledWith('mykey', '"simple string"', 86400);
    });

    it('should serialize numeric values', async () => {
      mockRedisService.set.mockResolvedValue('OK');

      await service.set('mykey', 12345);

      expect(mockRedisService.set).toHaveBeenCalledWith('mykey', '12345', 86400);
    });

    it('should serialize array values', async () => {
      mockRedisService.set.mockResolvedValue('OK');

      await service.set('mykey', [1, 2, 3]);

      expect(mockRedisService.set).toHaveBeenCalledWith('mykey', '[1,2,3]', 86400);
    });

    it('should serialize null value', async () => {
      mockRedisService.set.mockResolvedValue('OK');

      await service.set('mykey', null);

      expect(mockRedisService.set).toHaveBeenCalledWith('mykey', 'null', 86400);
    });
  });

  describe('get', () => {
    it('should get and deserialize JSON value', async () => {
      mockRedisService.get.mockResolvedValue('{"name":"test","count":5}');

      const result = await service.get<{ name: string; count: number }>('mykey');

      expect(result).toEqual({ name: 'test', count: 5 });
      expect(mockRedisService.get).toHaveBeenCalledWith('mykey');
    });

    it('should return null for non-existent key', async () => {
      mockRedisService.get.mockResolvedValue(null);

      const result = await service.get('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null and log error for invalid JSON', async () => {
      mockRedisService.get.mockResolvedValue('invalid json {{{');

      const result = await service.get('invalidkey');

      expect(result).toBeNull();
    });

    it('should deserialize array values', async () => {
      mockRedisService.get.mockResolvedValue('[1,2,3]');

      const result = await service.get<number[]>('mykey');

      expect(result).toEqual([1, 2, 3]);
    });

    it('should deserialize string values', async () => {
      mockRedisService.get.mockResolvedValue('"simple string"');

      const result = await service.get<string>('mykey');

      expect(result).toBe('simple string');
    });

    it('should deserialize numeric values', async () => {
      mockRedisService.get.mockResolvedValue('12345');

      const result = await service.get<number>('mykey');

      expect(result).toBe(12345);
    });

    it('should deserialize boolean values', async () => {
      mockRedisService.get.mockResolvedValue('true');

      const result = await service.get<boolean>('mykey');

      expect(result).toBe(true);
    });

    it('should deserialize null values', async () => {
      mockRedisService.get.mockResolvedValue('null');

      const result = await service.get<null>('mykey');

      expect(result).toBeNull();
    });
  });

  describe('del', () => {
    it('should delete a cache entry', async () => {
      mockRedisService.del.mockResolvedValue(1);

      const result = await service.del('mykey');

      expect(result).toBe(1);
      expect(mockRedisService.del).toHaveBeenCalledWith('mykey');
    });

    it('should return 0 when key does not exist', async () => {
      mockRedisService.del.mockResolvedValue(0);

      const result = await service.del('nonexistent');

      expect(result).toBe(0);
    });
  });

  describe('exists', () => {
    it('should return true when key exists', async () => {
      mockRedisService.exists.mockResolvedValue(1);

      const result = await service.exists('mykey');

      expect(result).toBe(true);
      expect(mockRedisService.exists).toHaveBeenCalledWith('mykey');
    });

    it('should return false when key does not exist', async () => {
      mockRedisService.exists.mockResolvedValue(0);

      const result = await service.exists('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getOrSet', () => {
    it('should return cached value when key exists', async () => {
      mockRedisService.get.mockResolvedValue('{"cached":"value"}');

      const factory = jest.fn().mockResolvedValue({ fresh: 'value' });
      const result = await service.getOrSet('mykey', factory);

      expect(result).toEqual({ cached: 'value' });
      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory and cache result when key does not exist', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue('OK');

      const factory = jest.fn().mockResolvedValue({ fresh: 'value' });
      const result = await service.getOrSet('mykey', factory);

      expect(result).toEqual({ fresh: 'value' });
      expect(factory).toHaveBeenCalledTimes(1);
      expect(mockRedisService.set).toHaveBeenCalledWith('mykey', '{"fresh":"value"}', 86400);
    });

    it('should use custom TTL when provided', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue('OK');

      const factory = jest.fn().mockResolvedValue({ data: 'test' });
      await service.getOrSet('mykey', factory, 7200);

      expect(mockRedisService.set).toHaveBeenCalledWith('mykey', '{"data":"test"}', 7200);
    });

    it('should handle async factory functions', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue('OK');

      const factory = jest.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { async: 'result' };
      });

      const result = await service.getOrSet('mykey', factory);

      expect(result).toEqual({ async: 'result' });
    });

    it('should not cache when factory returns undefined', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue('OK');

      const factory = jest.fn().mockResolvedValue(undefined);
      const result = await service.getOrSet('mykey', factory);

      expect(result).toBeUndefined();
      expect(mockRedisService.set).toHaveBeenCalledWith('mykey', undefined, 86400);
    });
  });

  describe('hmset', () => {
    it('should set multiple hash fields with JSON serialization', async () => {
      const data = { field1: 'value1', field2: { nested: 'object' } };

      const result = await service.hmset('myhash', data);

      expect(result).toBe('OK');
      expect(mockPipeline.hset).toHaveBeenCalledWith('myhash', 'field1', 'value1');
      expect(mockPipeline.hset).toHaveBeenCalledWith('myhash', 'field2', '{"nested":"object"}');
      expect(mockPipeline.expire).toHaveBeenCalledWith('myhash', 86400);
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it('should set hash fields with custom TTL', async () => {
      const data = { field1: 'value1' };

      await service.hmset('myhash', data, 3600);

      expect(mockPipeline.expire).toHaveBeenCalledWith('myhash', 3600);
    });

    it('should handle string values without JSON serialization', async () => {
      const data = { field1: 'simple string' };

      await service.hmset('myhash', data);

      expect(mockPipeline.hset).toHaveBeenCalledWith('myhash', 'field1', 'simple string');
    });

    it('should serialize numeric values', async () => {
      const data = { counter: 100 };

      await service.hmset('myhash', data);

      expect(mockPipeline.hset).toHaveBeenCalledWith('myhash', 'counter', '100');
    });

    it('should serialize boolean values', async () => {
      const data = { active: true };

      await service.hmset('myhash', data);

      expect(mockPipeline.hset).toHaveBeenCalledWith('myhash', 'active', 'true');
    });

    it('should serialize null values', async () => {
      const data = { empty: null };

      await service.hmset('myhash', data);

      expect(mockPipeline.hset).toHaveBeenCalledWith('myhash', 'empty', 'null');
    });

    it('should serialize array values', async () => {
      const data = { list: [1, 2, 3] };

      await service.hmset('myhash', data);

      expect(mockPipeline.hset).toHaveBeenCalledWith('myhash', 'list', '[1,2,3]');
    });
  });

  describe('hgetJson', () => {
    it('should get and deserialize JSON hash field', async () => {
      mockRedisService.hget.mockResolvedValue('{"nested":"value"}');

      const result = await service.hgetJson<{ nested: string }>('myhash', 'field1');

      expect(result).toEqual({ nested: 'value' });
      expect(mockRedisService.hget).toHaveBeenCalledWith('myhash', 'field1');
    });

    it('should return null for non-existent field', async () => {
      mockRedisService.hget.mockResolvedValue(null);

      const result = await service.hgetJson('myhash', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should return raw value when JSON parsing fails', async () => {
      mockRedisService.hget.mockResolvedValue('plain string value');

      const result = await service.hgetJson<string>('myhash', 'field1');

      expect(result).toBe('plain string value');
    });

    it('should deserialize array values', async () => {
      mockRedisService.hget.mockResolvedValue('[1,2,3]');

      const result = await service.hgetJson<number[]>('myhash', 'field1');

      expect(result).toEqual([1, 2, 3]);
    });

    it('should deserialize numeric values', async () => {
      mockRedisService.hget.mockResolvedValue('12345');

      const result = await service.hgetJson<number>('myhash', 'field1');

      expect(result).toBe(12345);
    });

    it('should deserialize boolean values', async () => {
      mockRedisService.hget.mockResolvedValue('true');

      const result = await service.hgetJson<boolean>('myhash', 'field1');

      expect(result).toBe(true);
    });
  });

  describe('hgetallJson', () => {
    it('should get and deserialize all hash fields', async () => {
      mockRedisService.hgetall.mockResolvedValue({
        field1: '{"nested":"value1"}',
        field2: '{"nested":"value2"}',
      });

      const result = await service.hgetallJson<{ nested: string }>('myhash');

      expect(result).toEqual({
        field1: { nested: 'value1' },
        field2: { nested: 'value2' },
      });
      expect(mockRedisService.hgetall).toHaveBeenCalledWith('myhash');
    });

    it('should return null for non-existent hash', async () => {
      mockRedisService.hgetall.mockResolvedValue({});

      const result = await service.hgetallJson('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when hgetall returns null', async () => {
      mockRedisService.hgetall.mockResolvedValue(null as any);

      const result = await service.hgetallJson('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle mixed JSON and plain values', async () => {
      mockRedisService.hgetall.mockResolvedValue({
        json_field: '{"key":"value"}',
        plain_field: 'plain string',
      });

      const result = await service.hgetallJson<any>('myhash');

      expect(result).toEqual({
        json_field: { key: 'value' },
        plain_field: 'plain string',
      });
    });

    it('should handle array values', async () => {
      mockRedisService.hgetall.mockResolvedValue({
        array_field: '[1,2,3]',
      });

      const result = await service.hgetallJson<number[]>('myhash');

      expect(result).toEqual({
        array_field: [1, 2, 3],
      });
    });

    it('should handle numeric values', async () => {
      mockRedisService.hgetall.mockResolvedValue({
        number_field: '12345',
      });

      const result = await service.hgetallJson<number>('myhash');

      expect(result).toEqual({
        number_field: 12345,
      });
    });
  });

  describe('getRedisService', () => {
    it('should return the underlying Redis service', () => {
      const result = service.getRedisService();

      expect(result).toBe(mockRedisService);
    });
  });
});
