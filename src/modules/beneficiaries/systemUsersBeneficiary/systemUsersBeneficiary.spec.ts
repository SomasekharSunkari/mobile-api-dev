import { BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SystemUsersBeneficiaryModel, UserModel } from '../../../database/models';
import { AppLoggerService } from '../../../services/logger/logger.service';
import { UserRepository } from '../../auth/user/user.repository';
import { CreateSystemUsersBeneficiaryDto } from './dto/create-system-users-beneficiary.dto';
import { SystemUsersBeneficiaryController } from './systemUsersBeneficiary.controller';
import { SystemUsersBeneficiaryRepository } from './systemUsersBeneficiary.repository';
import { SystemUsersBeneficiaryService } from './systemUsersBeneficiary.service';

describe('SystemUsersBeneficiary Module', () => {
  let service: SystemUsersBeneficiaryService;
  let controller: SystemUsersBeneficiaryController;

  const mockUser: UserModel = {
    id: 'user-1',
    first_name: 'Test',
    last_name: 'User',
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashedPassword',
    is_email_verified: true,
    status: 'active',
    country_id: 'country-1',
    created_at: new Date(),
    updated_at: new Date(),
  } as UserModel;

  const mockBeneficiaryUser: UserModel = {
    id: 'user-2',
    first_name: 'Beneficiary',
    last_name: 'User',
    username: 'beneficiaryuser',
    email: 'beneficiary@example.com',
    password: 'hashedPassword',
    is_email_verified: true,
    status: 'active',
    country_id: 'country-1',
    created_at: new Date(),
    updated_at: new Date(),
  } as UserModel;

  const mockBeneficiary = {
    id: 'beneficiary-1',
    sender_user_id: 'user-1',
    beneficiary_user_id: 'user-2',
    alias_name: 'John Doe',
    created_at: new Date(),
    updated_at: new Date(),
    beneficiaryUser: mockBeneficiaryUser,
  } as unknown as SystemUsersBeneficiaryModel;

  const mockPaginatedResult = {
    system_users_beneficiaries: [mockBeneficiary],
    pagination: {
      current_page: 1,
      next_page: 0,
      previous_page: 0,
      limit: 20,
      page_count: 1,
      total: 1,
    },
  } as any;

  const mockRepository = {
    create: jest.fn(),
    findOne: jest.fn(),
    findSync: jest.fn(),
    paginateData: jest.fn(),
    delete: jest.fn(),
  };

  const mockUserRepository = {
    findSync: jest.fn(),
  };

  const mockAppLoggerService = {
    logInfo: jest.fn(),
    logError: jest.fn(),
    logUserAction: jest.fn(),
    setContext: jest.fn(),
    createChild: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SystemUsersBeneficiaryController],
      providers: [
        SystemUsersBeneficiaryService,
        {
          provide: SystemUsersBeneficiaryRepository,
          useValue: mockRepository,
        },
        {
          provide: UserRepository,
          useValue: mockUserRepository,
        },
        {
          provide: AppLoggerService,
          useValue: mockAppLoggerService,
        },
      ],
    }).compile();

    service = module.get<SystemUsersBeneficiaryService>(SystemUsersBeneficiaryService);
    controller = module.get<SystemUsersBeneficiaryController>(SystemUsersBeneficiaryController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Tests', () => {
    describe('create', () => {
      const createDto: CreateSystemUsersBeneficiaryDto = {
        beneficiary_user_id: 'user-2',
        alias_name: 'John Doe',
      };

      it('should create a beneficiary successfully', async () => {
        mockRepository.findOne.mockResolvedValue(null);
        mockRepository.create.mockResolvedValue(mockBeneficiary);

        const result = await service.create(mockUser, createDto);

        expect(mockRepository.findOne).toHaveBeenCalledWith({
          sender_user_id: mockUser.id,
          beneficiary_user_id: createDto.beneficiary_user_id,
        });
        expect(mockRepository.create).toHaveBeenCalledWith({
          sender_user_id: mockUser.id,
          beneficiary_user_id: createDto.beneficiary_user_id,
          alias_name: createDto.alias_name,
        });
        expect(result).toEqual(mockBeneficiary);
      });

      it('should throw BadRequestException when trying to add self as beneficiary', async () => {
        const selfDto: CreateSystemUsersBeneficiaryDto = {
          beneficiary_user_id: mockUser.id,
          alias_name: 'Self',
        };

        await expect(service.create(mockUser, selfDto)).rejects.toThrow(
          new BadRequestException('Cannot add yourself as a beneficiary'),
        );

        expect(mockRepository.findOne).not.toHaveBeenCalled();
        expect(mockRepository.create).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException when beneficiary already exists', async () => {
        mockRepository.findOne.mockResolvedValue(mockBeneficiary);

        await expect(service.create(mockUser, createDto)).rejects.toThrow(
          new BadRequestException('Beneficiary already exists'),
        );

        expect(mockRepository.findOne).toHaveBeenCalledWith({
          sender_user_id: mockUser.id,
          beneficiary_user_id: createDto.beneficiary_user_id,
        });
        expect(mockRepository.create).not.toHaveBeenCalled();
      });

      it('should create beneficiary without alias_name', async () => {
        const dtoWithoutAlias: CreateSystemUsersBeneficiaryDto = {
          beneficiary_user_id: 'user-2',
        };
        const expectedBeneficiary = { ...mockBeneficiary, alias_name: undefined };

        mockRepository.findOne.mockResolvedValue(null);
        mockRepository.create.mockResolvedValue(expectedBeneficiary);

        const result = await service.create(mockUser, dtoWithoutAlias);

        expect(mockRepository.create).toHaveBeenCalledWith({
          sender_user_id: mockUser.id,
          beneficiary_user_id: dtoWithoutAlias.beneficiary_user_id,
          alias_name: undefined,
        });
        expect(result).toEqual(expectedBeneficiary);
      });
    });

    describe('findAll', () => {
      it('should return paginated beneficiaries for user when no search term provided', async () => {
        const mockQuery = {
          whereNull: jest.fn().mockReturnThis(),
          withGraphFetched: jest.fn().mockReturnThis(),
          modifyGraph: jest.fn().mockReturnThis(),
        };

        mockRepository.findSync.mockReturnValue(mockQuery);
        mockRepository.paginateData.mockResolvedValue(mockPaginatedResult);

        const result = await service.findAll(mockUser);

        expect(mockRepository.findSync).toHaveBeenCalledWith({ sender_user_id: mockUser.id });
        expect(mockQuery.whereNull).toHaveBeenCalledWith(`${SystemUsersBeneficiaryModel.tableName}.deleted_at`);
        expect(mockQuery.withGraphFetched).toHaveBeenCalledWith('beneficiaryUser');
        expect(mockQuery.modifyGraph).toHaveBeenCalledWith('beneficiaryUser', expect.any(Function));
        expect(mockRepository.paginateData).toHaveBeenCalledWith(mockQuery, 10, 1);
        expect(result).toEqual(mockPaginatedResult);
      });

      it('should search all users in the system when search term is provided', async () => {
        const searchTerm = 'John';
        const mockSearchedUsers = [mockBeneficiaryUser];

        const mockUsersQuery = {
          where: jest.fn().mockReturnThis(),
          whereILike: jest.fn().mockReturnThis(),
          orWhereILike: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          clearOrder: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue(mockSearchedUsers),
        };

        mockUserRepository.findSync.mockReturnValue(mockUsersQuery);

        const result = await service.findAll(mockUser, searchTerm);

        expect(mockUserRepository.findSync).toHaveBeenCalledWith({});
        expect(mockUsersQuery.where).toHaveBeenCalledWith(`${UserModel.tableName}.id`, '!=', mockUser.id);
        expect(mockUsersQuery.where).toHaveBeenCalledWith(expect.any(Function));
        expect(mockUsersQuery.select).toHaveBeenCalledWith(UserModel.publicProperty());
        expect(mockUsersQuery.clearOrder).toHaveBeenCalled();
        expect(mockUsersQuery.orderBy).toHaveBeenCalledWith(`${UserModel.tableName}.updated_at`, 'desc');
        expect(mockUsersQuery.limit).toHaveBeenCalledWith(10);
        expect(result).toEqual({ users: mockSearchedUsers });
      });

      it('should exclude current user from search results', async () => {
        const searchTerm = 'Test';
        const mockSearchedUsers: UserModel[] = [];

        const mockUsersQuery = {
          where: jest.fn().mockReturnThis(),
          whereILike: jest.fn().mockReturnThis(),
          orWhereILike: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          clearOrder: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue(mockSearchedUsers),
        };

        mockUserRepository.findSync.mockReturnValue(mockUsersQuery);

        await service.findAll(mockUser, searchTerm);

        // Verify current user is excluded
        expect(mockUsersQuery.where).toHaveBeenCalledWith(`${UserModel.tableName}.id`, '!=', mockUser.id);
      });

      it('should return empty users array when no users match search term', async () => {
        const searchTerm = 'NonExistentUser';
        const mockSearchedUsers: UserModel[] = [];

        const mockUsersQuery = {
          where: jest.fn().mockReturnThis(),
          whereILike: jest.fn().mockReturnThis(),
          orWhereILike: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          clearOrder: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue(mockSearchedUsers),
        };

        mockUserRepository.findSync.mockReturnValue(mockUsersQuery);

        const result = await service.findAll(mockUser, searchTerm);

        expect(result).toEqual({ users: mockSearchedUsers });
      });
    });

    describe('findById', () => {
      it('should return beneficiary by id', async () => {
        const mockQuery = {
          whereNull: jest.fn().mockReturnThis(),
          modifyGraph: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(mockBeneficiary),
        };

        mockRepository.findSync.mockReturnValue(mockQuery);

        const result = await service.findById('beneficiary-1', mockUser);

        expect(mockRepository.findSync).toHaveBeenCalledWith(
          { id: 'beneficiary-1', sender_user_id: mockUser.id },
          {},
          { graphFetch: '[beneficiaryUser]' },
        );
        expect(mockQuery.whereNull).toHaveBeenCalledWith('deleted_at');
        expect(mockQuery.modifyGraph).toHaveBeenCalledWith('beneficiaryUser', expect.any(Function));
        expect(mockQuery.first).toHaveBeenCalled();
        expect(result).toEqual(mockBeneficiary);
      });

      it('should throw NotFoundException when beneficiary not found', async () => {
        const mockQuery = {
          whereNull: jest.fn().mockReturnThis(),
          modifyGraph: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(null),
        };

        mockRepository.findSync.mockReturnValue(mockQuery);

        await expect(service.findById('nonexistent-id', mockUser)).rejects.toThrow(
          new NotFoundException('Beneficiary not found'),
        );

        expect(mockRepository.findSync).toHaveBeenCalledWith(
          { id: 'nonexistent-id', sender_user_id: mockUser.id },
          {},
          { graphFetch: '[beneficiaryUser]' },
        );
        expect(mockQuery.whereNull).toHaveBeenCalledWith('deleted_at');
        expect(mockQuery.modifyGraph).toHaveBeenCalledWith('beneficiaryUser', expect.any(Function));
        expect(mockQuery.first).toHaveBeenCalled();
      });

      it('should throw NotFoundException when beneficiary belongs to different user', async () => {
        const otherUser = { ...mockUser, id: 'other-user' } as UserModel;
        const mockQuery = {
          whereNull: jest.fn().mockReturnThis(),
          modifyGraph: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(null),
        };

        mockRepository.findSync.mockReturnValue(mockQuery);

        await expect(service.findById('beneficiary-1', otherUser)).rejects.toThrow(
          new NotFoundException('Beneficiary not found'),
        );

        expect(mockRepository.findSync).toHaveBeenCalledWith(
          { id: 'beneficiary-1', sender_user_id: otherUser.id },
          {},
          { graphFetch: '[beneficiaryUser]' },
        );
        expect(mockQuery.whereNull).toHaveBeenCalledWith('deleted_at');
        expect(mockQuery.modifyGraph).toHaveBeenCalledWith('beneficiaryUser', expect.any(Function));
      });
    });

    describe('delete', () => {
      it('should soft delete beneficiary successfully', async () => {
        const mockQuery = {
          whereNull: jest.fn().mockReturnThis(),
          modifyGraph: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(mockBeneficiary),
        };

        mockRepository.findSync.mockReturnValue(mockQuery);
        mockRepository.delete.mockResolvedValue({});

        await service.delete('beneficiary-1', mockUser);

        expect(mockRepository.findSync).toHaveBeenCalledWith(
          { id: 'beneficiary-1', sender_user_id: mockUser.id },
          {},
          { graphFetch: '[beneficiaryUser]' },
        );
        expect(mockQuery.whereNull).toHaveBeenCalledWith('deleted_at');
        expect(mockQuery.modifyGraph).toHaveBeenCalledWith('beneficiaryUser', expect.any(Function));
        expect(mockRepository.delete).toHaveBeenCalledWith('beneficiary-1');
      });

      it('should throw NotFoundException when trying to delete non-existent beneficiary', async () => {
        const mockQuery = {
          whereNull: jest.fn().mockReturnThis(),
          modifyGraph: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(null),
        };

        mockRepository.findSync.mockReturnValue(mockQuery);

        await expect(service.delete('nonexistent-id', mockUser)).rejects.toThrow(
          new NotFoundException('Beneficiary not found'),
        );

        expect(mockQuery.whereNull).toHaveBeenCalledWith('deleted_at');
        expect(mockQuery.modifyGraph).toHaveBeenCalledWith('beneficiaryUser', expect.any(Function));
        expect(mockRepository.delete).not.toHaveBeenCalled();
      });
    });
  });

  describe('Controller Tests', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    describe('create', () => {
      const createDto: CreateSystemUsersBeneficiaryDto = {
        beneficiary_user_id: 'user-2',
        alias_name: 'John Doe',
      };

      it('should create a beneficiary successfully', async () => {
        jest.spyOn(service, 'create').mockResolvedValue(mockBeneficiary);

        const result = await controller.create(mockUser, createDto);

        expect(service.create).toHaveBeenCalledWith(mockUser, createDto);
        expect(result).toMatchObject({
          statusCode: HttpStatus.CREATED,
          message: 'Beneficiary added successfully',
          data: mockBeneficiary,
        });
      });

      it('should handle errors when creating a beneficiary', async () => {
        const error = new Error('Beneficiary already exists');
        jest.spyOn(service, 'create').mockRejectedValue(error);

        await expect(controller.create(mockUser, createDto)).rejects.toThrow(error);
        expect(service.create).toHaveBeenCalledWith(mockUser, createDto);
      });

      it('should handle beneficiary creation without alias name', async () => {
        const createDtoWithoutAlias: CreateSystemUsersBeneficiaryDto = {
          beneficiary_user_id: 'user-2',
        };
        const beneficiaryWithoutAlias = { ...mockBeneficiary, alias_name: null } as any;

        jest.spyOn(service, 'create').mockResolvedValue(beneficiaryWithoutAlias);

        const result = await controller.create(mockUser, createDtoWithoutAlias);

        expect(service.create).toHaveBeenCalledWith(mockUser, createDtoWithoutAlias);
        expect(result).toMatchObject({
          statusCode: HttpStatus.CREATED,
          message: 'Beneficiary added successfully',
          data: beneficiaryWithoutAlias,
        });
      });
    });

    describe('findAll', () => {
      it('should return all beneficiaries for the user when no search provided', async () => {
        jest.spyOn(service, 'findAll').mockResolvedValue(mockPaginatedResult);

        const result = await controller.findAll(mockUser, {});

        expect(service.findAll).toHaveBeenCalledWith(mockUser, undefined);
        expect(result).toMatchObject({
          statusCode: HttpStatus.OK,
          message: 'Beneficiaries fetched successfully',
          data: mockPaginatedResult,
        });
      });

      it('should return searched users when search term is provided', async () => {
        const searchResult = { users: [mockBeneficiaryUser] };
        jest.spyOn(service, 'findAll').mockResolvedValue(searchResult);

        const result = await controller.findAll(mockUser, { search: 'John' });

        expect(service.findAll).toHaveBeenCalledWith(mockUser, 'John');
        expect(result).toMatchObject({
          statusCode: HttpStatus.OK,
          message: 'Beneficiaries fetched successfully',
          data: searchResult,
        });
      });

      it('should handle errors when fetching beneficiaries', async () => {
        const error = new Error('Database error');
        jest.spyOn(service, 'findAll').mockRejectedValue(error);

        await expect(controller.findAll(mockUser, {})).rejects.toThrow(error);
        expect(service.findAll).toHaveBeenCalledWith(mockUser, undefined);
      });

      it('should handle empty beneficiary list', async () => {
        const emptyResult = {
          system_users_beneficiaries: [],
          pagination: {
            current_page: 1,
            next_page: 0,
            previous_page: 0,
            limit: 20,
            page_count: 0,
            total: 0,
          },
        } as any;

        jest.spyOn(service, 'findAll').mockResolvedValue(emptyResult);

        const result = await controller.findAll(mockUser, {});

        expect(service.findAll).toHaveBeenCalledWith(mockUser, undefined);
        expect(result).toMatchObject({
          statusCode: HttpStatus.OK,
          message: 'Beneficiaries fetched successfully',
          data: emptyResult,
        });
      });

      it('should handle empty search results', async () => {
        const emptySearchResult = { users: [] };
        jest.spyOn(service, 'findAll').mockResolvedValue(emptySearchResult);

        const result = await controller.findAll(mockUser, { search: 'NonExistent' });

        expect(service.findAll).toHaveBeenCalledWith(mockUser, 'NonExistent');
        expect(result).toMatchObject({
          statusCode: HttpStatus.OK,
          message: 'Beneficiaries fetched successfully',
          data: emptySearchResult,
        });
      });
    });

    describe('findOne', () => {
      const beneficiaryId = 'beneficiary-1';

      it('should return a beneficiary by id', async () => {
        jest.spyOn(service, 'findById').mockResolvedValue(mockBeneficiary);

        const result = await controller.findOne(mockUser, beneficiaryId);

        expect(service.findById).toHaveBeenCalledWith(beneficiaryId, mockUser);
        expect(result).toMatchObject({
          statusCode: HttpStatus.OK,
          message: 'Beneficiary fetched successfully',
          data: mockBeneficiary,
        });
      });

      it('should handle errors when fetching a beneficiary by id', async () => {
        const error = new Error('Beneficiary not found');
        jest.spyOn(service, 'findById').mockRejectedValue(error);

        await expect(controller.findOne(mockUser, beneficiaryId)).rejects.toThrow(error);
        expect(service.findById).toHaveBeenCalledWith(beneficiaryId, mockUser);
      });
    });

    describe('delete', () => {
      const beneficiaryId = 'beneficiary-1';

      it('should delete a beneficiary successfully', async () => {
        jest.spyOn(service, 'delete').mockResolvedValue(undefined);

        const result = await controller.delete(mockUser, beneficiaryId);

        expect(service.delete).toHaveBeenCalledWith(beneficiaryId, mockUser);
        expect(result).toMatchObject({
          statusCode: HttpStatus.OK,
          message: 'Beneficiary deleted successfully',
          data: null,
        });
      });

      it('should handle errors when deleting a beneficiary', async () => {
        const error = new Error('Beneficiary not found');
        jest.spyOn(service, 'delete').mockRejectedValue(error);

        await expect(controller.delete(mockUser, beneficiaryId)).rejects.toThrow(error);
        expect(service.delete).toHaveBeenCalledWith(beneficiaryId, mockUser);
      });
    });
  });

  describe('Integration Tests', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should handle complete beneficiary lifecycle', async () => {
      const createDto: CreateSystemUsersBeneficiaryDto = {
        beneficiary_user_id: 'user-2',
        alias_name: 'John Doe',
      };

      // Create beneficiary
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(mockBeneficiary);

      const createResult = await controller.create(mockUser, createDto);

      expect(createResult).toMatchObject({
        statusCode: HttpStatus.CREATED,
        message: 'Beneficiary added successfully',
        data: mockBeneficiary,
      });

      // Find all beneficiaries (without search)
      const mockQuery = {
        whereNull: jest.fn().mockReturnThis(),
        withGraphFetched: jest.fn().mockReturnThis(),
        modifyGraph: jest.fn().mockReturnThis(),
      };
      mockRepository.findSync.mockReturnValue(mockQuery);
      mockRepository.paginateData.mockResolvedValue(mockPaginatedResult);

      const findAllResult = await controller.findAll(mockUser, {});

      expect(findAllResult).toMatchObject({
        statusCode: HttpStatus.OK,
        message: 'Beneficiaries fetched successfully',
        data: mockPaginatedResult,
      });

      // Find specific beneficiary
      const mockFindQuery = {
        whereNull: jest.fn().mockReturnThis(),
        modifyGraph: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockBeneficiary),
      };
      mockRepository.findSync.mockReturnValue(mockFindQuery);

      const findOneResult = await controller.findOne(mockUser, mockBeneficiary.id);

      expect(findOneResult).toMatchObject({
        statusCode: HttpStatus.OK,
        message: 'Beneficiary fetched successfully',
        data: mockBeneficiary,
      });

      // Delete beneficiary
      mockRepository.delete.mockResolvedValue({});

      const deleteResult = await controller.delete(mockUser, mockBeneficiary.id);

      expect(deleteResult).toMatchObject({
        statusCode: HttpStatus.OK,
        message: 'Beneficiary deleted successfully',
        data: null,
      });
    });

    it('should handle validation errors consistently across service and controller', async () => {
      const selfDto: CreateSystemUsersBeneficiaryDto = {
        beneficiary_user_id: mockUser.id,
        alias_name: 'Self',
      };

      // Both service and controller should handle self-beneficiary error
      await expect(service.create(mockUser, selfDto)).rejects.toThrow(
        new BadRequestException('Cannot add yourself as a beneficiary'),
      );

      await expect(controller.create(mockUser, selfDto)).rejects.toThrow(
        new BadRequestException('Cannot add yourself as a beneficiary'),
      );
    });
  });
});
