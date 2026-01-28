import { BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainBeneficiaryModel, UserModel } from '../../../database/models';
import { AppLoggerService } from '../../../services/logger/logger.service';
import { UserRepository } from '../../auth/user/user.repository';
import { BlockchainBeneficiaryController } from './blockchainBeneficiary.controller';
import { BlockchainBeneficiaryRepository } from './blockchainBeneficiary.repository';
import { BlockchainBeneficiaryService } from './blockchainBeneficiary.service';
import { CreateBlockchainBeneficiaryDto } from './dto/create-blockchain-beneficiary.dto';

describe('BlockchainBeneficiary Module', () => {
  let service: BlockchainBeneficiaryService;
  let controller: BlockchainBeneficiaryController;

  const mockUser: UserModel = {
    id: 'user-1',
    first_name: 'Test',
    last_name: 'User',
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashedPassword',
    is_email_verified: true,
    status: 'active',
    is_deactivated: false,
    country_id: 'country-1',
    userRoles: [],
    created_at: new Date(),
    updated_at: new Date(),
  } as UserModel;

  const mockBeneficiaryUser: UserModel = {
    id: 'beneficiary-user-1',
    first_name: 'Beneficiary',
    last_name: 'User',
    username: 'beneficiaryuser',
    email: 'beneficiary@example.com',
    password: 'hashedPassword',
    is_email_verified: true,
    status: 'active',
    is_deactivated: false,
    country_id: 'country-1',
    userRoles: [],
    created_at: new Date(),
    updated_at: new Date(),
  } as UserModel;

  const mockBeneficiary = {
    id: 'beneficiary-1',
    user_id: 'user-1',
    beneficiary_user_id: 'beneficiary-user-1',
    alias_name: 'My Primary Wallet',
    asset: 'USDC',
    address: '0x1234567890abcdef1234567890abcdef12345678',
    network: 'ethereum',
    avatar_url: null,
    created_at: new Date(),
    updated_at: new Date(),
    user: mockUser,
  } as unknown as BlockchainBeneficiaryModel;

  const mockPaginatedResult = {
    blockchain_beneficiaries: [mockBeneficiary],
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
    findSync: jest.fn(),
    findOne: jest.fn(),
    paginateData: jest.fn(),
    delete: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
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
      controllers: [BlockchainBeneficiaryController],
      providers: [
        BlockchainBeneficiaryService,
        {
          provide: BlockchainBeneficiaryRepository,
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

    service = module.get<BlockchainBeneficiaryService>(BlockchainBeneficiaryService);
    controller = module.get<BlockchainBeneficiaryController>(BlockchainBeneficiaryController);
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockRepository.findSync.mockClear();
    mockRepository.findOne.mockClear();
    mockRepository.create.mockClear();
    mockRepository.paginateData.mockClear();
    mockRepository.delete.mockClear();
    mockUserRepository.findOne.mockClear();
  });

  describe('Service Tests', () => {
    describe('create', () => {
      const createDto: CreateBlockchainBeneficiaryDto = {
        beneficiary_user_id: 'beneficiary-user-1',
        alias_name: 'My Primary Wallet',
        asset: 'USDC',
        address: '0x1234567890abcdef1234567890abcdef12345678',
        network: 'ethereum',
      };

      it('should create a blockchain beneficiary successfully', async () => {
        mockRepository.findOne.mockResolvedValue(null);
        mockUserRepository.findOne.mockResolvedValue(mockBeneficiaryUser);
        mockRepository.create.mockResolvedValue(mockBeneficiary);

        const result = await service.create(mockUser, createDto);

        expect(mockRepository.findOne).toHaveBeenCalledWith({
          user_id: mockUser.id,
          beneficiary_user_id: createDto.beneficiary_user_id,
          address: createDto.address,
          network: createDto.network,
        });
        expect(mockUserRepository.findOne).toHaveBeenCalledWith({ id: createDto.beneficiary_user_id });
        expect(mockRepository.create).toHaveBeenCalledWith({
          user_id: mockUser.id,
          ...createDto,
          beneficiary_user_id: mockBeneficiaryUser.id,
        });
        expect(result).toEqual(mockBeneficiary);
      });

      it('should throw BadRequestException when beneficiary already exists', async () => {
        mockRepository.findOne.mockResolvedValue(mockBeneficiary);

        await expect(service.create(mockUser, createDto)).rejects.toThrow(
          new BadRequestException('Beneficiary already exists'),
        );

        expect(mockRepository.findOne).toHaveBeenCalledWith({
          user_id: mockUser.id,
          beneficiary_user_id: createDto.beneficiary_user_id,
          address: createDto.address,
          network: createDto.network,
        });
        expect(mockRepository.create).not.toHaveBeenCalled();
      });

      it('should create beneficiary with different network for same address', async () => {
        const createDtoPolygon: CreateBlockchainBeneficiaryDto = {
          beneficiary_user_id: 'beneficiary-user-2',
          alias_name: 'My Polygon Wallet',
          asset: 'USDC',
          address: '0x1234567890abcdef1234567890abcdef12345678',
          network: 'polygon',
        };
        const mockBeneficiaryPolygon = {
          ...mockBeneficiary,
          beneficiary_user_id: 'beneficiary-user-2',
          alias_name: 'My Polygon Wallet',
          network: 'polygon',
        };

        const mockBeneficiaryUser2: UserModel = {
          ...mockBeneficiaryUser,
          id: 'beneficiary-user-2',
        } as UserModel;
        mockRepository.findOne.mockResolvedValue(null);
        mockUserRepository.findOne.mockResolvedValue(mockBeneficiaryUser2);
        mockRepository.create.mockResolvedValue(mockBeneficiaryPolygon);

        const result = await service.create(mockUser, createDtoPolygon);

        expect(mockRepository.findOne).toHaveBeenCalledWith({
          user_id: mockUser.id,
          beneficiary_user_id: createDtoPolygon.beneficiary_user_id,
          address: createDtoPolygon.address,
          network: createDtoPolygon.network,
        });
        expect(mockRepository.create).toHaveBeenCalledWith({
          user_id: mockUser.id,
          ...createDtoPolygon,
          beneficiary_user_id: mockBeneficiaryUser2.id,
        });
        expect(result).toEqual(mockBeneficiaryPolygon);
      });
    });

    describe('findAll', () => {
      it('should return paginated blockchain beneficiaries for user', async () => {
        const mockQuery = {
          withGraphFetched: jest.fn().mockReturnThis(),
          modifyGraph: jest.fn().mockReturnThis(),
        };
        mockRepository.findSync.mockReturnValue(mockQuery);
        mockRepository.paginateData.mockResolvedValue(mockPaginatedResult);

        const result = await service.findAll(mockUser);

        expect(mockRepository.findSync).toHaveBeenCalledWith({ user_id: mockUser.id });
        expect(mockQuery.withGraphFetched).toHaveBeenCalledWith('beneficiaryUser');
        expect(mockQuery.modifyGraph).toHaveBeenCalled();
        expect(mockRepository.paginateData).toHaveBeenCalledWith(mockQuery, 10, 1);
        expect(result).toEqual(mockPaginatedResult);
      });

      it('should return paginated blockchain beneficiaries with search filter', async () => {
        const mockQuery = {
          joinRelated: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          withGraphFetched: jest.fn().mockReturnThis(),
          modifyGraph: jest.fn().mockReturnThis(),
        };
        mockRepository.findSync.mockReturnValue(mockQuery);
        mockRepository.paginateData.mockResolvedValue(mockPaginatedResult);

        const searchTerm = 'Primary';
        const result = await service.findAll(mockUser, searchTerm);

        expect(mockRepository.findSync).toHaveBeenCalledWith({ user_id: mockUser.id });
        expect(mockQuery.joinRelated).toHaveBeenCalledWith('beneficiaryUser');
        expect(mockQuery.where).toHaveBeenCalled();
        expect(mockQuery.withGraphFetched).toHaveBeenCalledWith('beneficiaryUser');
        expect(mockQuery.modifyGraph).toHaveBeenCalled();
        expect(mockRepository.paginateData).toHaveBeenCalledWith(mockQuery, 10, 1);
        expect(result).toEqual(mockPaginatedResult);
      });
    });

    describe('findById', () => {
      it('should return blockchain beneficiary by id', async () => {
        mockRepository.findOne.mockResolvedValue(mockBeneficiary);

        const result = await service.findById('beneficiary-1', mockUser);

        expect(mockRepository.findOne).toHaveBeenCalledWith({
          id: 'beneficiary-1',
          user_id: mockUser.id,
        });
        expect(result).toEqual(mockBeneficiary);
      });

      it('should throw NotFoundException when beneficiary not found', async () => {
        mockRepository.findOne.mockResolvedValue(null);

        await expect(service.findById('nonexistent-id', mockUser)).rejects.toThrow(
          new NotFoundException('Beneficiary not found'),
        );

        expect(mockRepository.findOne).toHaveBeenCalledWith({
          id: 'nonexistent-id',
          user_id: mockUser.id,
        });
      });

      it('should throw NotFoundException when beneficiary belongs to different user', async () => {
        const otherUser = { ...mockUser, id: 'other-user' } as UserModel;
        mockRepository.findOne.mockResolvedValue(null);

        await expect(service.findById('beneficiary-1', otherUser)).rejects.toThrow(
          new NotFoundException('Beneficiary not found'),
        );

        expect(mockRepository.findOne).toHaveBeenCalledWith({
          id: 'beneficiary-1',
          user_id: otherUser.id,
        });
      });
    });

    describe('delete', () => {
      it('should soft delete blockchain beneficiary successfully', async () => {
        mockRepository.findOne.mockResolvedValue(mockBeneficiary);
        mockRepository.delete.mockResolvedValue({});

        await service.delete('beneficiary-1', mockUser);

        expect(mockRepository.findOne).toHaveBeenCalledWith({
          id: 'beneficiary-1',
          user_id: mockUser.id,
        });
        expect(mockRepository.delete).toHaveBeenCalledWith('beneficiary-1');
      });

      it('should throw NotFoundException when trying to delete non-existent beneficiary', async () => {
        mockRepository.findOne.mockResolvedValue(null);

        await expect(service.delete('nonexistent-id', mockUser)).rejects.toThrow(
          new NotFoundException('Beneficiary not found'),
        );

        expect(mockRepository.delete).not.toHaveBeenCalled();
      });
    });
  });

  describe('Controller Tests', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    describe('create', () => {
      const createDto: CreateBlockchainBeneficiaryDto = {
        beneficiary_user_id: 'beneficiary-user-1',
        alias_name: 'My Primary Wallet',
        asset: 'USDC',
        address: '0x1234567890abcdef1234567890abcdef12345678',
        network: 'ethereum',
      };

      it('should create a blockchain beneficiary successfully', async () => {
        jest.spyOn(service, 'create').mockResolvedValue(mockBeneficiary);

        const result = await controller.create(mockUser, createDto);

        expect(service.create).toHaveBeenCalledWith(mockUser, createDto);
        expect(result).toMatchObject({
          statusCode: HttpStatus.CREATED,
          message: 'Blockchain beneficiary added successfully',
          data: mockBeneficiary,
        });
      });

      it('should handle errors when creating a blockchain beneficiary', async () => {
        const error = new BadRequestException('Beneficiary already exists');
        jest.spyOn(service, 'create').mockRejectedValue(error);

        await expect(controller.create(mockUser, createDto)).rejects.toThrow(error);
        expect(service.create).toHaveBeenCalledWith(mockUser, createDto);
      });

      it('should create beneficiary with different asset types', async () => {
        const createDtoBitcoin: CreateBlockchainBeneficiaryDto = {
          beneficiary_user_id: 'beneficiary-user-3',
          alias_name: 'My Bitcoin Wallet',
          asset: 'BTC',
          address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
          network: 'bitcoin',
        };
        const mockBitcoinBeneficiary = {
          ...mockBeneficiary,
          beneficiary_user_id: 'beneficiary-user-3',
          alias_name: 'My Bitcoin Wallet',
          asset: 'BTC',
          address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
          network: 'bitcoin',
        };

        jest.spyOn(service, 'create').mockResolvedValue(mockBitcoinBeneficiary as any);

        const result = await controller.create(mockUser, createDtoBitcoin);

        expect(service.create).toHaveBeenCalledWith(mockUser, createDtoBitcoin);
        expect(result).toMatchObject({
          statusCode: HttpStatus.CREATED,
          message: 'Blockchain beneficiary added successfully',
          data: mockBitcoinBeneficiary,
        });
      });
    });

    describe('findAll', () => {
      it('should return all blockchain beneficiaries for the user', async () => {
        jest.spyOn(service, 'findAll').mockResolvedValue(mockPaginatedResult);

        const result = await controller.findAll(mockUser);

        expect(service.findAll).toHaveBeenCalledWith(mockUser, undefined);
        expect(result).toMatchObject({
          statusCode: HttpStatus.OK,
          message: 'Blockchain beneficiaries fetched successfully',
          data: mockPaginatedResult,
        });
      });

      it('should handle errors when fetching blockchain beneficiaries', async () => {
        const error = new Error('Database error');
        jest.spyOn(service, 'findAll').mockRejectedValue(error);

        await expect(controller.findAll(mockUser)).rejects.toThrow(error);
        expect(service.findAll).toHaveBeenCalledWith(mockUser, undefined);
      });

      it('should handle empty blockchain beneficiary list', async () => {
        const emptyResult = {
          blockchain_beneficiaries: [],
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

        const result = await controller.findAll(mockUser);

        expect(service.findAll).toHaveBeenCalledWith(mockUser, undefined);
        expect(result).toMatchObject({
          statusCode: HttpStatus.OK,
          message: 'Blockchain beneficiaries fetched successfully',
          data: emptyResult,
        });
      });
    });

    describe('findOne', () => {
      const beneficiaryId = 'beneficiary-1';

      it('should return a blockchain beneficiary by id', async () => {
        jest.spyOn(service, 'findById').mockResolvedValue(mockBeneficiary);

        const result = await controller.findOne(mockUser, beneficiaryId);

        expect(service.findById).toHaveBeenCalledWith(beneficiaryId, mockUser);
        expect(result).toMatchObject({
          statusCode: HttpStatus.OK,
          message: 'Blockchain beneficiary fetched successfully',
          data: mockBeneficiary,
        });
      });

      it('should handle errors when fetching a blockchain beneficiary by id', async () => {
        const error = new NotFoundException('Beneficiary not found');
        jest.spyOn(service, 'findById').mockRejectedValue(error);

        await expect(controller.findOne(mockUser, beneficiaryId)).rejects.toThrow(error);
        expect(service.findById).toHaveBeenCalledWith(beneficiaryId, mockUser);
      });
    });

    describe('delete', () => {
      const beneficiaryId = 'beneficiary-1';

      it('should delete a blockchain beneficiary successfully', async () => {
        jest.spyOn(service, 'delete').mockResolvedValue(undefined);

        const result = await controller.delete(mockUser, beneficiaryId);

        expect(service.delete).toHaveBeenCalledWith(beneficiaryId, mockUser);
        expect(result).toMatchObject({
          statusCode: HttpStatus.OK,
          message: 'Blockchain beneficiary deleted successfully',
          data: null,
        });
      });

      it('should handle errors when deleting a blockchain beneficiary', async () => {
        const error = new NotFoundException('Beneficiary not found');
        jest.spyOn(service, 'delete').mockRejectedValue(error);

        await expect(controller.delete(mockUser, beneficiaryId)).rejects.toThrow(error);
        expect(service.delete).toHaveBeenCalledWith(beneficiaryId, mockUser);
      });
    });
  });

  describe('Integration Tests', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockRepository.findSync.mockClear();
      mockRepository.findOne.mockClear();
      mockRepository.create.mockClear();
      mockRepository.paginateData.mockClear();
      mockRepository.delete.mockClear();
      mockUserRepository.findOne.mockClear();
    });

    it('should handle complete blockchain beneficiary lifecycle', async () => {
      const createDto: CreateBlockchainBeneficiaryDto = {
        beneficiary_user_id: 'beneficiary-user-1',
        alias_name: 'My Primary Wallet',
        asset: 'USDC',
        address: '0x1234567890abcdef1234567890abcdef12345678',
        network: 'ethereum',
      };

      // Create beneficiary
      mockRepository.findOne.mockResolvedValueOnce(null);
      mockUserRepository.findOne.mockResolvedValueOnce(mockBeneficiaryUser);
      mockRepository.create.mockResolvedValueOnce(mockBeneficiary);

      const createResult = await controller.create(mockUser, createDto);

      expect(createResult).toMatchObject({
        statusCode: HttpStatus.CREATED,
        message: 'Blockchain beneficiary added successfully',
        data: mockBeneficiary,
      });

      // Find all beneficiaries
      const mockListQuery = {
        withGraphFetched: jest.fn().mockReturnThis(),
        modifyGraph: jest.fn().mockReturnThis(),
      };
      mockRepository.findSync.mockReturnValue(mockListQuery);
      mockRepository.paginateData.mockResolvedValue(mockPaginatedResult);

      const findAllResult = await controller.findAll(mockUser);

      expect(findAllResult).toMatchObject({
        statusCode: HttpStatus.OK,
        message: 'Blockchain beneficiaries fetched successfully',
        data: mockPaginatedResult,
      });

      // Find specific beneficiary
      mockRepository.findOne.mockResolvedValueOnce(mockBeneficiary);

      const findOneResult = await controller.findOne(mockUser, mockBeneficiary.id);

      expect(findOneResult).toMatchObject({
        statusCode: HttpStatus.OK,
        message: 'Blockchain beneficiary fetched successfully',
        data: mockBeneficiary,
      });

      // Delete beneficiary
      mockRepository.findOne.mockResolvedValueOnce(mockBeneficiary);
      mockRepository.delete.mockResolvedValueOnce({});

      const deleteResult = await controller.delete(mockUser, mockBeneficiary.id);

      expect(deleteResult).toMatchObject({
        statusCode: HttpStatus.OK,
        message: 'Blockchain beneficiary deleted successfully',
        data: null,
      });
    });

    it('should handle validation errors consistently across service and controller', async () => {
      const duplicateDto: CreateBlockchainBeneficiaryDto = {
        beneficiary_user_id: 'beneficiary-user-1',
        alias_name: 'My Primary Wallet',
        asset: 'USDC',
        address: '0x1234567890abcdef1234567890abcdef12345678',
        network: 'ethereum',
      };

      mockRepository.findOne.mockResolvedValue(mockBeneficiary);

      // Both service and controller should handle duplicate beneficiary error
      await expect(service.create(mockUser, duplicateDto)).rejects.toThrow(
        new BadRequestException('Beneficiary already exists'),
      );

      await expect(controller.create(mockUser, duplicateDto)).rejects.toThrow(
        new BadRequestException('Beneficiary already exists'),
      );
    });

    it('should handle multiple blockchain networks correctly', async () => {
      const ethereumDto: CreateBlockchainBeneficiaryDto = {
        beneficiary_user_id: 'beneficiary-user-4',
        alias_name: 'My Ethereum Wallet',
        asset: 'USDC',
        address: '0x1234567890abcdef1234567890abcdef12345678',
        network: 'ethereum',
      };

      const polygonDto: CreateBlockchainBeneficiaryDto = {
        beneficiary_user_id: 'beneficiary-user-5',
        alias_name: 'My Polygon Wallet',
        asset: 'USDC',
        address: '0x1234567890abcdef1234567890abcdef12345678',
        network: 'polygon',
      };

      // Create mock users for the different networks
      const mockBeneficiaryUser4: UserModel = {
        ...mockBeneficiaryUser,
        id: 'beneficiary-user-4',
      } as UserModel;

      const mockBeneficiaryUser5: UserModel = {
        ...mockBeneficiaryUser,
        id: 'beneficiary-user-5',
      } as UserModel;
      // Same address on different networks should be allowed

      // Mock for Ethereum creation
      mockRepository.findOne.mockResolvedValueOnce(null);
      mockUserRepository.findOne.mockResolvedValueOnce(mockBeneficiaryUser4);
      mockRepository.create.mockResolvedValueOnce(mockBeneficiary);

      // Create on Ethereum
      await expect(service.create(mockUser, ethereumDto)).resolves.toEqual(mockBeneficiary);

      // Mock for Polygon creation
      mockRepository.findOne.mockResolvedValueOnce(null);
      mockUserRepository.findOne.mockResolvedValueOnce(mockBeneficiaryUser5);
      mockRepository.create.mockResolvedValueOnce(mockBeneficiary);

      // Create on Polygon (same address, different network)
      await expect(service.create(mockUser, polygonDto)).resolves.toEqual(mockBeneficiary);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        user_id: mockUser.id,
        beneficiary_user_id: ethereumDto.beneficiary_user_id,
        address: ethereumDto.address,
        network: ethereumDto.network,
      });

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        user_id: mockUser.id,
        beneficiary_user_id: polygonDto.beneficiary_user_id,
        address: polygonDto.address,
        network: polygonDto.network,
      });
    });
  });
});
