import { HttpStatus, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FetchQuery } from '../../../database';
import { BankBeneficiaryModel, UserModel } from '../../../database/models';
import { BankBeneficiaryController } from './bankBeneficiary.controller';
import { BankBeneficiaryService } from './bankBeneficiary.service';
import { CreateBankBeneficiaryDto } from './dto/create-bank-beneficiary.dto';

describe('BankBeneficiaryController', () => {
  let controller: BankBeneficiaryController;
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
    bank_code: 'ABC123',
    created_at: new Date(),
    updated_at: new Date(),
  } as unknown as BankBeneficiaryModel;

  const mockBankBeneficiaryService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BankBeneficiaryController],
      providers: [
        {
          provide: BankBeneficiaryService,
          useValue: mockBankBeneficiaryService,
        },
      ],
    }).compile();

    controller = module.get<BankBeneficiaryController>(BankBeneficiaryController);
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
      bank_code: 'ABC123',
    };

    it('should create a bank beneficiary successfully', async () => {
      mockBankBeneficiaryService.create.mockResolvedValue(mockBeneficiary);

      const result = await controller.create(mockUser, createDto);

      expect(service.create).toHaveBeenCalledWith(mockUser, createDto);
      expect(result).toMatchObject({
        message: 'Bank beneficiary added successfully',
        data: mockBeneficiary,
        statusCode: HttpStatus.CREATED,
      });
      expect(result).toHaveProperty('timestamp');
    });

    it('should handle service errors gracefully', async () => {
      mockBankBeneficiaryService.create.mockRejectedValue(new Error('Creation failed'));

      await expect(controller.create(mockUser, createDto)).rejects.toThrow('Creation failed');
      expect(service.create).toHaveBeenCalledWith(mockUser, createDto);
    });
  });

  describe('findAll', () => {
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

    it('should return all bank beneficiaries for the user', async () => {
      const query: FetchQuery = {};
      mockBankBeneficiaryService.findAll.mockResolvedValue(mockPaginatedResult);

      const result = await controller.findAll(mockUser, query);

      expect(service.findAll).toHaveBeenCalledWith(mockUser, query);
      expect(result).toMatchObject({
        message: 'Bank beneficiaries fetched successfully',
        data: mockPaginatedResult,
        statusCode: HttpStatus.OK,
      });
      expect(result).toHaveProperty('timestamp');
    });

    it('should return bank beneficiaries with search query', async () => {
      const query: FetchQuery = { search: 'Mum' };
      mockBankBeneficiaryService.findAll.mockResolvedValue(mockPaginatedResult);

      const result = await controller.findAll(mockUser, query);

      expect(service.findAll).toHaveBeenCalledWith(mockUser, query);
      expect(result).toMatchObject({
        message: 'Bank beneficiaries fetched successfully',
        data: mockPaginatedResult,
        statusCode: HttpStatus.OK,
      });
      expect(result).toHaveProperty('timestamp');
    });

    it('should return empty list when user has no beneficiaries', async () => {
      const emptyResult = {
        bank_beneficiaries: [],
        pagination: {
          current_page: 1,
          next_page: 0,
          previous_page: 0,
          limit: 10,
          page_count: 0,
          total: 0,
        },
      };
      const query: FetchQuery = {};
      mockBankBeneficiaryService.findAll.mockResolvedValue(emptyResult);

      const result = await controller.findAll(mockUser, query);

      expect(service.findAll).toHaveBeenCalledWith(mockUser, query);
      expect(result).toMatchObject({
        message: 'Bank beneficiaries fetched successfully',
        data: emptyResult,
        statusCode: HttpStatus.OK,
      });
      expect(result).toHaveProperty('timestamp');
    });

    it('should handle service errors gracefully', async () => {
      const query: FetchQuery = {};
      mockBankBeneficiaryService.findAll.mockRejectedValue(new Error('Fetch failed'));

      await expect(controller.findAll(mockUser, query)).rejects.toThrow('Fetch failed');
      expect(service.findAll).toHaveBeenCalledWith(mockUser, query);
    });
  });

  describe('findOne', () => {
    it('should return a bank beneficiary by id', async () => {
      mockBankBeneficiaryService.findById.mockResolvedValue(mockBeneficiary);

      const result = await controller.findOne(mockUser, 'bank-beneficiary-1');

      expect(service.findById).toHaveBeenCalledWith('bank-beneficiary-1', mockUser);
      expect(result).toMatchObject({
        message: 'Bank beneficiary fetched successfully',
        data: mockBeneficiary,
        statusCode: HttpStatus.OK,
      });
      expect(result).toHaveProperty('timestamp');
    });

    it('should throw NotFoundException when beneficiary not found', async () => {
      mockBankBeneficiaryService.findById.mockRejectedValue(new NotFoundException('Beneficiary not found'));

      await expect(controller.findOne(mockUser, 'nonexistent-id')).rejects.toThrow(NotFoundException);
      expect(service.findById).toHaveBeenCalledWith('nonexistent-id', mockUser);
    });

    it('should handle service errors gracefully', async () => {
      mockBankBeneficiaryService.findById.mockRejectedValue(new Error('Database error'));

      await expect(controller.findOne(mockUser, 'bank-beneficiary-1')).rejects.toThrow('Database error');
      expect(service.findById).toHaveBeenCalledWith('bank-beneficiary-1', mockUser);
    });
  });

  describe('delete', () => {
    it('should delete a bank beneficiary successfully', async () => {
      mockBankBeneficiaryService.delete.mockResolvedValue(undefined);

      const result = await controller.delete(mockUser, 'bank-beneficiary-1');

      expect(service.delete).toHaveBeenCalledWith('bank-beneficiary-1', mockUser);
      expect(result).toMatchObject({
        message: 'Bank beneficiary deleted successfully',
        data: null,
        statusCode: HttpStatus.OK,
      });
      expect(result).toHaveProperty('timestamp');
    });

    it('should throw NotFoundException when trying to delete non-existent beneficiary', async () => {
      mockBankBeneficiaryService.delete.mockRejectedValue(new NotFoundException('Beneficiary not found'));

      await expect(controller.delete(mockUser, 'nonexistent-id')).rejects.toThrow(NotFoundException);
      expect(service.delete).toHaveBeenCalledWith('nonexistent-id', mockUser);
    });

    it('should handle service errors gracefully', async () => {
      mockBankBeneficiaryService.delete.mockRejectedValue(new Error('Deletion failed'));

      await expect(controller.delete(mockUser, 'bank-beneficiary-1')).rejects.toThrow('Deletion failed');
      expect(service.delete).toHaveBeenCalledWith('bank-beneficiary-1', mockUser);
    });
  });
});
