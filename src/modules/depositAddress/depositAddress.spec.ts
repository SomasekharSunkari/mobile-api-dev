import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { DepositAddressService } from './depositAddress.service';
import { DepositAddressRepository } from './depositAddress.repository';
import { ParticipantAdapter } from '../../adapters/participant/participant.adapter';
import { DepositAddressModel } from '../../database/models/depositAddress/depositAddress.model';
import { UserModel } from '../../database/models/user/user.model';
import { ExternalAccountRepository } from '../externalAccount/external-account.repository';
import { DepositAddressCreateResponse } from '../../adapters/participant/participant.adapter.interface';
import { EnvironmentService } from '../../config/environment/environment.service';

describe('DepositAddressService', () => {
  let service: DepositAddressService;
  let repository: jest.Mocked<DepositAddressRepository>;
  let adapter: jest.Mocked<ParticipantAdapter>;
  let externalAccountRepository: jest.Mocked<ExternalAccountRepository>;

  const mockUser = {
    id: 'user123',
    email: 'test@example.com',
    country: { code: 'US' },
    $fetchGraph: jest.fn(),
  } as unknown as UserModel;

  const mockDepositAddress = {
    id: 'deposit123',
    user_id: 'user123',
    provider: 'zerohash',
    asset: 'USDC.SOL',
    address: 'test-address-123',
    created_at: new Date(),
    updated_at: new Date(),
  } as DepositAddressModel;

  const mockAdapterResponse: DepositAddressCreateResponse = {
    address: 'test-address-123',
    asset: 'USDC.SOL',
    userRef: 'PART123',
    createdAt: 1640995200000,
  };

  beforeEach(async () => {
    // Mock environment variables
    jest.spyOn(EnvironmentService, 'getValue').mockImplementation((key: string) => {
      if (key === 'DEFAULT_USD_FIAT_WALLET_PROVIDER') return 'zerohash';
      if (key === 'DEFAULT_UNDERLYING_CURRENCY') return 'USDC.ETH';
      return '';
    });

    const repositoryMock = {
      findByUserId: jest.fn(),
      findByUserIdAndAsset: jest.fn(),
      create: jest.fn(),
    };

    const adapterMock = {
      createDepositAddress: jest.fn(),
      getDepositAddress: jest.fn(),
    };

    const externalAccountRepositoryMock = {
      findByUserId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepositAddressService,
        {
          provide: DepositAddressRepository,
          useValue: repositoryMock,
        },
        {
          provide: ParticipantAdapter,
          useValue: adapterMock,
        },
        {
          provide: ExternalAccountRepository,
          useValue: externalAccountRepositoryMock,
        },
      ],
    }).compile();

    service = module.get<DepositAddressService>(DepositAddressService);
    repository = module.get(DepositAddressRepository);
    adapter = module.get(ParticipantAdapter);
    externalAccountRepository = module.get(ExternalAccountRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createDepositAddress', () => {
    it('should return existing deposit address if found', async () => {
      repository.findByUserIdAndAsset.mockResolvedValue(mockDepositAddress);

      const result = await service.createDepositAddress(mockUser, 'PART123', 'USDC.SOL', 'zerohash');

      expect(repository.findByUserIdAndAsset).toHaveBeenCalledWith('user123', 'USDC.SOL');
      expect(adapter.createDepositAddress).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
      expect(result).toBe(mockDepositAddress);
    });

    it('should create new deposit address when none exists', async () => {
      repository.findByUserIdAndAsset.mockResolvedValue(undefined);
      adapter.createDepositAddress.mockResolvedValue(mockAdapterResponse);
      repository.create.mockResolvedValue(mockDepositAddress);

      const result = await service.createDepositAddress(mockUser, 'PART123', 'USDC.SOL', 'zerohash');

      expect(repository.findByUserIdAndAsset).toHaveBeenCalledWith('user123', 'USDC.SOL');
      expect(adapter.createDepositAddress).toHaveBeenCalledWith({ userRef: 'PART123', asset: 'USDC.SOL' }, 'US');
      expect(repository.create).toHaveBeenCalledWith({
        user_id: 'user123',
        provider: 'zerohash',
        asset: 'USDC.SOL',
        address: 'test-address-123',
      });
      expect(result).toBe(mockDepositAddress);
    });

    it('should use user country code when countryCode is not provided', async () => {
      repository.findByUserIdAndAsset.mockResolvedValue(undefined);
      adapter.createDepositAddress.mockResolvedValue(mockAdapterResponse);
      repository.create.mockResolvedValue(mockDepositAddress);

      await service.createDepositAddress(mockUser, 'PART123', 'USDC.SOL', 'zerohash');

      expect(adapter.createDepositAddress).toHaveBeenCalledWith({ userRef: 'PART123', asset: 'USDC.SOL' }, 'US');
    });

    it('should handle null asset parameter', async () => {
      repository.findByUserIdAndAsset.mockResolvedValue(undefined);
      adapter.createDepositAddress.mockResolvedValue(mockAdapterResponse);
      repository.create.mockResolvedValue(mockDepositAddress);

      await service.createDepositAddress(mockUser, 'PART123', null, 'zerohash');

      expect(adapter.createDepositAddress).toHaveBeenCalledWith({ userRef: 'PART123', asset: null }, 'US');
    });

    it('should handle undefined provider parameter', async () => {
      repository.findByUserIdAndAsset.mockResolvedValue(undefined);
      adapter.createDepositAddress.mockResolvedValue(mockAdapterResponse);
      repository.create.mockResolvedValue(mockDepositAddress);

      await service.createDepositAddress(mockUser, 'PART123', 'USDC.SOL', undefined);

      expect(repository.create).toHaveBeenCalledWith({
        user_id: 'user123',
        provider: undefined,
        asset: 'USDC.SOL',
        address: 'test-address-123',
      });
    });

    it('should throw InternalServerErrorException when adapter fails', async () => {
      repository.findByUserIdAndAsset.mockResolvedValue(undefined);
      adapter.createDepositAddress.mockRejectedValue(new Error('Adapter error'));

      await expect(service.createDepositAddress(mockUser, 'PART123', 'USDC.SOL', 'zerohash')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException when repository create fails', async () => {
      repository.findByUserIdAndAsset.mockResolvedValue(undefined);
      adapter.createDepositAddress.mockResolvedValue(mockAdapterResponse);
      repository.create.mockRejectedValue(new Error('Database error'));

      await expect(service.createDepositAddress(mockUser, 'PART123', 'USDC.SOL', 'zerohash')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should log appropriate messages during creation', async () => {
      const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation();
      repository.findByUserIdAndAsset.mockResolvedValue(undefined);
      adapter.createDepositAddress.mockResolvedValue(mockAdapterResponse);
      repository.create.mockResolvedValue(mockDepositAddress);

      await service.createDepositAddress(mockUser, 'PART123', 'USDC.SOL', 'zerohash');

      expect(logSpy).toHaveBeenCalledWith(
        'Creating deposit address for user user123, asset: USDC.SOL, participant: PART123',
      );
      expect(logSpy).toHaveBeenCalledWith('Created deposit address deposit123 for user user123');

      logSpy.mockRestore();
    });

    it('should work when user has no country code', async () => {
      const userWithoutCountry = {
        id: 'user123',
        email: 'test@example.com',
        country: null,
      } as UserModel;
      repository.findByUserIdAndAsset.mockResolvedValue(undefined);
      adapter.createDepositAddress.mockResolvedValue(mockAdapterResponse);
      repository.create.mockResolvedValue(mockDepositAddress);

      const result = await service.createDepositAddress(userWithoutCountry, 'PART123', 'USDC.SOL', 'zerohash');

      expect(adapter.createDepositAddress).toHaveBeenCalledWith({ userRef: 'PART123', asset: 'USDC.SOL' }, undefined);
      expect(result).toBe(mockDepositAddress);
    });
  });

  describe('getDepositAddresses', () => {
    it('should return deposit addresses when default address exists', async () => {
      const mockAddresses = [
        {
          id: 'deposit123',
          user_id: 'user123',
          provider: 'zerohash',
          asset: 'USDC.ETH', // Default currency
          address: 'test-address-123',
        },
      ] as DepositAddressModel[];
      repository.findByUserId.mockResolvedValue(mockAddresses);

      const result = await service.getDepositAddresses(mockUser);

      expect(repository.findByUserId).toHaveBeenCalledWith('user123');
      expect(result).toBe(mockAddresses);
      expect(adapter.getDepositAddress).not.toHaveBeenCalled();
    });

    it('should return empty array when no addresses found and no external account', async () => {
      repository.findByUserId.mockResolvedValue([]);
      externalAccountRepository.findByUserId.mockResolvedValue([]);

      const result = await service.getDepositAddresses(mockUser);

      expect(repository.findByUserId).toHaveBeenCalledWith('user123');
      expect(result).toEqual([]);
    });

    it('should throw InternalServerErrorException when repository fails', async () => {
      repository.findByUserId.mockRejectedValue(new Error('Database error'));

      await expect(service.getDepositAddresses(mockUser)).rejects.toThrow(InternalServerErrorException);
    });

    it('should log appropriate messages when address exists', async () => {
      const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation();
      const mockAddresses = [
        {
          id: 'deposit123',
          user_id: 'user123',
          provider: 'zerohash',
          asset: 'USDC.ETH',
          address: 'test-address-123',
        },
      ] as DepositAddressModel[];
      repository.findByUserId.mockResolvedValue(mockAddresses);

      await service.getDepositAddresses(mockUser);

      expect(logSpy).toHaveBeenCalledWith('Fetching deposit addresses for user user123');
      expect(logSpy).toHaveBeenCalledWith(
        'Found existing deposit address for user user123, provider: zerohash, asset: USDC.ETH',
      );

      logSpy.mockRestore();
    });
  });
});
