import { HttpStatus, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppLoggerService } from '../../services/logger/logger.service';
import { TierConfigController } from './tierConfig.controller';
import { TierConfigRepository } from './tierConfig.repository';
import { TierConfigService } from './tierConfig.service';

const mockTierConfig = {
  id: 'config-1',
  tier_id: 'tier-1',
  country_id: 'country-1',
  name: 'Test Tier',
  description: 'Test Description',
  status: 'active',
  minimum_balance: 1000,
  maximum_balance: 100000,
  minimum_per_deposit: 100,
  maximum_per_deposit: 10000,
  maximum_daily_deposit: 50000,
  maximum_monthly_deposit: 200000,
  minimum_transaction_amount: 100,
  maximum_transaction_amount: 5000,
  maximum_daily_transaction: 25000,
  maximum_monthly_transaction: 100000,
  total_spendable: 500000,
  total_receivable: 500000,
};

describe('TierConfigService', () => {
  let service: TierConfigService;
  const mockTierConfigRepository = {
    create: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [TierConfigService, { provide: TierConfigRepository, useValue: mockTierConfigRepository }],
    }).compile();
    service = module.get<TierConfigService>(TierConfigService);
  });

  describe('create', () => {
    it('should create a new tier config', async () => {
      mockTierConfigRepository.findOne.mockResolvedValue(undefined);
      mockTierConfigRepository.create.mockResolvedValue(mockTierConfig);
      const data = {
        tier_id: 'tier-1',
        country_id: 'country-1',
        name: 'Test Tier',
        description: 'Test Description',
        status: 'active',
        minimum_balance: 1000,
        maximum_balance: 100000,
        minimum_per_deposit: 100,
        maximum_per_deposit: 10000,
      };
      const result = await service.create(data as any);
      expect(mockTierConfigRepository.create).toHaveBeenCalledWith(expect.objectContaining(data));
      expect(result).toEqual(mockTierConfig);
    });
    it('should throw InternalServerErrorException if an error occurs', async () => {
      mockTierConfigRepository.create.mockRejectedValue(new Error('DB error'));
      const data = {
        tier_id: 'tier-1',
        country_id: 'country-1',
        name: 'Test Tier',
        description: 'Test Description',
        status: 'active',
        minimum_balance: 1000,
        maximum_balance: 100000,
      };
      await expect(service.create(data as any)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('update', () => {
    it('should update a tier config', async () => {
      mockTierConfigRepository.findById.mockResolvedValue(mockTierConfig);
      mockTierConfigRepository.update.mockResolvedValue(mockTierConfig);
      const data = { name: 'Updated Tier', description: 'Updated Description' };
      const result = await service.update('config-1', data as any);
      expect(mockTierConfigRepository.update).toHaveBeenCalledWith('config-1', expect.objectContaining(data));
      expect(result).toEqual(mockTierConfig);
    });
    it('should throw NotFoundException if not found', async () => {
      mockTierConfigRepository.findById.mockResolvedValue(undefined);
      const data = { name: 'Updated Tier' };
      await expect(service.update('config-404', data as any)).rejects.toThrow(NotFoundException);
    });
    it('should throw InternalServerErrorException if an error occurs', async () => {
      mockTierConfigRepository.findById.mockResolvedValue(mockTierConfig);
      mockTierConfigRepository.update.mockRejectedValue(new Error('DB error'));
      const data = { name: 'Updated Tier' };
      await expect(service.update('config-1', data as any)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('findAll', () => {
    it('should return all tier configs', async () => {
      mockTierConfigRepository.findAll.mockResolvedValue([mockTierConfig]);
      const query = { countryId: 'country-1' };
      const result = await service.findAll(query as any);
      expect(mockTierConfigRepository.findAll).toHaveBeenCalledWith({ country_id: 'country-1' }, query);
      expect(result).toEqual([mockTierConfig]);
    });

    it('should return all configs when countryId is omitted', async () => {
      mockTierConfigRepository.findAll.mockResolvedValue([mockTierConfig]);
      const result = await service.findAll({});
      expect(mockTierConfigRepository.findAll).toHaveBeenCalledWith({}, {});
      expect(result).toEqual([mockTierConfig]);
    });
  });

  describe('findOne', () => {
    it('should return a tier config by id', async () => {
      mockTierConfigRepository.findOne.mockResolvedValue(mockTierConfig);
      const result = await service.findOne('config-1');
      expect(mockTierConfigRepository.findOne).toHaveBeenCalledWith({ id: 'config-1' });
      expect(result).toEqual(mockTierConfig);
    });
    it('should throw NotFoundException if not found', async () => {
      mockTierConfigRepository.findOne.mockResolvedValue(undefined);
      await expect(service.findOne('config-404')).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete a tier config', async () => {
      mockTierConfigRepository.findById.mockResolvedValue(mockTierConfig);
      mockTierConfigRepository.delete.mockResolvedValue({});
      const result = await service.delete('config-1');
      expect(mockTierConfigRepository.delete).toHaveBeenCalledWith('config-1');
      expect(result).toEqual(mockTierConfig);
    });
    it('should throw NotFoundException if not found', async () => {
      mockTierConfigRepository.findById.mockResolvedValue(undefined);
      await expect(service.delete('config-404')).rejects.toThrow(NotFoundException);
    });
  });
});

describe('TierConfigController', () => {
  let controller: TierConfigController;
  let service: TierConfigService;
  const mockTierConfigService = {
    create: jest.fn(),
    update: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
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
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TierConfigController],
      providers: [
        { provide: TierConfigService, useValue: mockTierConfigService },
        { provide: AppLoggerService, useValue: mockAppLoggerService },
      ],
    }).compile();
    controller = module.get<TierConfigController>(TierConfigController);
    service = module.get<TierConfigService>(TierConfigService);
  });
  describe('create', () => {
    it('should call create and return transformed response', async () => {
      mockTierConfigService.create.mockResolvedValue(mockTierConfig);
      const dto = {
        tier_id: 'tier-1',
        country_id: 'country-1',
        name: 'Test Tier',
        description: 'Test Description',
        status: 'active',
        minimum_balance: 1000,
        maximum_balance: 100000,
      };
      const result = await controller.create(dto as any);
      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toMatchObject({
        message: 'TierConfig Created Successfully',
        data: mockTierConfig,
        statusCode: HttpStatus.CREATED,
      });
    });
  });
  describe('update', () => {
    it('should call update and return transformed response', async () => {
      mockTierConfigService.update.mockResolvedValue(mockTierConfig);
      const dto = { name: 'Updated Tier', description: 'Updated Description' };
      const result = await controller.update('config-1', dto as any);
      expect(service.update).toHaveBeenCalledWith('config-1', dto);
      expect(result).toMatchObject({
        message: 'TierConfig Updated Successfully',
        data: mockTierConfig,
        statusCode: HttpStatus.OK,
      });
    });
  });
  describe('findAll', () => {
    it('should call findAll and return transformed response', async () => {
      mockTierConfigService.findAll.mockResolvedValue([mockTierConfig]);
      const query = { countryId: 'country-1' };
      const result = await controller.findAll(query as any);
      expect(service.findAll).toHaveBeenCalledWith(query);
      expect(result).toMatchObject({
        message: 'TierConfigs Fetched Successfully',
        data: [mockTierConfig],
        statusCode: HttpStatus.OK,
      });
    });
  });
  describe('findById', () => {
    it('should call findOne and return transformed response', async () => {
      mockTierConfigService.findOne.mockResolvedValue(mockTierConfig);
      const result = await controller.findById('config-1');
      expect(service.findOne).toHaveBeenCalledWith('config-1');
      expect(result).toMatchObject({
        message: 'TierConfig Fetched Successfully',
        data: mockTierConfig,
        statusCode: HttpStatus.OK,
      });
    });
  });
  describe('delete', () => {
    it('should call delete and return transformed response', async () => {
      mockTierConfigService.delete.mockResolvedValue(mockTierConfig);
      const result = await controller.delete('config-1');
      expect(service.delete).toHaveBeenCalledWith('config-1');
      expect(result).toMatchObject({
        message: 'TierConfig Deleted Successfully',
        data: mockTierConfig,
        statusCode: HttpStatus.OK,
      });
    });
  });
});
