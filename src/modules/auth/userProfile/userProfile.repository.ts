import { Injectable, NotFoundException } from '@nestjs/common';
import { BaseRepository } from '../../../database/base';
import { IUserProfile, UserProfileModel } from '../../../database/';

@Injectable()
export class UserProfileRepository extends BaseRepository<UserProfileModel> {
  constructor() {
    super(UserProfileModel);
  }

  /**
   * Find profile by user_id, excluding soft-deleted profiles.
   * Returns a Promise that resolves to UserProfileModel or undefined.
   */
  public async findByUserId(user_id: string): Promise<IUserProfile | undefined> {
    return (await this.query().modify('notDeleted').findOne({ user_id })) as UserProfileModel;
  }

  /**
   * Find profile by ID, excluding soft-deleted profiles.
   * Returns a Promise that resolves to UserProfileModel or undefined.
   */
  public async findId(id: string): Promise<UserProfileModel | undefined> {
    return (await this.query().modify('notDeleted').findById(id)) as UserProfileModel;
  }

  /**
   * Updates the user's profile if it exists.
   * Throws an error if the profile does not exist.
   */
  public async updateProfile(userId: string, data: Partial<UserProfileModel>): Promise<UserProfileModel> {
    const profile = await this.findByUserId(userId);

    if (!profile) {
      throw new NotFoundException(`UserProfile not found for user_id: ${userId}`);
    }

    await this.query().patch(data).where({ user_id: userId });

    return this.findByUserId(userId) as Promise<UserProfileModel>;
  }
}
