import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../database/base/base.repository';
import { DatabaseSchema } from '../../../database/database.schema';
import { DatabaseTables } from '../../../database/database.table';
import { UserStatus } from '../../../database/models/user/user.interface';
import { UserModel } from '../../../database/models/user/user.model';

@Injectable()
export class UserRepository extends BaseRepository<UserModel> {
  constructor() {
    super(UserModel);
  }

  /**
   * Find user by email, excluding soft-deleted, non-active users, and users with account delete requests.
   */
  public async findActiveByEmail(email: string): Promise<UserModel | undefined> {
    return (await this.query()
      .modify('notDeleted')
      .where('status', UserStatus.ACTIVE)
      .whereNotExists((builder) => {
        builder
          .select('*')
          .from(`${DatabaseSchema.apiService}.${DatabaseTables.account_delete_requests}`)
          .whereRaw(
            `${DatabaseSchema.apiService}.${DatabaseTables.account_delete_requests}.user_id = ${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
          )
          .whereNull(`${DatabaseSchema.apiService}.${DatabaseTables.account_delete_requests}.deleted_at`);
      })
      .first()
      .whereILike('email', email)
      .withGraphFetched('[country]')) as UserModel;
  }

  /**
   * Find user by username, excluding soft-deleted, and users with account delete requests.
   */
  public async findActiveByUsername(username: string): Promise<UserModel | undefined> {
    return (await this.query()
      .modify('notDeleted')
      .where('status', UserStatus.ACTIVE)
      .whereNotExists((builder) => {
        builder
          .select('*')
          .from(`${DatabaseSchema.apiService}.${DatabaseTables.account_delete_requests}`)
          .whereRaw(
            `${DatabaseSchema.apiService}.${DatabaseTables.account_delete_requests}.user_id = ${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
          )
          .whereNull(`${DatabaseSchema.apiService}.${DatabaseTables.account_delete_requests}.deleted_at`);
      })
      .first()
      .whereILike('username', username)
      .withGraphFetched('[country]')) as UserModel;
  }

  /**
   * Find user by phone number, excluding soft-deleted, non-active users, and users with account delete requests.
   */
  public async findActiveByPhone(phone_number: string): Promise<UserModel | undefined> {
    return (await this.query()
      .modify('notDeleted')
      .where('status', UserStatus.ACTIVE)
      .whereNotExists((builder) => {
        builder
          .select('*')
          .from(`${DatabaseSchema.apiService}.${DatabaseTables.account_delete_requests}`)
          .whereRaw(
            `${DatabaseSchema.apiService}.${DatabaseTables.account_delete_requests}.user_id = ${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
          )
          .whereNull(`${DatabaseSchema.apiService}.${DatabaseTables.account_delete_requests}.deleted_at`);
      })
      .first()
      .whereILike('phone_number', phone_number)
      .withGraphFetched('[country]')) as UserModel;
  }

  /**
   * Find user by ID, excluding soft-deleted, non-active users, and users with account delete requests.
   */
  public async findActiveById(id: string): Promise<UserModel | undefined> {
    return (await this.query()
      .modify('notDeleted')
      .where('status', UserStatus.ACTIVE)
      .whereNotExists((builder) => {
        builder
          .select('*')
          .from(`${DatabaseSchema.apiService}.${DatabaseTables.account_delete_requests}`)
          .whereRaw(
            `${DatabaseSchema.apiService}.${DatabaseTables.account_delete_requests}.user_id = ${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
          )
          .whereNull(`${DatabaseSchema.apiService}.${DatabaseTables.account_delete_requests}.deleted_at`);
      })
      .findById(id)
      .withGraphFetched('[country]')) as UserModel;
  }
}
