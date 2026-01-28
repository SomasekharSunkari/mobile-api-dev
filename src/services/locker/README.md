# Locker Service

The Locker Service provides distributed locking functionality using Redis as the backend store. It allows you to create locks that synchronize access to resources across multiple instances of your application.

## Features

- Distributed locking with Redis
- Customizable TTL (Time-To-Live)
- Configurable retry behavior
- Atomic lock operations using Redis Lua scripts
- Owner verification for lock releases
- Force lock release capabilities
- Automatic lock release after callback execution

## Installation

The Locker Service is provided as a NestJS module. To use it, you need to import the `LockerModule` in your application:

```typescript
import { Module } from '@nestjs/common';
import { LockerModule } from './services/locker/locker.module';

@Module({
  imports: [LockerModule],
})
export class AppModule {}
```

## Usage

### Basic Usage

```typescript
import { Injectable } from '@nestjs/common';
import { LockerService } from './services/locker/locker.service';

@Injectable()
export class YourService {
  constructor(private readonly lockerService: LockerService) {}

  async performCriticalOperation() {
    return this.lockerService.withLock('your-resource-key', async () => {
      // Your critical section code here
      // This will only run if the lock is acquired
      return result;
    });
  }
}
```

### Creating and Using Locks Manually

```typescript
async function manualLockExample() {
  const lock = lockerService.createLock('resource-key', { ttl: 10000 });

  try {
    const acquired = await lock.acquire();
    if (acquired) {
      // Critical section
    }
  } finally {
    await lock.release();
  }
}
```

### Running Code with Automatic Lock Release

```typescript
async function withLockExample() {
  const result = await lockerService.withLock(
    'resource-key',
    async () => {
      // Critical section that returns a value
      return computedValue;
    },
    { ttl: 5000, retryCount: 3, retryDelay: 500 },
  );

  // Result contains the return value from the callback
}
```

## API Reference

### LockerService Methods

#### `createLock(key: string, options?: { ttl?: number; retryCount?: number; retryDelay?: number })`

Creates a new lock instance with the specified key and options.

- `key`: Unique identifier for the lock
- `options.ttl`: Time-To-Live in milliseconds (default: 30000)
- `options.retryCount`: Number of acquisition attempts (default: infinite)
- `options.retryDelay`: Delay between attempts in milliseconds (default: 250)

Returns a `LockBuilder` instance.

#### `withLock<T>(key: string, callback: () => Promise<T>, options?: { ttl?: number; retryCount?: number; retryDelay?: number }): Promise<T>`

Acquires a lock, executes the callback, and automatically releases the lock.

- `key`: Unique identifier for the lock
- `callback`: Async function to execute while holding the lock
- `options`: Same as `createLock` options

Returns the result of the callback or throws an error if the lock cannot be acquired.

#### `runWithLock<T>(key: string, callback: () => Promise<T>, options?: { ttl?: number; retryCount?: number; retryDelay?: number }): Promise<T>`

Similar to `withLock` but uses the lock's internal `run` method.

#### `isLocked(key: string): Promise<boolean>`

Checks if a lock with the given key currently exists.

#### `forceRelease(key: string): Promise<void>`

Forces the release of a lock regardless of ownership.

## Lock Operations

The `LockBuilder` class provides several methods:

- `acquire()`: Attempts to acquire the lock with retry behavior
- `acquireImmediately()`: Attempts to acquire the lock without retries
- `release()`: Releases the lock if owned by this instance
- `forceRelease()`: Releases the lock regardless of ownership
- `exists()`: Checks if the lock exists
- `isExpired()`: Checks if the lock is expired
- `getRemainingTime()`: Gets remaining time in milliseconds before expiration
- `extend(duration?)`: Extends the lock's TTL

## Advanced Examples

### Implementing a Mutex

```typescript
async function mutexExample() {
  const key = 'user-account-12345';

  return lockerService.withLock(
    key,
    async () => {
      // Only one process can execute this code at a time
      const account = await accountService.find(12345);
      account.balance += 100;
      await accountService.save(account);
      return account;
    },
    { ttl: 5000 },
  );
}
```

### Using Lock Status

```typescript
async function checkLockStatus() {
  const isResourceLocked = await lockerService.isLocked('resource-key');

  if (isResourceLocked) {
    // Resource is currently locked
    return 'Resource is busy';
  }

  return 'Resource is available';
}
```
