import { Test, TestingModule } from '@nestjs/testing';
import { IpCountryBanService } from './ipCountryBan.service';
import { IpCountryBanRepository } from '../../../database/models/ipCountryBan/ipCountryBan.repository';
import { IpCountryBanModel } from '../../../database/models/ipCountryBan/ipCountryBan.model';

describe('IpCountryBanService', () => {
  let service: IpCountryBanService;
  let repository: jest.Mocked<IpCountryBanRepository>;

  const mockBannedCountry: Partial<IpCountryBanModel> = {
    id: 'ban-id',
    type: 'country',
    value: 'XX',
    reason: 'Restricted region',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockRepository = {
      isCountryBanned: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [IpCountryBanService, { provide: IpCountryBanRepository, useValue: mockRepository }],
    }).compile();

    service = module.get<IpCountryBanService>(IpCountryBanService);
    repository = module.get(IpCountryBanRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isCountryBanned', () => {
    const countryCode = 'XX';

    it('should return banned country when country is banned', async () => {
      // Arrange
      repository.isCountryBanned.mockResolvedValue(mockBannedCountry as IpCountryBanModel);

      // Act
      const result = await service.isCountryBanned(countryCode);

      // Assert
      expect(repository.isCountryBanned).toHaveBeenCalledWith(countryCode);
      expect(result).toEqual(mockBannedCountry);
    });

    it('should return null when country is not banned', async () => {
      // Arrange
      repository.isCountryBanned.mockResolvedValue(null);

      // Act
      const result = await service.isCountryBanned(countryCode);

      // Assert
      expect(repository.isCountryBanned).toHaveBeenCalledWith(countryCode);
      expect(result).toBeNull();
    });

    it('should handle repository errors gracefully and return null', async () => {
      // Arrange
      repository.isCountryBanned.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await service.isCountryBanned(countryCode);

      // Assert
      expect(repository.isCountryBanned).toHaveBeenCalledWith(countryCode);
      expect(result).toBeNull();
    });
  });

  describe('checkAndBlockAccess', () => {
    const ip = '192.168.1.1';
    const country = 'XX';

    it('should return access denied message when country is banned', async () => {
      // Arrange
      repository.isCountryBanned.mockResolvedValue(mockBannedCountry as IpCountryBanModel);

      // Act
      const result = await service.checkAndBlockAccess(ip, country);

      // Assert
      expect(repository.isCountryBanned).toHaveBeenCalledWith(country);
      expect(result).toBe(`Access denied from ${country}. ${mockBannedCountry.reason}`);
    });

    it('should return access denied message with default reason when banned country has no reason', async () => {
      // Arrange
      const bannedCountryNoReason = { ...mockBannedCountry, reason: null };
      repository.isCountryBanned.mockResolvedValue(bannedCountryNoReason as IpCountryBanModel);

      // Act
      const result = await service.checkAndBlockAccess(ip, country);

      // Assert
      expect(repository.isCountryBanned).toHaveBeenCalledWith(country);
      expect(result).toBe(`Access denied from ${country}. This location is not permitted.`);
    });

    it('should return null when country is not banned', async () => {
      // Arrange
      repository.isCountryBanned.mockResolvedValue(null);

      // Act
      const result = await service.checkAndBlockAccess(ip, country);

      // Assert
      expect(repository.isCountryBanned).toHaveBeenCalledWith(country);
      expect(result).toBeNull();
    });

    it('should return null when country is unknown', async () => {
      // Act
      const result = await service.checkAndBlockAccess(ip, 'unknown');

      // Assert
      expect(repository.isCountryBanned).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should return null when country is empty', async () => {
      // Act
      const result = await service.checkAndBlockAccess(ip, '');

      // Assert
      expect(repository.isCountryBanned).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should handle service errors gracefully and return null', async () => {
      // Arrange
      repository.isCountryBanned.mockRejectedValue(new Error('Service error'));

      // Act
      const result = await service.checkAndBlockAccess(ip, country);

      // Assert
      expect(repository.isCountryBanned).toHaveBeenCalledWith(country);
      expect(result).toBeNull();
    });

    it('should allow access on error to avoid blocking legitimate users', async () => {
      // Arrange
      repository.isCountryBanned.mockRejectedValue(new Error('Database connection failed'));

      // Act
      const result = await service.checkAndBlockAccess(ip, country);

      // Assert
      expect(result).toBeNull(); // Access allowed despite error
    });
  });
});
