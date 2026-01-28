// Error class for when a lock is not owned by the requester
export class LockNotOwnedError extends Error {
  constructor() {
    super('Trying to update or release a lock that is not acquired by you');
    this.name = 'LockNotOwnedError';
  }
}
