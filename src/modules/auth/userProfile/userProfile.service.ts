import { Inject, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { CountryModel, UserProfileModel } from '../../../database';
import { S3Service } from '../../../services/s3';
import { UpdateUserDto } from './dto/updateUser.dto';
import { UserProfileRepository } from './userProfile.repository';
@Injectable()
export class UserProfileService {
  @Inject(UserProfileRepository)
  private readonly userProfileRepository: UserProfileRepository;

  @Inject(S3Service)
  private readonly s3Service: S3Service;

  private readonly logger = new Logger(UserProfileService.name);

  async update(userId: string, updateUserDto: UpdateUserDto) {
    this.logger.log('Update', 'UserProfileService');
    // Check if the country exists
    if (updateUserDto.country_id) {
      await this.throwIfCountryDoNotExist(updateUserDto);
    }

    const userProfile = await this.userProfileRepository.findOne({ user_id: userId });
    if (!userProfile) {
      throw new NotFoundException('User profile not found');
    }

    try {
      const newUserProfile = await this.userProfileRepository.update({ user_id: userId }, updateUserDto);

      return newUserProfile;
    } catch (error) {
      this.logger.error(`[update] Failed to update user profile: ${error.message}`, 'UserProfileService');
      const safeError = this.serializeError(error);
      this.logger.error(`[update] Failed to update user profile: ${JSON.stringify(safeError)}`, 'UserProfileService');
      throw new NotFoundException('Something went wrong while updating user profile');
    }
  }

  private async throwIfCountryDoNotExist(updateUserDto: UpdateUserDto) {
    const countryExists = await CountryModel.query().findOne({ id: updateUserDto.country_id });

    if (!countryExists) {
      throw new NotFoundException('Country not found');
    }
  }

  async findByUserId(userId: string) {
    this.logger.log(`findByUserId: ${userId}`, 'UserProfileService');

    const userProfile = await this.userProfileRepository.findOne({ user_id: userId });

    if (!userProfile) {
      throw new NotFoundException('User profile not found');
    }

    // Generate pre-signed URL for avatar access
    await this.populateAvatarUrl(userProfile);

    return userProfile;
  }

  async populateAvatarUrl(userProfile: UserProfileModel) {
    if (userProfile.image_key) {
      userProfile.avatar_url = await this.s3Service.getSignedUrl({
        key: userProfile.image_key,
        expiresIn: 3600,
      });
    }
    return userProfile;
  }

  async getUploadUrl(userId: string, contentType: string = 'image/jpeg') {
    this.logger.log(`getUploadUrl: ${userId}`, 'UserProfileService');

    const expiresIn = 3600; // 1 hour

    try {
      const key = this.s3Service.generateUniqueKey('profile-images', userId);
      const uploadUrl = await this.s3Service.getSignedUploadUrl(key, contentType, expiresIn);

      return {
        uploadUrl,
        key,
        expiresIn,
      };
    } catch (error) {
      this.logger.error(`[getUploadUrl] Failed to generate upload URL: ${error.message}`, 'UserProfileService');
      throw new InternalServerErrorException('Failed to generate upload URL');
    }
  }

  /**
   * Safely serialize error objects to avoid circular reference issues
   */
  private serializeError(error: any): Record<string, any> {
    if (!error) {
      return { message: 'Unknown error' };
    }

    const serialized: Record<string, any> = {
      message: error.message || 'Unknown error',
      name: error.name || 'Error',
    };

    // AWS SDK specific error properties
    if (error.$metadata) {
      serialized.httpStatusCode = error.$metadata.httpStatusCode;
      serialized.requestId = error.$metadata.requestId;
    }

    if (error.code) {
      serialized.code = error.code;
    }

    // Stack trace (first 5 lines)
    if (error.stack) {
      serialized.stack = error.stack.split('\n').slice(0, 5).join('\n');
    }

    return serialized;
  }
}
