import { Test, TestingModule } from '@nestjs/testing';
import { EnvironmentService } from '../../config';
import { RedisConfigProvider } from '../../config/redis.config';
import { RedisService } from './redis.service';

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    on: jest.fn(),
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
    llen: jest.fn(),
    publish: jest.fn(),
    subscribe: jest.fn(),
    pipeline: jest.fn(),
    multi: jest.fn(),
    quit: jest.fn(),
    keys: jest.fn(),
  })),
}));

jest.mock('../../config/redis.config');
jest.mock('../../config', () => ({
  EnvironmentService: {
    getValue: jest.fn(),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Redis = require('ioredis').default;

describe('RedisService', () => {
  let service: RedisService;
  let mockConfig: any;
  let redisClientInstance: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockConfig = {
      host: 'localhost',
      port: 6379,
      password: 'testpassword',
      db: 0,
      keyPrefix: 'test:',
      ttl: 86400,
      connectTimeout: 10000,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
    };

    (RedisConfigProvider as jest.Mock).mockImplementation(() => ({
      getConfig: jest.fn().mockReturnValue(mockConfig),
    }));

    (EnvironmentService.getValue as jest.Mock).mockReturnValue(undefined);

    // Create mock client instance that will be returned by Redis constructor
    redisClientInstance = {
      on: jest.fn(),
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
      llen: jest.fn(),
      publish: jest.fn(),
      subscribe: jest.fn(),
      pipeline: jest.fn(),
      multi: jest.fn(),
      quit: jest.fn(),
      keys: jest.fn(),
    };

    Redis.mockImplementation(() => redisClientInstance);

    const module: TestingModule = await Test.createTestingModule({
      providers: [RedisService],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  describe('Constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize Redis client with correct configuration', () => {
      expect(Redis).toHaveBeenCalledWith({
        host: mockConfig.host,
        port: mockConfig.port,
        password: mockConfig.password,
        db: mockConfig.db,
        connectTimeout: mockConfig.connectTimeout,
        maxRetriesPerRequest: mockConfig.maxRetriesPerRequest,
        enableReadyCheck: mockConfig.enableReadyCheck,
      });
    });

    it('should initialize Redis client with TLS when enabled', async () => {
      jest.clearAllMocks();

      (EnvironmentService.getValue as jest.Mock).mockReturnValue('true');

      Redis.mockImplementation(() => redisClientInstance);

      const moduleWithTLS: TestingModule = await Test.createTestingModule({
        providers: [RedisService],
      }).compile();

      moduleWithTLS.get<RedisService>(RedisService);

      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          tls: {},
        }),
      );
    });

    it('should register error and connect event handlers', () => {
      expect(redisClientInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(redisClientInstance.on).toHaveBeenCalledWith('connect', expect.any(Function));
    });

    it('should use empty string as key prefix when not provided', async () => {
      jest.clearAllMocks();

      const configWithoutPrefix = { ...mockConfig, keyPrefix: undefined };
      (RedisConfigProvider as jest.Mock).mockImplementation(() => ({
        getConfig: jest.fn().mockReturnValue(configWithoutPrefix),
      }));

      Redis.mockImplementation(() => redisClientInstance);

      const moduleWithoutPrefix: TestingModule = await Test.createTestingModule({
        providers: [RedisService],
      }).compile();

      const serviceWithoutPrefix = moduleWithoutPrefix.get<RedisService>(RedisService);

      redisClientInstance.set.mockResolvedValue('OK');
      await serviceWithoutPrefix.set('mykey', 'myvalue');

      expect(redisClientInstance.set).toHaveBeenCalledWith(':mykey', 'myvalue');
    });
  });

  describe('getClient', () => {
    it('should return the Redis client instance', () => {
      const client = service.getClient();
      expect(client).toBe(redisClientInstance);
    });
  });

  describe('set', () => {
    it('should set a value without TTL', async () => {
      redisClientInstance.set.mockResolvedValue('OK');

      const result = await service.set('mykey', 'myvalue');

      expect(result).toBe('OK');
      expect(redisClientInstance.set).toHaveBeenCalledWith('test::mykey', 'myvalue');
    });

    it('should set a value with TTL', async () => {
      redisClientInstance.set.mockResolvedValue('OK');

      const result = await service.set('mykey', 'myvalue', 3600);

      expect(result).toBe('OK');
      expect(redisClientInstance.set).toHaveBeenCalledWith('test::mykey', 'myvalue', 'EX', 3600);
    });

    it('should set a numeric value', async () => {
      redisClientInstance.set.mockResolvedValue('OK');

      const result = await service.set('counter', 100);

      expect(result).toBe('OK');
      expect(redisClientInstance.set).toHaveBeenCalledWith('test::counter', 100);
    });

    it('should set a buffer value', async () => {
      redisClientInstance.set.mockResolvedValue('OK');
      const buffer = Buffer.from('binary data');

      const result = await service.set('binary', buffer);

      expect(result).toBe('OK');
      expect(redisClientInstance.set).toHaveBeenCalledWith('test::binary', buffer);
    });
  });

  describe('get', () => {
    it('should get a value by key', async () => {
      redisClientInstance.get.mockResolvedValue('myvalue');

      const result = await service.get('mykey');

      expect(result).toBe('myvalue');
      expect(redisClientInstance.get).toHaveBeenCalledWith('test::mykey');
    });

    it('should return null for non-existent key', async () => {
      redisClientInstance.get.mockResolvedValue(null);

      const result = await service.get('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('del', () => {
    it('should delete a single key', async () => {
      redisClientInstance.del.mockResolvedValue(1);

      const result = await service.del('mykey');

      expect(result).toBe(1);
      expect(redisClientInstance.del).toHaveBeenCalledWith('test::mykey');
    });

    it('should delete multiple keys', async () => {
      redisClientInstance.del.mockResolvedValue(3);

      const result = await service.del('key1', 'key2', 'key3');

      expect(result).toBe(3);
      expect(redisClientInstance.del).toHaveBeenCalledWith('test::key1', 'test::key2', 'test::key3');
    });

    it('should return 0 when deleting non-existent keys', async () => {
      redisClientInstance.del.mockResolvedValue(0);

      const result = await service.del('nonexistent');

      expect(result).toBe(0);
    });
  });

  describe('exists', () => {
    it('should return 1 when key exists', async () => {
      redisClientInstance.exists.mockResolvedValue(1);

      const result = await service.exists('mykey');

      expect(result).toBe(1);
      expect(redisClientInstance.exists).toHaveBeenCalledWith('test::mykey');
    });

    it('should return 0 when key does not exist', async () => {
      redisClientInstance.exists.mockResolvedValue(0);

      const result = await service.exists('nonexistent');

      expect(result).toBe(0);
    });
  });

  describe('expire', () => {
    it('should set expiry on a key', async () => {
      redisClientInstance.expire.mockResolvedValue(1);

      const result = await service.expire('mykey', 3600);

      expect(result).toBe(1);
      expect(redisClientInstance.expire).toHaveBeenCalledWith('test::mykey', 3600);
    });

    it('should return 0 when key does not exist', async () => {
      redisClientInstance.expire.mockResolvedValue(0);

      const result = await service.expire('nonexistent', 3600);

      expect(result).toBe(0);
    });
  });

  describe('hset', () => {
    it('should set a hash field with string value', async () => {
      redisClientInstance.hset.mockResolvedValue(1);

      const result = await service.hset('myhash', 'field1', 'value1');

      expect(result).toBe(1);
      expect(redisClientInstance.hset).toHaveBeenCalledWith('test::myhash', 'field1', 'value1');
    });

    it('should set a hash field with numeric value', async () => {
      redisClientInstance.hset.mockResolvedValue(1);

      const result = await service.hset('myhash', 'counter', 100);

      expect(result).toBe(1);
      expect(redisClientInstance.hset).toHaveBeenCalledWith('test::myhash', 'counter', 100);
    });

    it('should return 0 when updating existing field', async () => {
      redisClientInstance.hset.mockResolvedValue(0);

      const result = await service.hset('myhash', 'existingfield', 'newvalue');

      expect(result).toBe(0);
    });
  });

  describe('hget', () => {
    it('should get a hash field value', async () => {
      redisClientInstance.hget.mockResolvedValue('value1');

      const result = await service.hget('myhash', 'field1');

      expect(result).toBe('value1');
      expect(redisClientInstance.hget).toHaveBeenCalledWith('test::myhash', 'field1');
    });

    it('should return null for non-existent field', async () => {
      redisClientInstance.hget.mockResolvedValue(null);

      const result = await service.hget('myhash', 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('hgetall', () => {
    it('should get all hash fields and values', async () => {
      const expectedData = { field1: 'value1', field2: 'value2' };
      redisClientInstance.hgetall.mockResolvedValue(expectedData);

      const result = await service.hgetall('myhash');

      expect(result).toEqual(expectedData);
      expect(redisClientInstance.hgetall).toHaveBeenCalledWith('test::myhash');
    });

    it('should return empty object for non-existent hash', async () => {
      redisClientInstance.hgetall.mockResolvedValue({});

      const result = await service.hgetall('nonexistent');

      expect(result).toEqual({});
    });
  });

  describe('hdel', () => {
    it('should delete a single hash field', async () => {
      redisClientInstance.hdel.mockResolvedValue(1);

      const result = await service.hdel('myhash', 'field1');

      expect(result).toBe(1);
      expect(redisClientInstance.hdel).toHaveBeenCalledWith('test::myhash', 'field1');
    });

    it('should delete multiple hash fields', async () => {
      redisClientInstance.hdel.mockResolvedValue(2);

      const result = await service.hdel('myhash', 'field1', 'field2');

      expect(result).toBe(2);
      expect(redisClientInstance.hdel).toHaveBeenCalledWith('test::myhash', 'field1', 'field2');
    });

    it('should return 0 when deleting non-existent fields', async () => {
      redisClientInstance.hdel.mockResolvedValue(0);

      const result = await service.hdel('myhash', 'nonexistent');

      expect(result).toBe(0);
    });
  });

  describe('sadd', () => {
    it('should add a single member to a set', async () => {
      redisClientInstance.sadd.mockResolvedValue(1);

      const result = await service.sadd('myset', 'member1');

      expect(result).toBe(1);
      expect(redisClientInstance.sadd).toHaveBeenCalledWith('test::myset', 'member1');
    });

    it('should add multiple members to a set', async () => {
      redisClientInstance.sadd.mockResolvedValue(3);

      const result = await service.sadd('myset', 'member1', 'member2', 'member3');

      expect(result).toBe(3);
      expect(redisClientInstance.sadd).toHaveBeenCalledWith('test::myset', 'member1', 'member2', 'member3');
    });

    it('should return 0 when adding existing members', async () => {
      redisClientInstance.sadd.mockResolvedValue(0);

      const result = await service.sadd('myset', 'existingmember');

      expect(result).toBe(0);
    });
  });

  describe('smembers', () => {
    it('should get all members in a set', async () => {
      const expectedMembers = ['member1', 'member2', 'member3'];
      redisClientInstance.smembers.mockResolvedValue(expectedMembers);

      const result = await service.smembers('myset');

      expect(result).toEqual(expectedMembers);
      expect(redisClientInstance.smembers).toHaveBeenCalledWith('test::myset');
    });

    it('should return empty array for non-existent set', async () => {
      redisClientInstance.smembers.mockResolvedValue([]);

      const result = await service.smembers('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('lpush', () => {
    it('should add a single value to a list', async () => {
      redisClientInstance.lpush.mockResolvedValue(1);

      const result = await service.lpush('mylist', 'value1');

      expect(result).toBe(1);
      expect(redisClientInstance.lpush).toHaveBeenCalledWith('test::mylist', 'value1');
    });

    it('should add multiple values to a list', async () => {
      redisClientInstance.lpush.mockResolvedValue(3);

      const result = await service.lpush('mylist', 'value1', 'value2', 'value3');

      expect(result).toBe(3);
      expect(redisClientInstance.lpush).toHaveBeenCalledWith('test::mylist', 'value1', 'value2', 'value3');
    });
  });

  describe('lrange', () => {
    it('should get a range of elements from a list', async () => {
      const expectedValues = ['value1', 'value2', 'value3'];
      redisClientInstance.lrange.mockResolvedValue(expectedValues);

      const result = await service.lrange('mylist', 0, 2);

      expect(result).toEqual(expectedValues);
      expect(redisClientInstance.lrange).toHaveBeenCalledWith('test::mylist', 0, 2);
    });

    it('should get all elements with -1 stop index', async () => {
      const expectedValues = ['value1', 'value2'];
      redisClientInstance.lrange.mockResolvedValue(expectedValues);

      const result = await service.lrange('mylist', 0, -1);

      expect(result).toEqual(expectedValues);
      expect(redisClientInstance.lrange).toHaveBeenCalledWith('test::mylist', 0, -1);
    });

    it('should return empty array for non-existent list', async () => {
      redisClientInstance.lrange.mockResolvedValue([]);

      const result = await service.lrange('nonexistent', 0, -1);

      expect(result).toEqual([]);
    });
  });

  describe('llen', () => {
    it('should get the length of a list', async () => {
      redisClientInstance.llen.mockResolvedValue(5);

      const result = await service.llen('mylist');

      expect(result).toBe(5);
      expect(redisClientInstance.llen).toHaveBeenCalledWith('test::mylist');
    });

    it('should return 0 for non-existent list', async () => {
      redisClientInstance.llen.mockResolvedValue(0);

      const result = await service.llen('nonexistent');

      expect(result).toBe(0);
    });
  });

  describe('publish', () => {
    it('should publish a message to a channel', async () => {
      redisClientInstance.publish.mockResolvedValue(1);

      const result = await service.publish('mychannel', 'mymessage');

      expect(result).toBe(1);
      expect(redisClientInstance.publish).toHaveBeenCalledWith('mychannel', 'mymessage');
    });

    it('should return 0 when no subscribers exist', async () => {
      redisClientInstance.publish.mockResolvedValue(0);

      const result = await service.publish('emptychannel', 'mymessage');

      expect(result).toBe(0);
    });
  });

  describe('subscribe', () => {
    it('should subscribe to a single channel', async () => {
      redisClientInstance.subscribe.mockResolvedValue(undefined);

      await service.subscribe('mychannel');

      expect(redisClientInstance.subscribe).toHaveBeenCalledWith('mychannel');
    });

    it('should subscribe to multiple channels', async () => {
      redisClientInstance.subscribe.mockResolvedValue(undefined);

      await service.subscribe('channel1', 'channel2', 'channel3');

      expect(redisClientInstance.subscribe).toHaveBeenCalledWith('channel1', 'channel2', 'channel3');
    });
  });

  describe('keys', () => {
    it('should find keys matching a pattern with prefix', async () => {
      const expectedKeys = ['test::access_token:user-1:identity-1', 'test::access_token:user-1:identity-2'];
      redisClientInstance.keys.mockResolvedValue(expectedKeys);

      const result = await service.keys('access_token:user-1:*');

      expect(result).toEqual(expectedKeys);
      expect(redisClientInstance.keys).toHaveBeenCalledWith('test::access_token:user-1:*');
    });

    it('should return empty array when no keys match', async () => {
      redisClientInstance.keys.mockResolvedValue([]);

      const result = await service.keys('nonexistent:*');

      expect(result).toEqual([]);
      expect(redisClientInstance.keys).toHaveBeenCalledWith('test::nonexistent:*');
    });

    it('should apply key prefix to pattern', async () => {
      redisClientInstance.keys.mockResolvedValue([]);

      await service.keys('mypattern:*');

      expect(redisClientInstance.keys).toHaveBeenCalledWith('test::mypattern:*');
    });
  });

  describe('pipeline', () => {
    it('should return a pipeline instance', () => {
      const mockPipeline = { exec: jest.fn() };
      redisClientInstance.pipeline.mockReturnValue(mockPipeline);

      const result = service.pipeline();

      expect(result).toBe(mockPipeline);
      expect(redisClientInstance.pipeline).toHaveBeenCalled();
    });
  });

  describe('multi', () => {
    it('should return a multi instance for transactions', () => {
      const mockMulti = { exec: jest.fn() };
      redisClientInstance.multi.mockReturnValue(mockMulti);

      const result = service.multi();

      expect(result).toBe(mockMulti);
      expect(redisClientInstance.multi).toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should close the Redis connection', async () => {
      redisClientInstance.quit.mockResolvedValue('OK');

      await service.close();

      expect(redisClientInstance.quit).toHaveBeenCalled();
    });
  });

  describe('Event Handlers', () => {
    it('should handle error event', () => {
      const errorCallback = redisClientInstance.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];
      expect(errorCallback).toBeDefined();

      // Should not throw
      expect(() => errorCallback(new Error('Connection error'))).not.toThrow();
    });

    it('should handle connect event', () => {
      const connectCallback = redisClientInstance.on.mock.calls.find((call: any) => call[0] === 'connect')?.[1];
      expect(connectCallback).toBeDefined();

      // Should not throw
      expect(() => connectCallback()).not.toThrow();
    });
  });
});
