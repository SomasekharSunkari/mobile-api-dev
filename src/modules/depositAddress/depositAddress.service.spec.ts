import { InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ParticipantAdapter } from '../../adapters/participant/participant.adapter';
import {
  DepositAddressCreateRequest,
  DepositAddressCreateResponse,
  DepositAddressFetchRequest,
  DepositAddressFetchResponse,
} from '../../adapters/participant/participant.adapter.interface';
import { DepositAddressModel } from '../../database/models/depositAddress/depositAddress.model';
import { UserModel } from '../../database/models/user/user.model';
import { ExternalAccountModel } from '../../database/models/externalAccount/externalAccount.model';
import { ExternalAccountRepository } from '../externalAccount/external-account.repository';
import { DepositAddressRepository } from './depositAddress.repository';
import { DepositAddressService } from './depositAddress.service';
import { EnvironmentService } from '../../config/environment/environment.service';

describe('DepositAddressService', () => {
  let service: DepositAddressService;
  let participantAdapter: jest.Mocked<ParticipantAdapter>;
  let depositAddressRepository: jest.Mocked<DepositAddressRepository>;
  let externalAccountRepository: jest.Mocked<ExternalAccountRepository>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    country: {
      code: 'US',
    },
    $fetchGraph: jest.fn(),
  } as unknown as UserModel;

  beforeEach(async () => {
    // Mock environment variables
    jest.spyOn(EnvironmentService, 'getValue').mockImplementation((key: string) => {
      if (key === 'DEFAULT_USD_FIAT_WALLET_PROVIDER') return 'zerohash';
      if (key === 'DEFAULT_UNDERLYING_CURRENCY') return 'USDC.ETH';
      return '';
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepositAddressService,
        {
          provide: ParticipantAdapter,
          useValue: {
            createDepositAddress: jest.fn(),
            getDepositAddress: jest.fn(),
          },
        },
        {
          provide: DepositAddressRepository,
          useValue: {
            findByUserIdAndAsset: jest.fn(),
            create: jest.fn(),
            findByUserId: jest.fn(),
            findLatestRainDepositAddressByUserId: jest.fn(),
          },
        },
        {
          provide: ExternalAccountRepository,
          useValue: {
            findByUserId: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DepositAddressService>(DepositAddressService);
    participantAdapter = module.get(ParticipantAdapter) as jest.Mocked<ParticipantAdapter>;
    depositAddressRepository = module.get(DepositAddressRepository) as jest.Mocked<DepositAddressRepository>;
    externalAccountRepository = module.get(ExternalAccountRepository) as jest.Mocked<ExternalAccountRepository>;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createDepositAddress', () => {
    it('should return existing deposit address if it already exists', async () => {
      const userRef = 'user-ref-123';
      const asset = 'USDC_ETH_TEST5_0GER';
      const existingAddress = {
        id: 'address-123',
        user_id: mockUser.id,
        asset: asset,
        address: '0x1234567890abcdef',
      } as DepositAddressModel;

      depositAddressRepository.findByUserIdAndAsset.mockResolvedValue(existingAddress);

      const result = await service.createDepositAddress(mockUser, userRef, asset);

      expect(result).toEqual(existingAddress);
      expect(depositAddressRepository.findByUserIdAndAsset).toHaveBeenCalledWith(mockUser.id, asset);
      expect(participantAdapter.createDepositAddress).not.toHaveBeenCalled();
      expect(depositAddressRepository.create).not.toHaveBeenCalled();
    });

    it('should create new deposit address when it does not exist', async () => {
      const userRef = 'user-ref-123';
      const asset = 'USDC_ETH_TEST5_0GER';
      const provider = 'rain';

      const adapterResponse: DepositAddressCreateResponse = {
        asset: asset,
        address: '0x1234567890abcdef',
        userRef: userRef,
        createdAt: Date.now(),
      };

      const createdAddress = {
        id: 'address-123',
        user_id: mockUser.id,
        provider: provider,
        asset: asset,
        address: adapterResponse.address,
      } as DepositAddressModel;

      depositAddressRepository.findByUserIdAndAsset.mockResolvedValue(undefined);
      participantAdapter.createDepositAddress.mockResolvedValue(adapterResponse);
      depositAddressRepository.create.mockResolvedValue(createdAddress);

      const result = await service.createDepositAddress(mockUser, userRef, asset, provider);

      expect(result).toEqual(createdAddress);
      expect(depositAddressRepository.findByUserIdAndAsset).toHaveBeenCalledWith(mockUser.id, asset);
      expect(participantAdapter.createDepositAddress).toHaveBeenCalledWith(
        { userRef, asset } as DepositAddressCreateRequest,
        mockUser.country?.code,
      );
      expect(depositAddressRepository.create).toHaveBeenCalledWith({
        user_id: mockUser.id,
        provider: provider,
        asset: adapterResponse.asset,
        address: adapterResponse.address,
      });
    });

    it('should create deposit address without provider when not provided', async () => {
      const userRef = 'user-ref-123';
      const asset = 'USDC_ETH_TEST5_0GER';

      const adapterResponse: DepositAddressCreateResponse = {
        asset: asset,
        address: '0x1234567890abcdef',
        userRef: userRef,
        createdAt: Date.now(),
      };

      const createdAddress = {
        id: 'address-123',
        user_id: mockUser.id,
        asset: asset,
        address: adapterResponse.address,
      } as DepositAddressModel;

      depositAddressRepository.findByUserIdAndAsset.mockResolvedValue(undefined);
      participantAdapter.createDepositAddress.mockResolvedValue(adapterResponse);
      depositAddressRepository.create.mockResolvedValue(createdAddress);

      const result = await service.createDepositAddress(mockUser, userRef, asset);

      expect(result).toEqual(createdAddress);
      expect(depositAddressRepository.create).toHaveBeenCalledWith({
        user_id: mockUser.id,
        provider: undefined,
        asset: adapterResponse.asset,
        address: adapterResponse.address,
      });
    });

    it('should throw InternalServerErrorException when adapter fails', async () => {
      const userRef = 'user-ref-123';
      const asset = 'USDC_ETH_TEST5_0GER';

      depositAddressRepository.findByUserIdAndAsset.mockResolvedValue(undefined);
      participantAdapter.createDepositAddress.mockRejectedValue(new Error('Adapter error'));

      await expect(service.createDepositAddress(mockUser, userRef, asset)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.createDepositAddress(mockUser, userRef, asset)).rejects.toThrow(
        'Failed to create deposit address',
      );
    });

    it('should throw InternalServerErrorException when repository create fails', async () => {
      const userRef = 'user-ref-123';
      const asset = 'USDC_ETH_TEST5_0GER';

      const adapterResponse: DepositAddressCreateResponse = {
        asset: asset,
        address: '0x1234567890abcdef',
        userRef: userRef,
        createdAt: Date.now(),
      };

      depositAddressRepository.findByUserIdAndAsset.mockResolvedValue(undefined);
      participantAdapter.createDepositAddress.mockResolvedValue(adapterResponse);
      depositAddressRepository.create.mockRejectedValue(new Error('Database error'));

      await expect(service.createDepositAddress(mockUser, userRef, asset)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.createDepositAddress(mockUser, userRef, asset)).rejects.toThrow(
        'Failed to create deposit address',
      );
    });
  });

  describe('getDepositAddresses', () => {
    it('should return existing addresses when default address already exists', async () => {
      const mockAddresses = [
        {
          id: 'address-1',
          user_id: mockUser.id,
          provider: 'zerohash',
          asset: 'USDC.ETH',
          address: '0x123...',
        },
        {
          id: 'address-2',
          user_id: mockUser.id,
          provider: 'rain',
          asset: 'USDT.ETH',
          address: '0x456...',
        },
      ] as DepositAddressModel[];

      depositAddressRepository.findByUserId.mockResolvedValue(mockAddresses);

      const result = await service.getDepositAddresses(mockUser);

      expect(result).toEqual(mockAddresses);
      expect(depositAddressRepository.findByUserId).toHaveBeenCalledWith(mockUser.id);
      expect(participantAdapter.getDepositAddress).not.toHaveBeenCalled();
      expect(externalAccountRepository.findByUserId).not.toHaveBeenCalled();
    });

    it('should fetch from provider and save when address exists at provider but not in DB', async () => {
      const existingAddresses = [] as DepositAddressModel[];
      const mockExternalAccount = {
        id: 'ext-account-123',
        participant_code: 'PART123',
        provider: 'zerohash',
      } as ExternalAccountModel;

      const providerResponse: DepositAddressFetchResponse = {
        address: '0xABCDEF',
        asset: 'USDC.ETH',
      };

      const createdAddress = {
        id: 'new-address-123',
        user_id: mockUser.id,
        provider: 'zerohash',
        asset: 'USDC.ETH',
        address: '0xABCDEF',
      } as DepositAddressModel;

      depositAddressRepository.findByUserId.mockResolvedValue(existingAddresses);
      externalAccountRepository.findByUserId.mockResolvedValue([mockExternalAccount]);
      participantAdapter.getDepositAddress.mockResolvedValue(providerResponse);
      depositAddressRepository.create.mockResolvedValue(createdAddress);

      const result = await service.getDepositAddresses(mockUser);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(createdAddress);
      expect(participantAdapter.getDepositAddress).toHaveBeenCalledWith(
        {
          participantCode: 'PART123',
          asset: 'USDC.ETH',
        } as DepositAddressFetchRequest,
        'US',
      );
      expect(depositAddressRepository.create).toHaveBeenCalledWith({
        user_id: mockUser.id,
        provider: 'zerohash',
        asset: 'USDC.ETH',
        address: '0xABCDEF',
      });
    });

    it('should create new address when not found at provider', async () => {
      const existingAddresses = [] as DepositAddressModel[];
      const mockExternalAccount = {
        id: 'ext-account-123',
        participant_code: 'PART123',
        provider: 'zerohash',
      } as ExternalAccountModel;

      const providerResponse: DepositAddressFetchResponse = {}; // Empty = not found

      const createdAddress = {
        id: 'new-address-123',
        user_id: mockUser.id,
        provider: 'zerohash',
        asset: 'USDC.ETH',
        address: '0xNEWADDRESS',
      } as DepositAddressModel;

      depositAddressRepository.findByUserId.mockResolvedValue(existingAddresses);
      externalAccountRepository.findByUserId.mockResolvedValue([mockExternalAccount]);
      participantAdapter.getDepositAddress.mockResolvedValue(providerResponse);

      // Mock createDepositAddress
      jest.spyOn(service, 'createDepositAddress').mockResolvedValue(createdAddress);

      const result = await service.getDepositAddresses(mockUser);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(createdAddress);
      expect(service.createDepositAddress).toHaveBeenCalledWith(mockUser, 'PART123', 'USDC.ETH', 'zerohash');
    });

    it('should return existing addresses when user has no external account', async () => {
      const existingAddresses = [
        {
          id: 'address-1',
          user_id: mockUser.id,
          provider: 'rain',
          asset: 'USDT.ETH',
          address: '0x456...',
        },
      ] as DepositAddressModel[];

      depositAddressRepository.findByUserId.mockResolvedValue(existingAddresses);
      externalAccountRepository.findByUserId.mockResolvedValue([]);

      const result = await service.getDepositAddresses(mockUser);

      expect(result).toEqual(existingAddresses);
      expect(participantAdapter.getDepositAddress).not.toHaveBeenCalled();
    });

    it('should load country if not already loaded', async () => {
      const userWithoutCountry = {
        id: 'user-123',
        email: 'test@example.com',
        country: undefined,
        $fetchGraph: jest.fn().mockImplementation(function (this: any) {
          this.country = { code: 'US' };
          return Promise.resolve(this);
        }),
      } as unknown as UserModel;

      const existingAddresses = [] as DepositAddressModel[];
      const mockExternalAccount = {
        id: 'ext-account-123',
        participant_code: 'PART123',
        provider: 'zerohash',
      } as ExternalAccountModel;

      depositAddressRepository.findByUserId.mockResolvedValue(existingAddresses);
      externalAccountRepository.findByUserId.mockResolvedValue([mockExternalAccount]);
      participantAdapter.getDepositAddress.mockResolvedValue({});

      await service.getDepositAddresses(userWithoutCountry);

      expect(userWithoutCountry.$fetchGraph).toHaveBeenCalledWith('country');
    });

    it('should return existing addresses when user has no country code', async () => {
      const userWithoutCountryCode = {
        id: 'user-123',
        email: 'test@example.com',
        country: undefined,
        $fetchGraph: jest.fn().mockResolvedValue(undefined),
      } as unknown as UserModel;

      const existingAddresses = [
        {
          id: 'address-1',
          user_id: 'user-123',
          provider: 'rain',
          asset: 'USDT.ETH',
          address: '0x456...',
        },
      ] as DepositAddressModel[];

      depositAddressRepository.findByUserId.mockResolvedValue(existingAddresses);

      const result = await service.getDepositAddresses(userWithoutCountryCode);

      expect(result).toEqual(existingAddresses);
      expect(participantAdapter.getDepositAddress).not.toHaveBeenCalled();
    });

    it('should handle provider errors gracefully and return existing addresses', async () => {
      const existingAddresses = [] as DepositAddressModel[];
      const mockExternalAccount = {
        id: 'ext-account-123',
        participant_code: 'PART123',
        provider: 'zerohash',
      } as ExternalAccountModel;

      depositAddressRepository.findByUserId.mockResolvedValue(existingAddresses);
      externalAccountRepository.findByUserId.mockResolvedValue([mockExternalAccount]);
      participantAdapter.getDepositAddress.mockRejectedValue(new Error('Provider error'));

      const result = await service.getDepositAddresses(mockUser);

      expect(result).toEqual(existingAddresses);
      expect(participantAdapter.getDepositAddress).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when repository fails', async () => {
      depositAddressRepository.findByUserId.mockRejectedValue(new Error('Database error'));

      await expect(service.getDepositAddresses(mockUser)).rejects.toThrow(InternalServerErrorException);
      await expect(service.getDepositAddresses(mockUser)).rejects.toThrow('Failed to fetch deposit addresses');
    });
  });

  describe('getRainDepositAddressForDefaultChain', () => {
    it('should return latest Rain deposit address for user', async () => {
      const mockAddress = {
        id: 'address-123',
        user_id: mockUser.id,
        provider: 'rain',
        asset: 'USDC_ETH_TEST5_0GER',
        address: '0x1234567890abcdef',
      } as DepositAddressModel;

      depositAddressRepository.findLatestRainDepositAddressByUserId.mockResolvedValue(mockAddress);

      const result = await service.getRainDepositAddressForDefaultChain(mockUser);

      expect(result).toEqual(mockAddress);
      expect(depositAddressRepository.findLatestRainDepositAddressByUserId).toHaveBeenCalledWith(mockUser.id);
    });

    it('should return null when no Rain address found', async () => {
      depositAddressRepository.findLatestRainDepositAddressByUserId.mockResolvedValue(undefined);

      const result = await service.getRainDepositAddressForDefaultChain(mockUser);

      expect(result).toBeNull();
    });

    it('should throw InternalServerErrorException when repository fails', async () => {
      depositAddressRepository.findLatestRainDepositAddressByUserId.mockRejectedValue(new Error('Database error'));

      await expect(service.getRainDepositAddressForDefaultChain(mockUser)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.getRainDepositAddressForDefaultChain(mockUser)).rejects.toThrow(
        'Failed to fetch Rain deposit address',
      );
    });
  });
});
