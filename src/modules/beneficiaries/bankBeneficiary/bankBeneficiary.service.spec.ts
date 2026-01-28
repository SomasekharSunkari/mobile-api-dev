import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BankBeneficiaryModel, UserModel } from '../../../database/models';
import { BankBeneficiaryRepository } from './bankBeneficiary.repository';
import { BankBeneficiaryService } from './bankBeneficiary.service';
import { CreateBankBeneficiaryDto } from './dto/create-bank-beneficiary.dto';

describe('BankBeneficiaryService', () => {
  let service: BankBeneficiaryService;

  const mockUser = {
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

  const mockBeneficiary = {
    id: 'bank-beneficiary-1',
    user_id: 'user-1',
    currency: 'USD',
    alias_name: 'Mum Savings',
    account_number: '1234567890',
    created_at: new Date(),
    updated_at: new Date(),
  } as unknown as BankBeneficiaryModel;

  const mockRepository = {
    create: jest.fn(),
    findSync: jest.fn(),
    findOne: jest.fn(),
    paginateData: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BankBeneficiaryService,
        {
          provide: BankBeneficiaryRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<BankBeneficiaryService>(BankBeneficiaryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateBankBeneficiaryDto = {
      currency: 'USD',
      alias_name: 'Mum Savings',
      account_number: '1234567890',
      bank_ref: 'ABC123',
    };

    it('should create a bank beneficiary successfully', async () => {
      mockRepository.findOne.mockResolvedValue(null); // No existing beneficiary
      mockRepository.create.mockResolvedValue(mockBeneficiary);

      const result = await service.create(mockUser, createDto);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        user_id: mockUser.id,
        account_number: createDto.account_number,
        bank_ref: createDto.bank_ref,
      });
      expect(mockRepository.create).toHaveBeenCalledWith({
        user_id: mockUser.id,
        ...createDto,
      });
      expect(result).toEqual(mockBeneficiary);
    });
  });

  describe('findAll', () => {
    it('should return the last 10 bank beneficiaries for the user', async () => {
      const mockQuery = {
        joinRelated: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
      };
      const mockPaginatedResult = {
        bank_beneficiaries: [mockBeneficiary],
        pagination: {
          current_page: 1,
          next_page: 0,
          previous_page: 0,
          limit: 10,
          page_count: 1,
          total: 1,
        },
      };

      mockRepository.findSync.mockReturnValue(mockQuery);
      mockRepository.paginateData.mockResolvedValue(mockPaginatedResult);

      const result = await service.findAll(mockUser, {});

      expect(mockRepository.findSync).toHaveBeenCalledWith({ user_id: mockUser.id });
      expect(mockRepository.paginateData).toHaveBeenCalledWith(mockQuery, 10, 1);
      expect(result).toEqual(mockPaginatedResult);
    });

    it('should search bank beneficiaries by search query including user fields', async () => {
      const mockQuery = {
        joinRelated: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
      };
      const mockPaginatedResult = {
        bank_beneficiaries: [mockBeneficiary],
        pagination: {
          current_page: 1,
          next_page: 0,
          previous_page: 0,
          limit: 10,
          page_count: 1,
          total: 1,
        },
      };

      mockRepository.findSync.mockReturnValue(mockQuery);
      mockRepository.paginateData.mockResolvedValue(mockPaginatedResult);

      const result = await service.findAll(mockUser, { search: 'test' });

      expect(mockRepository.findSync).toHaveBeenCalledWith({ user_id: mockUser.id });
      expect(mockQuery.joinRelated).toHaveBeenCalledWith('user');
      expect(mockQuery.where).toHaveBeenCalled();
      expect(mockRepository.paginateData).toHaveBeenCalledWith(mockQuery, 10, 1);
      expect(result).toEqual(mockPaginatedResult);
    });
  });

  describe('findById', () => {
    it('should return bank beneficiary by id', async () => {
      mockRepository.findOne.mockResolvedValue(mockBeneficiary);

      const result = await service.findById('bank-beneficiary-1', mockUser);

      expect(mockRepository.findOne).toHaveBeenCalledWith({ id: 'bank-beneficiary-1', user_id: mockUser.id });
      expect(result).toEqual(mockBeneficiary);
    });

    it('should throw NotFoundException when bank beneficiary not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('nonexistent-id', mockUser)).rejects.toThrow(
        new NotFoundException('Beneficiary not found'),
      );

      expect(mockRepository.findOne).toHaveBeenCalledWith({ id: 'nonexistent-id', user_id: mockUser.id });
    });
  });

  describe('delete', () => {
    it('should delete bank beneficiary successfully', async () => {
      mockRepository.findOne.mockResolvedValue(mockBeneficiary);
      mockRepository.delete.mockResolvedValue({});

      await service.delete('bank-beneficiary-1', mockUser);

      expect(mockRepository.findOne).toHaveBeenCalledWith({ id: 'bank-beneficiary-1', user_id: mockUser.id });
      expect(mockRepository.delete).toHaveBeenCalledWith('bank-beneficiary-1');
    });

    it('should throw NotFoundException when trying to delete non-existent bank beneficiary', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.delete('nonexistent-id', mockUser)).rejects.toThrow(
        new NotFoundException('Beneficiary not found'),
      );

      expect(mockRepository.delete).not.toHaveBeenCalled();
    });
  });
});
