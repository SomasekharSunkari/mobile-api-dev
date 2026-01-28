import { UserStatus } from '../../../database/models/user/user.interface';
import { UserModel } from '../../../database/models/user/user.model';
import { UserRepository } from './user.repository';

describe('UserRepository', () => {
  let repository: UserRepository;

  const mockUser = {
    id: 'user-123',
    first_name: 'John',
    last_name: 'Doe',
    username: 'johndoe',
    email: 'john@example.com',
    phone_number: '+1234567890',
    status: UserStatus.ACTIVE,
    is_email_verified: true,
    country: {
      id: 'country-1',
      name: 'United States',
      code: 'US',
    },
    created_at: new Date(),
    updated_at: new Date(),
  } as unknown as UserModel;

  beforeEach(() => {
    repository = new UserRepository();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findActiveByEmail', () => {
    it('should find an active user by email', async () => {
      const mockQueryBuilder = {
        modify: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereNotExists: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnThis(),
        whereILike: jest.fn().mockReturnThis(),
        withGraphFetched: jest.fn().mockResolvedValue(mockUser),
      };

      jest.spyOn(repository, 'query').mockReturnValue(mockQueryBuilder as any);

      const result = await repository.findActiveByEmail('john@example.com');

      expect(repository.query).toHaveBeenCalled();
      expect(mockQueryBuilder.modify).toHaveBeenCalledWith('notDeleted');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('status', UserStatus.ACTIVE);
      expect(mockQueryBuilder.whereNotExists).toHaveBeenCalled();
      expect(mockQueryBuilder.first).toHaveBeenCalled();
      expect(mockQueryBuilder.whereILike).toHaveBeenCalledWith('email', 'john@example.com');
      expect(mockQueryBuilder.withGraphFetched).toHaveBeenCalledWith('[country]');
      expect(result).toEqual(mockUser);
    });

    it('should return undefined when user not found by email', async () => {
      const mockQueryBuilder = {
        modify: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereNotExists: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnThis(),
        whereILike: jest.fn().mockReturnThis(),
        withGraphFetched: jest.fn().mockResolvedValue(undefined),
      };

      jest.spyOn(repository, 'query').mockReturnValue(mockQueryBuilder as any);

      const result = await repository.findActiveByEmail('nonexistent@example.com');

      expect(result).toBeUndefined();
    });

    it('should be case insensitive when finding by email', async () => {
      const mockQueryBuilder = {
        modify: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereNotExists: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnThis(),
        whereILike: jest.fn().mockReturnThis(),
        withGraphFetched: jest.fn().mockResolvedValue(mockUser),
      };

      jest.spyOn(repository, 'query').mockReturnValue(mockQueryBuilder as any);

      await repository.findActiveByEmail('JOHN@EXAMPLE.COM');

      expect(mockQueryBuilder.whereILike).toHaveBeenCalledWith('email', 'JOHN@EXAMPLE.COM');
    });

    it('should exclude users with account delete requests', async () => {
      const mockSubQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        whereRaw: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
      };

      const mockQueryBuilder = {
        modify: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereNotExists: jest.fn((callback) => {
          callback(mockSubQueryBuilder);
          return mockQueryBuilder;
        }),
        first: jest.fn().mockReturnThis(),
        whereILike: jest.fn().mockReturnThis(),
        withGraphFetched: jest.fn().mockResolvedValue(mockUser),
      };

      jest.spyOn(repository, 'query').mockReturnValue(mockQueryBuilder as any);

      await repository.findActiveByEmail('john@example.com');

      expect(mockQueryBuilder.whereNotExists).toHaveBeenCalledWith(expect.any(Function));
      expect(mockSubQueryBuilder.select).toHaveBeenCalledWith('*');
      expect(mockSubQueryBuilder.from).toHaveBeenCalled();
      expect(mockSubQueryBuilder.whereRaw).toHaveBeenCalled();
      expect(mockSubQueryBuilder.whereNull).toHaveBeenCalled();
    });
  });

  describe('findActiveByUsername', () => {
    it('should find an active user by username', async () => {
      const mockQueryBuilder = {
        modify: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereNotExists: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnThis(),
        whereILike: jest.fn().mockReturnThis(),
        withGraphFetched: jest.fn().mockResolvedValue(mockUser),
      };

      jest.spyOn(repository, 'query').mockReturnValue(mockQueryBuilder as any);

      const result = await repository.findActiveByUsername('johndoe');

      expect(repository.query).toHaveBeenCalled();
      expect(mockQueryBuilder.modify).toHaveBeenCalledWith('notDeleted');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('status', UserStatus.ACTIVE);
      expect(mockQueryBuilder.whereNotExists).toHaveBeenCalled();
      expect(mockQueryBuilder.first).toHaveBeenCalled();
      expect(mockQueryBuilder.whereILike).toHaveBeenCalledWith('username', 'johndoe');
      expect(mockQueryBuilder.withGraphFetched).toHaveBeenCalledWith('[country]');
      expect(result).toEqual(mockUser);
    });

    it('should return undefined when user not found by username', async () => {
      const mockQueryBuilder = {
        modify: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereNotExists: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnThis(),
        whereILike: jest.fn().mockReturnThis(),
        withGraphFetched: jest.fn().mockResolvedValue(undefined),
      };

      jest.spyOn(repository, 'query').mockReturnValue(mockQueryBuilder as any);

      const result = await repository.findActiveByUsername('nonexistentuser');

      expect(result).toBeUndefined();
    });

    it('should be case insensitive when finding by username', async () => {
      const mockQueryBuilder = {
        modify: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereNotExists: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnThis(),
        whereILike: jest.fn().mockReturnThis(),
        withGraphFetched: jest.fn().mockResolvedValue(mockUser),
      };

      jest.spyOn(repository, 'query').mockReturnValue(mockQueryBuilder as any);

      await repository.findActiveByUsername('JOHNDOE');

      expect(mockQueryBuilder.whereILike).toHaveBeenCalledWith('username', 'JOHNDOE');
    });

    it('should exclude users with account delete requests', async () => {
      const mockSubQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        whereRaw: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
      };

      const mockQueryBuilder = {
        modify: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereNotExists: jest.fn((callback) => {
          callback(mockSubQueryBuilder);
          return mockQueryBuilder;
        }),
        first: jest.fn().mockReturnThis(),
        whereILike: jest.fn().mockReturnThis(),
        withGraphFetched: jest.fn().mockResolvedValue(mockUser),
      };

      jest.spyOn(repository, 'query').mockReturnValue(mockQueryBuilder as any);

      await repository.findActiveByUsername('johndoe');

      expect(mockQueryBuilder.whereNotExists).toHaveBeenCalledWith(expect.any(Function));
      expect(mockSubQueryBuilder.select).toHaveBeenCalledWith('*');
      expect(mockSubQueryBuilder.from).toHaveBeenCalled();
      expect(mockSubQueryBuilder.whereRaw).toHaveBeenCalled();
      expect(mockSubQueryBuilder.whereNull).toHaveBeenCalled();
    });
  });

  describe('findActiveByPhone', () => {
    it('should find an active user by phone number', async () => {
      const mockQueryBuilder = {
        modify: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereNotExists: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnThis(),
        whereILike: jest.fn().mockReturnThis(),
        withGraphFetched: jest.fn().mockResolvedValue(mockUser),
      };

      jest.spyOn(repository, 'query').mockReturnValue(mockQueryBuilder as any);

      const result = await repository.findActiveByPhone('+1234567890');

      expect(repository.query).toHaveBeenCalled();
      expect(mockQueryBuilder.modify).toHaveBeenCalledWith('notDeleted');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('status', UserStatus.ACTIVE);
      expect(mockQueryBuilder.whereNotExists).toHaveBeenCalled();
      expect(mockQueryBuilder.first).toHaveBeenCalled();
      expect(mockQueryBuilder.whereILike).toHaveBeenCalledWith('phone_number', '+1234567890');
      expect(mockQueryBuilder.withGraphFetched).toHaveBeenCalledWith('[country]');
      expect(result).toEqual(mockUser);
    });

    it('should return undefined when user not found by phone number', async () => {
      const mockQueryBuilder = {
        modify: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereNotExists: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnThis(),
        whereILike: jest.fn().mockReturnThis(),
        withGraphFetched: jest.fn().mockResolvedValue(undefined),
      };

      jest.spyOn(repository, 'query').mockReturnValue(mockQueryBuilder as any);

      const result = await repository.findActiveByPhone('+0000000000');

      expect(result).toBeUndefined();
    });

    it('should exclude users with account delete requests', async () => {
      const mockSubQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        whereRaw: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
      };

      const mockQueryBuilder = {
        modify: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereNotExists: jest.fn((callback) => {
          callback(mockSubQueryBuilder);
          return mockQueryBuilder;
        }),
        first: jest.fn().mockReturnThis(),
        whereILike: jest.fn().mockReturnThis(),
        withGraphFetched: jest.fn().mockResolvedValue(mockUser),
      };

      jest.spyOn(repository, 'query').mockReturnValue(mockQueryBuilder as any);

      await repository.findActiveByPhone('+1234567890');

      expect(mockQueryBuilder.whereNotExists).toHaveBeenCalledWith(expect.any(Function));
      expect(mockSubQueryBuilder.select).toHaveBeenCalledWith('*');
      expect(mockSubQueryBuilder.from).toHaveBeenCalled();
      expect(mockSubQueryBuilder.whereRaw).toHaveBeenCalled();
      expect(mockSubQueryBuilder.whereNull).toHaveBeenCalled();
    });
  });

  describe('findActiveById', () => {
    it('should find an active user by ID', async () => {
      const mockQueryBuilder = {
        modify: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereNotExists: jest.fn().mockReturnThis(),
        findById: jest.fn().mockReturnThis(),
        withGraphFetched: jest.fn().mockResolvedValue(mockUser),
      };

      jest.spyOn(repository, 'query').mockReturnValue(mockQueryBuilder as any);

      const result = await repository.findActiveById('user-123');

      expect(repository.query).toHaveBeenCalled();
      expect(mockQueryBuilder.modify).toHaveBeenCalledWith('notDeleted');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('status', UserStatus.ACTIVE);
      expect(mockQueryBuilder.whereNotExists).toHaveBeenCalled();
      expect(mockQueryBuilder.findById).toHaveBeenCalledWith('user-123');
      expect(mockQueryBuilder.withGraphFetched).toHaveBeenCalledWith('[country]');
      expect(result).toEqual(mockUser);
    });

    it('should return undefined when user not found by ID', async () => {
      const mockQueryBuilder = {
        modify: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereNotExists: jest.fn().mockReturnThis(),
        findById: jest.fn().mockReturnThis(),
        withGraphFetched: jest.fn().mockResolvedValue(undefined),
      };

      jest.spyOn(repository, 'query').mockReturnValue(mockQueryBuilder as any);

      const result = await repository.findActiveById('non-existent-id');

      expect(result).toBeUndefined();
    });

    it('should exclude soft-deleted users', async () => {
      const mockQueryBuilder = {
        modify: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereNotExists: jest.fn().mockReturnThis(),
        findById: jest.fn().mockReturnThis(),
        withGraphFetched: jest.fn().mockResolvedValue(mockUser),
      };

      jest.spyOn(repository, 'query').mockReturnValue(mockQueryBuilder as any);

      await repository.findActiveById('user-123');

      expect(mockQueryBuilder.modify).toHaveBeenCalledWith('notDeleted');
    });

    it('should only return users with ACTIVE status', async () => {
      const mockQueryBuilder = {
        modify: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereNotExists: jest.fn().mockReturnThis(),
        findById: jest.fn().mockReturnThis(),
        withGraphFetched: jest.fn().mockResolvedValue(mockUser),
      };

      jest.spyOn(repository, 'query').mockReturnValue(mockQueryBuilder as any);

      await repository.findActiveById('user-123');

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('status', UserStatus.ACTIVE);
    });

    it('should include country relation', async () => {
      const mockQueryBuilder = {
        modify: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereNotExists: jest.fn().mockReturnThis(),
        findById: jest.fn().mockReturnThis(),
        withGraphFetched: jest.fn().mockResolvedValue(mockUser),
      };

      jest.spyOn(repository, 'query').mockReturnValue(mockQueryBuilder as any);

      await repository.findActiveById('user-123');

      expect(mockQueryBuilder.withGraphFetched).toHaveBeenCalledWith('[country]');
    });

    it('should exclude users with account delete requests', async () => {
      const mockSubQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        whereRaw: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
      };

      const mockQueryBuilder = {
        modify: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereNotExists: jest.fn((callback) => {
          callback(mockSubQueryBuilder);
          return mockQueryBuilder;
        }),
        findById: jest.fn().mockReturnThis(),
        withGraphFetched: jest.fn().mockResolvedValue(mockUser),
      };

      jest.spyOn(repository, 'query').mockReturnValue(mockQueryBuilder as any);

      await repository.findActiveById('user-123');

      expect(mockQueryBuilder.whereNotExists).toHaveBeenCalledWith(expect.any(Function));
      expect(mockSubQueryBuilder.select).toHaveBeenCalledWith('*');
      expect(mockSubQueryBuilder.from).toHaveBeenCalled();
      expect(mockSubQueryBuilder.whereRaw).toHaveBeenCalled();
      expect(mockSubQueryBuilder.whereNull).toHaveBeenCalled();
    });
  });
});
