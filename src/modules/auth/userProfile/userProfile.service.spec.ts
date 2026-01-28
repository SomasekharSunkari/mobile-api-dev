import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CountryModel } from '../../../database';
import { S3Service } from '../../../services/s3';
import { UpdateUserDto } from './dto/updateUser.dto';
import { UserProfileRepository } from './userProfile.repository';
import { UserProfileService } from './userProfile.service';

describe('UserProfileService', () => {
  let service: UserProfileService;
  let userProfileRepository: jest.Mocked<UserProfileRepository>;
  let s3Service: jest.Mocked<S3Service>;

  const mockUserProfile = {
    id: 'profile-1',
    user_id: 'user-1',
    gender: 'male',
    address_line1: '123 Test St',
    address_line2: '',
    city: 'Test City',
    state_or_province: 'Test State',
    postal_code: '12345',
    dob: new Date('1990-01-01'),
    notification_token: 'test-token',
    avatar_url: null,
    image_key: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const mockUserProfileRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
      transaction: jest.fn(),
    };

    const mockS3Service = {
      generateUniqueKey: jest.fn(),
      uploadBuffer: jest.fn(),
      deleteObject: jest.fn(),
      getSignedUrl: jest.fn(),
      getSignedUploadUrl: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserProfileService,
        { provide: UserProfileRepository, useValue: mockUserProfileRepository },
        { provide: S3Service, useValue: mockS3Service },
      ],
    }).compile();

    service = module.get<UserProfileService>(UserProfileService);
    userProfileRepository = module.get(UserProfileRepository);
    s3Service = module.get(S3Service);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('update', () => {
    const updateUserDto: UpdateUserDto = {
      gender: 'female',
      address_line1: '456 New St',
      city: 'New City',
    };

    it('should update user profile successfully without country_id', async () => {
      userProfileRepository.findOne.mockResolvedValue(mockUserProfile as any);
      userProfileRepository.update.mockResolvedValue({ ...mockUserProfile, ...updateUserDto } as any);

      const result = await service.update('user-1', updateUserDto);

      expect(userProfileRepository.findOne).toHaveBeenCalledWith({ user_id: 'user-1' });
      expect(userProfileRepository.update).toHaveBeenCalledWith({ user_id: 'user-1' }, updateUserDto);
      expect(result).toEqual({ ...mockUserProfile, ...updateUserDto });
    });

    it('should update user profile successfully with valid country_id', async () => {
      const mockCountry = {
        id: 'country-1',
        name: 'Test Country',
      };

      const updateDtoWithCountry: UpdateUserDto = {
        ...updateUserDto,
        country_id: 'country-1',
      };

      const mockQueryBuilder = {
        findOne: jest.fn().mockResolvedValue(mockCountry),
      };

      jest.spyOn(CountryModel, 'query').mockReturnValue(mockQueryBuilder as any);
      userProfileRepository.findOne.mockResolvedValue(mockUserProfile as any);
      userProfileRepository.update.mockResolvedValue({ ...mockUserProfile, ...updateDtoWithCountry } as any);

      const result = await service.update('user-1', updateDtoWithCountry);

      expect(CountryModel.query).toHaveBeenCalled();
      expect(mockQueryBuilder.findOne).toHaveBeenCalledWith({ id: 'country-1' });
      expect(userProfileRepository.findOne).toHaveBeenCalledWith({ user_id: 'user-1' });
      expect(userProfileRepository.update).toHaveBeenCalledWith({ user_id: 'user-1' }, updateDtoWithCountry);
      expect(result).toEqual({ ...mockUserProfile, ...updateDtoWithCountry });
    });

    it('should throw NotFoundException when country does not exist', async () => {
      const updateDtoWithCountry: UpdateUserDto = {
        ...updateUserDto,
        country_id: 'invalid-country',
      };

      const mockQueryBuilder = {
        findOne: jest.fn().mockResolvedValue(null),
      };

      jest.spyOn(CountryModel, 'query').mockReturnValue(mockQueryBuilder as any);

      await expect(service.update('user-1', updateDtoWithCountry)).rejects.toThrow(
        new NotFoundException('Country not found'),
      );

      expect(CountryModel.query).toHaveBeenCalled();
      expect(mockQueryBuilder.findOne).toHaveBeenCalledWith({ id: 'invalid-country' });
      expect(userProfileRepository.findOne).not.toHaveBeenCalled();
      expect(userProfileRepository.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when user profile not found', async () => {
      userProfileRepository.findOne.mockResolvedValue(null);

      await expect(service.update('user-1', updateUserDto)).rejects.toThrow(
        new NotFoundException('User profile not found'),
      );

      expect(userProfileRepository.findOne).toHaveBeenCalledWith({ user_id: 'user-1' });
      expect(userProfileRepository.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when update fails', async () => {
      userProfileRepository.findOne.mockResolvedValue(mockUserProfile as any);
      userProfileRepository.update.mockRejectedValue(new Error('Update failed'));

      await expect(service.update('user-1', updateUserDto)).rejects.toThrow(
        new NotFoundException('Something went wrong while updating user profile'),
      );

      expect(userProfileRepository.findOne).toHaveBeenCalledWith({ user_id: 'user-1' });
      expect(userProfileRepository.update).toHaveBeenCalledWith({ user_id: 'user-1' }, updateUserDto);
    });
  });

  describe('findByUserId', () => {
    it('should find user profile by user id successfully', async () => {
      userProfileRepository.findOne.mockResolvedValue(mockUserProfile as any);

      const result = await service.findByUserId('user-1');

      expect(userProfileRepository.findOne).toHaveBeenCalledWith({ user_id: 'user-1' });
      expect(result).toEqual(mockUserProfile);
    });

    it('should throw NotFoundException when user profile not found', async () => {
      userProfileRepository.findOne.mockResolvedValue(null);

      await expect(service.findByUserId('user-1')).rejects.toThrow(new NotFoundException('User profile not found'));

      expect(userProfileRepository.findOne).toHaveBeenCalledWith({ user_id: 'user-1' });
    });

    it('should not call getSignedUrl when avatar_url is null', async () => {
      userProfileRepository.findOne.mockResolvedValue(mockUserProfile as any);

      await service.findByUserId('user-1');

      expect(s3Service.getSignedUrl).not.toHaveBeenCalled();
    });
  });

  describe('getUploadUrl', () => {
    it('should generate signed upload URL successfully', async () => {
      const generatedKey = 'profile-images/user-1/unique-key.jpg';
      const signedUrl = 'https://s3.amazonaws.com/bucket/profile-images/user-1/unique-key.jpg?signed';
      const contentType = 'image/png';

      s3Service.generateUniqueKey.mockReturnValue(generatedKey);
      s3Service.getSignedUploadUrl.mockResolvedValue(signedUrl);

      const result = await service.getUploadUrl('user-1', contentType);

      expect(s3Service.generateUniqueKey).toHaveBeenCalledWith('profile-images', 'user-1');
      expect(s3Service.getSignedUploadUrl).toHaveBeenCalledWith(generatedKey, contentType, 3600);
      expect(result).toEqual({
        uploadUrl: signedUrl,
        key: generatedKey,
        expiresIn: 3600,
      });
    });

    it('should generate signed upload URL with default content type', async () => {
      const generatedKey = 'profile-images/user-1/unique-key.jpg';
      const signedUrl = 'https://s3.amazonaws.com/bucket/profile-images/user-1/unique-key.jpg?signed';

      s3Service.generateUniqueKey.mockReturnValue(generatedKey);
      s3Service.getSignedUploadUrl.mockResolvedValue(signedUrl);

      const result = await service.getUploadUrl('user-1');

      expect(s3Service.generateUniqueKey).toHaveBeenCalledWith('profile-images', 'user-1');
      expect(s3Service.getSignedUploadUrl).toHaveBeenCalledWith(generatedKey, 'image/jpeg', 3600);
      expect(result).toEqual({
        uploadUrl: signedUrl,
        key: generatedKey,
        expiresIn: 3600,
      });
    });

    it('should throw InternalServerErrorException when S3 key generation fails', async () => {
      s3Service.generateUniqueKey.mockImplementation(() => {
        throw new Error('S3 key generation failed');
      });

      await expect(service.getUploadUrl('user-1')).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException when getting signed URL fails', async () => {
      s3Service.generateUniqueKey.mockReturnValue('key');
      s3Service.getSignedUploadUrl.mockRejectedValue(new Error('S3 error'));

      await expect(service.getUploadUrl('user-1')).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('serializeError', () => {
    it('should return unknown error message for null error', () => {
      const result = service['serializeError'](null);

      expect(result).toEqual({ message: 'Unknown error' });
    });

    it('should return unknown error message for undefined error', () => {
      const result = service['serializeError'](undefined);

      expect(result).toEqual({ message: 'Unknown error' });
    });

    it('should serialize basic error with message and name', () => {
      const error = new Error('Test error');

      const result = service['serializeError'](error);

      expect(result.message).toBe('Test error');
      expect(result.name).toBe('Error');
      expect(result.stack).toBeDefined();
    });

    it('should include AWS SDK metadata when present', () => {
      const awsError: any = new Error('AWS Error');
      awsError.$metadata = {
        httpStatusCode: 403,
        requestId: 'test-request-id',
      };

      const result = service['serializeError'](awsError);

      expect(result.message).toBe('AWS Error');
      expect(result.httpStatusCode).toBe(403);
      expect(result.requestId).toBe('test-request-id');
    });

    it('should include error code when present', () => {
      const errorWithCode: any = new Error('Access denied');
      errorWithCode.code = 'AccessDenied';

      const result = service['serializeError'](errorWithCode);

      expect(result.message).toBe('Access denied');
      expect(result.code).toBe('AccessDenied');
    });

    it('should truncate stack trace to first 5 lines', () => {
      const error = new Error('Test error');

      const result = service['serializeError'](error);

      const stackLines = result.stack.split('\n');
      expect(stackLines.length).toBeLessThanOrEqual(5);
    });

    it('should handle error without stack trace', () => {
      const errorWithoutStack = { message: 'No stack', name: 'CustomError' };

      const result = service['serializeError'](errorWithoutStack);

      expect(result.message).toBe('No stack');
      expect(result.name).toBe('CustomError');
      expect(result.stack).toBeUndefined();
    });

    it('should use default message when error.message is empty', () => {
      const errorWithoutMessage = { name: 'EmptyError' };

      const result = service['serializeError'](errorWithoutMessage);

      expect(result.message).toBe('Unknown error');
      expect(result.name).toBe('EmptyError');
    });

    it('should use default name when error.name is empty', () => {
      const errorWithoutName = { message: 'Test message' };

      const result = service['serializeError'](errorWithoutName);

      expect(result.message).toBe('Test message');
      expect(result.name).toBe('Error');
    });
  });
});
