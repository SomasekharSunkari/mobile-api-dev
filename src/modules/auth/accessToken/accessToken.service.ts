import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import { DateTime } from 'luxon';
import { RedisService } from '../../../services/redis/redis.service';
import { UtilsService } from '../../../utils/utils.service';
import { JWT_EXPIRATION_MINS } from '../auth.constants';
import { AuthService } from '../auth.service';
import { TokenPayload } from '../strategies/tokenPayload.interface';
import { UserRepository } from '../user/user.repository';

/** Redis key prefix for access tokens */
const ACCESS_TOKEN_PREFIX = 'access_token';

/** Interface representing the stored access token data in Redis */
export interface StoredAccessToken {
  user_id: string;
  token: string;
  expiration_time: string;
  identity: string;
}

@Injectable()
export class AccessTokenService {
  private readonly logger = new Logger(AccessTokenService.name);

  @Inject(RedisService)
  private readonly redisService: RedisService;

  @Inject(AuthService)
  private readonly authService: AuthService;

  @Inject(UserRepository)
  private readonly userRepository: UserRepository;

  /**
   * Generates a Redis key for the access token
   */
  private getRedisKey(userId: string, identity: string): string {
    return `${ACCESS_TOKEN_PREFIX}:${userId}:${identity}`;
  }

  /**
   * Generates a Redis pattern for all user tokens
   */
  private getUserTokensPattern(userId: string): string {
    return `${ACCESS_TOKEN_PREFIX}:${userId}:*`;
  }

  /**
   * Creates a new access token and stores it in Redis
   * @param data - Token payload data containing user information
   * @param _trx - Unused, kept for backward compatibility
   * @param shallow - If true, does not delete existing tokens before creating new one
   */
  public async create(data: Partial<TokenPayload>, _trx?: unknown, shallow: boolean = false) {
    this.logger.log('Create', 'AccessTokenService');
    try {
      const { email, phone_number, id } = data;

      // Check if login restrictions are disabled for this user (allows multiple devices)
      const user = await this.userRepository.findById(id);
      const isRestrictionDisabled = user?.disable_login_restrictions || false;
      const shouldAllowMultipleDevices = isRestrictionDisabled || shallow;

      if (!shouldAllowMultipleDevices) {
        await this.deleteAllUserTokens(id);
      }

      const identity = createId();

      const token = await this.authService.signJwt({ email, id, phone_number, identity });
      const hashedToken = await UtilsService.hashPassword(token.access_token);

      const expirationTime = DateTime.fromJSDate(token.expiration).toSQL();

      const accessTokenData: StoredAccessToken = {
        user_id: id,
        token: hashedToken,
        expiration_time: expirationTime,
        identity,
      };

      // Store in Redis with TTL matching JWT expiration (in seconds)
      const ttlSeconds = JWT_EXPIRATION_MINS * 60 * 60;
      const redisKey = this.getRedisKey(id, identity);
      await this.redisService.set(redisKey, JSON.stringify(accessTokenData), ttlSeconds);

      return { accessToken: accessTokenData, decodedToken: token };
    } catch (error) {
      this.logger.error(error.message);
      throw new InternalServerErrorException('Something went wrong While creating access token');
    }
  }

  /**
   * Finds an access token by user ID and identity
   * @param userId - The user's ID
   * @param identity - The token identity
   */
  public async findByIdentity(userId: string, identity: string): Promise<StoredAccessToken | null> {
    this.logger.log('FindByIdentity', 'AccessTokenService');
    try {
      const redisKey = this.getRedisKey(userId, identity);
      const data = await this.redisService.get(redisKey);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as StoredAccessToken;
    } catch (error) {
      this.logger.error(error.message);
      return null;
    }
  }

  /**
   * Deletes all access tokens for a user
   * @param userId - The user's ID
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async delete(userId: string, _trx?: unknown) {
    this.logger.log('Delete', 'AccessTokenService');
    try {
      return await this.deleteAllUserTokens(userId);
    } catch (error) {
      this.logger.error(error.message);
      throw new InternalServerErrorException('Something went wrong While deleting access token');
    }
  }

  /**
   * Deletes all access tokens for a user using pattern matching
   */
  private async deleteAllUserTokens(userId: string): Promise<number> {
    const pattern = this.getUserTokensPattern(userId);

    // Get all keys matching the pattern (with prefix applied)
    const keys = await this.redisService.keys(pattern);

    if (keys.length === 0) {
      return 0;
    }

    // Delete using the raw client since keys() returns full prefixed keys
    const client = this.redisService.getClient();
    return await client.del(...keys);
  }
}
