import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CountryModel } from '../../../database';
import { S3Service } from '../../../services/s3';
import { UpdateUserDto } from './dto/updateUser.dto';
import { UserProfileRepository } from './userProfile.repository';
import { UserProfileService } from './userProfile.service';

jest.mock('../../../database/models/country/country.model');

describe('UserProfileService', () => {
  let service: UserProfileService;
  let userProfileRepository: jest.Mocked<UserProfileRepository>;
  let s3Service: jest.Mocked<S3Service>;

  const mockUserProfile = {
    id: 'profile-123',
    user_id: 'user-123',
    dob: new Date('1990-01-01'),
    gender: 'male',
    address_line1: '123 Main St',
    address_line2: 'Apt 4B',
    city: 'New York',
    state_or_province: 'NY',
    postal_code: '10001',
    notification_token: 'token-123',
    avatar_url: null,
    image_key: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockCountry = {
    id: 'country-123',
    name: 'United States',
    code: 'US',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserProfileService,
        {
          provide: UserProfileRepository,
          useValue: {
            findOne: jest.fn(),
            update: jest.fn(),
            transaction: jest.fn(),
          },
        },
        {
          provide: S3Service,
          useValue: {
            uploadBuffer: jest.fn(),
            deleteObject: jest.fn(),
            generateUniqueKey: jest.fn(),
            getSignedUrl: jest.fn(),
            getSignedUploadUrl: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UserProfileService>(UserProfileService);
    userProfileRepository = module.get(UserProfileRepository) as jest.Mocked<UserProfileRepository>;
    s3Service = module.get(S3Service) as jest.Mocked<S3Service>;

    jest.clearAllMocks();
  });

  describe('update', () => {
    it('should successfully update user profile without country', async () => {
      const updateDto: UpdateUserDto = {
        gender: 'female',
        address_line1: '456 Oak Ave',
        city: 'Los Angeles',
      };

      userProfileRepository.findOne.mockResolvedValue(mockUserProfile as any);
      userProfileRepository.update.mockResolvedValue({ ...mockUserProfile, ...updateDto } as any);

      const result = await service.update('user-123', updateDto);

      expect(userProfileRepository.findOne).toHaveBeenCalledWith({ user_id: 'user-123' });
      expect(userProfileRepository.update).toHaveBeenCalledWith({ user_id: 'user-123' }, updateDto);
      expect(result.gender).toBe('female');
      expect(result.address_line1).toBe('456 Oak Ave');
    });

    it('should successfully update user profile with country', async () => {
      const updateDto: UpdateUserDto = {
        country_id: 'country-123',
        address_line1: '789 Pine St',
      };

      const mockCountryQuery = {
        findOne: jest.fn().mockResolvedValue(mockCountry),
      };
      (CountryModel.query as jest.Mock).mockReturnValue(mockCountryQuery);

      userProfileRepository.findOne.mockResolvedValue(mockUserProfile as any);
      userProfileRepository.update.mockResolvedValue({ ...mockUserProfile, ...updateDto } as any);

      const result = await service.update('user-123', updateDto);

      expect(mockCountryQuery.findOne).toHaveBeenCalledWith({ id: 'country-123' });
      expect(userProfileRepository.update).toHaveBeenCalledWith({ user_id: 'user-123' }, updateDto);
      expect(result.address_line1).toBe('789 Pine St');
    });

    it('should throw NotFoundException when user profile not found', async () => {
      const updateDto: UpdateUserDto = {
        gender: 'female',
      };

      userProfileRepository.findOne.mockResolvedValue(null);

      await expect(service.update('user-123', updateDto)).rejects.toThrow(NotFoundException);
      expect(userProfileRepository.findOne).toHaveBeenCalledWith({ user_id: 'user-123' });
      expect(userProfileRepository.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when country not found', async () => {
      const updateDto: UpdateUserDto = {
        country_id: 'invalid-country',
      };

      const mockCountryQuery = {
        findOne: jest.fn().mockResolvedValue(null),
      };
      (CountryModel.query as jest.Mock).mockReturnValue(mockCountryQuery);

      await expect(service.update('user-123', updateDto)).rejects.toThrow(new NotFoundException('Country not found'));
      expect(mockCountryQuery.findOne).toHaveBeenCalledWith({ id: 'invalid-country' });
      expect(userProfileRepository.findOne).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when update fails', async () => {
      const updateDto: UpdateUserDto = {
        gender: 'male',
      };

      userProfileRepository.findOne.mockResolvedValue(mockUserProfile as any);
      userProfileRepository.update.mockRejectedValue(new Error('Database error'));

      await expect(service.update('user-123', updateDto)).rejects.toThrow(NotFoundException);
      expect(userProfileRepository.update).toHaveBeenCalledWith({ user_id: 'user-123' }, updateDto);
    });

    it('should handle empty update DTO', async () => {
      const updateDto: UpdateUserDto = {};

      userProfileRepository.findOne.mockResolvedValue(mockUserProfile as any);
      userProfileRepository.update.mockResolvedValue(mockUserProfile as any);

      const result = await service.update('user-123', updateDto);

      expect(userProfileRepository.update).toHaveBeenCalledWith({ user_id: 'user-123' }, updateDto);
      expect(result).toEqual(mockUserProfile);
    });

    it('should update multiple fields at once', async () => {
      const updateDto: UpdateUserDto = {
        gender: 'female',
        address_line1: '100 Broadway',
        address_line2: 'Floor 5',
        city: 'New York',
        state_or_province: 'NY',
        postal_code: '10005',
      };

      userProfileRepository.findOne.mockResolvedValue(mockUserProfile as any);
      userProfileRepository.update.mockResolvedValue({ ...mockUserProfile, ...updateDto } as any);

      const result = await service.update('user-123', updateDto);

      expect(result.gender).toBe('female');
      expect(result.address_line1).toBe('100 Broadway');
      expect(result.city).toBe('New York');
      expect(result.postal_code).toBe('10005');
    });
  });

  describe('findByUserId', () => {
    it('should successfully find user profile by user ID without avatar', async () => {
      userProfileRepository.findOne.mockResolvedValue(mockUserProfile as any);

      const result = await service.findByUserId('user-123');

      expect(userProfileRepository.findOne).toHaveBeenCalledWith({ user_id: 'user-123' });
      expect(result).toEqual(mockUserProfile);
      expect(result.user_id).toBe('user-123');
      expect(s3Service.getSignedUrl).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when user profile not found', async () => {
      userProfileRepository.findOne.mockResolvedValue(null);

      await expect(service.findByUserId('non-existent-user')).rejects.toThrow(
        new NotFoundException('User profile not found'),
      );
      expect(userProfileRepository.findOne).toHaveBeenCalledWith({ user_id: 'non-existent-user' });
    });

    it('should handle database errors gracefully', async () => {
      userProfileRepository.findOne.mockRejectedValue(new Error('Database connection error'));

      await expect(service.findByUserId('user-123')).rejects.toThrow('Database connection error');
      expect(userProfileRepository.findOne).toHaveBeenCalledWith({ user_id: 'user-123' });
    });

    it('should find user profile with different user IDs', async () => {
      const mockProfile2 = { ...mockUserProfile, id: 'profile-456', user_id: 'user-456' };

      userProfileRepository.findOne.mockResolvedValueOnce(mockUserProfile as any);
      userProfileRepository.findOne.mockResolvedValueOnce(mockProfile2 as any);

      const result1 = await service.findByUserId('user-123');
      const result2 = await service.findByUserId('user-456');

      expect(result1.user_id).toBe('user-123');
      expect(result2.user_id).toBe('user-456');
    });
  });

  describe('populateAvatarUrl', () => {
    it('should generate signed URL when image_key exists', async () => {
      const profileWithImageKey = {
        ...mockUserProfile,
        avatar_url: null,
        image_key: 'profile-images/user-123/avatar.jpg',
      };
      const signedUrl = 'https://s3.amazonaws.com/bucket/profile-images/user-123/avatar.jpg?signed=true';

      s3Service.getSignedUrl.mockResolvedValue(signedUrl);

      const result = await service.populateAvatarUrl(profileWithImageKey as any);

      expect(s3Service.getSignedUrl).toHaveBeenCalledWith({
        key: 'profile-images/user-123/avatar.jpg',
        expiresIn: 3600,
      });
      expect(result.avatar_url).toBe(signedUrl);
    });

    it('should do nothing when neither image_key nor avatar_url exists', async () => {
      const profileEmpty = {
        ...mockUserProfile,
        avatar_url: null,
        image_key: null,
      };

      const result = await service.populateAvatarUrl(profileEmpty as any);

      expect(s3Service.getSignedUrl).not.toHaveBeenCalled();
      expect(result.avatar_url).toBeNull();
    });
  });

  describe('throwIfCountryDoNotExist (private method)', () => {
    it('should not throw when country exists', async () => {
      const updateDto: UpdateUserDto = {
        country_id: 'country-123',
      };

      const mockCountryQuery = {
        findOne: jest.fn().mockResolvedValue(mockCountry),
      };
      (CountryModel.query as jest.Mock).mockReturnValue(mockCountryQuery);

      userProfileRepository.findOne.mockResolvedValue(mockUserProfile as any);
      userProfileRepository.update.mockResolvedValue(mockUserProfile as any);

      await expect(service.update('user-123', updateDto)).resolves.toBeDefined();
    });

    it('should throw NotFoundException when country does not exist', async () => {
      const updateDto: UpdateUserDto = {
        country_id: 'non-existent-country',
      };

      const mockCountryQuery = {
        findOne: jest.fn().mockResolvedValue(null),
      };
      (CountryModel.query as jest.Mock).mockReturnValue(mockCountryQuery);

      await expect(service.update('user-123', updateDto)).rejects.toThrow(new NotFoundException('Country not found'));
    });
  });

  describe('edge cases and integration', () => {
    it('should handle concurrent update requests', async () => {
      const updateDto1: UpdateUserDto = { gender: 'male' };
      const updateDto2: UpdateUserDto = { gender: 'female' };

      userProfileRepository.findOne.mockResolvedValue(mockUserProfile as any);
      userProfileRepository.update
        .mockResolvedValueOnce({ ...mockUserProfile, gender: 'male' } as any)
        .mockResolvedValueOnce({ ...mockUserProfile, gender: 'female' } as any);

      const [result1, result2] = await Promise.all([
        service.update('user-123', updateDto1),
        service.update('user-123', updateDto2),
      ]);

      expect(result1.gender).toBe('male');
      expect(result2.gender).toBe('female');
    });

    it('should handle special characters in update fields', async () => {
      const updateDto: UpdateUserDto = {
        address_line1: "123 O'Brien St.",
        city: 'São Paulo',
        state_or_province: 'Île-de-France',
      };

      userProfileRepository.findOne.mockResolvedValue(mockUserProfile as any);
      userProfileRepository.update.mockResolvedValue({ ...mockUserProfile, ...updateDto } as any);

      const result = await service.update('user-123', updateDto);

      expect(result.address_line1).toBe("123 O'Brien St.");
      expect(result.city).toBe('São Paulo');
      expect(result.state_or_province).toBe('Île-de-France');
    });

    it('should handle null values in update DTO', async () => {
      const updateDto: UpdateUserDto = {
        address_line2: null,
        notification_token: null,
      };

      userProfileRepository.findOne.mockResolvedValue(mockUserProfile as any);
      userProfileRepository.update.mockResolvedValue({ ...mockUserProfile, ...updateDto } as any);

      const result = await service.update('user-123', updateDto);

      expect(result.address_line2).toBeNull();
      expect(result.notification_token).toBeNull();
    });
  });
});
