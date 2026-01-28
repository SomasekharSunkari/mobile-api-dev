import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../database';
import { TransactionPinModel } from '../../../database/models/transactionPin/transactionPin.model';

/**
 * Repository for user security operations (PIN, etc).
 * Extends BaseRepository to provide CRUD and custom methods for UserSecurityModel.
 */
@Injectable()
export class TransactionPinRepository extends BaseRepository<TransactionPinModel> {
  constructor() {
    // Initialize repository with UserSecurityModel
    super(TransactionPinModel);
  }

  /**
   * Find a user's security record by user ID.
   * @param userId - The user's unique identifier
   */
  async findByUserId(userId: string): Promise<TransactionPinModel | undefined> {
    return (await this.query().findOne({ user_id: userId })) as TransactionPinModel;
  }

  /**
   * Update the transaction PIN hash for a user.
   * @param userId - The user's unique identifier
   * @param hashedPin - The hashed PIN to store
   */
  async updatePin(userId: string, hashedPin: string): Promise<void> {
    await this.update({ user_id: userId }, { pin: hashedPin });
  }

  /**
   * Create a new user security record with a PIN hash.
   * @param userId - The user's unique identifier
   * @param hashedPin - The hashed PIN to store
   */
  async createPin(userId: string, hashedPin: string): Promise<void> {
    await this.create({
      user_id: userId,
      pin: hashedPin,
    });
  }
}
