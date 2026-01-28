import { BadRequestException, Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import * as jwt from 'jsonwebtoken';
import { DateTime } from 'luxon';
import { EnvironmentService } from '../../../config';
import { RedisService } from '../../../services/redis/redis.service';
import { UtilsService } from '../../../utils/utils.service';
import { AccessTokenService } from '../accessToken';
import { AuthService } from '../auth.service';
import { UserRepository } from '../user/user.repository';

/** Redis key prefix for refresh tokens */
const REFRESH_TOKEN_PREFIX = 'refresh_token';

/** Refresh token TTL in seconds (2 years) */
const REFRESH_TOKEN_TTL_SECONDS = 2 * 365 * 24 * 60 * 60;

/** Interface representing the stored refresh token data in Redis */
export interface StoredRefreshToken {
  user_id: string;
  identity: string;
  is_used: boolean;
  expiration_time: string;
}

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  @Inject(RedisService)
  private readonly redisService: RedisService;

  @Inject(AuthService)
  private readonly authService: AuthService;

  @Inject(AccessTokenService)
  private readonly accessTokenService: AccessTokenService;

  @Inject(UserRepository)
  private readonly userRepository: UserRepository;

  /**
   * Generates a Redis key for the refresh token
   */
  private getRedisKey(userId: string): string {
    return `${REFRESH_TOKEN_PREFIX}:${userId}`;
  }

  /**
   * Creates a new refresh token and stores it in Redis
   */
  public async create(userId: string) {
    this.logger.log('Create', 'RefreshTokenService');
    try {
      // Delete existing refresh token for this user
      await this.delete(userId);

      const JWT_SECRET_TOKEN = EnvironmentService.getValue('JWT_SECRET_TOKEN');
      const identity = createId();
      const token = jwt.sign({ userId, identity }, JWT_SECRET_TOKEN);

      const expirationTime = DateTime.now().plus({ years: 2 }).toSQL();

      const refreshTokenData: StoredRefreshToken = {
        user_id: userId,
        identity,
        is_used: false,
        expiration_time: expirationTime,
      };

      const redisKey = this.getRedisKey(userId);
      await this.redisService.set(redisKey, JSON.stringify(refreshTokenData), REFRESH_TOKEN_TTL_SECONDS);

      return { refreshToken: refreshTokenData, encodedToken: token };
    } catch (error) {
      this.logger.error(error.message);
      throw new InternalServerErrorException('Something went wrong While creating refresh token');
    }
  }

  /**
   * Refreshes the auth token using a valid refresh token
   */
  public async refreshAuthToken(token: string) {
    this.logger.log('refreshAuthToken', 'RefreshTokenService');
    const JWT_SECRET_TOKEN = EnvironmentService.getValue('JWT_SECRET_TOKEN');

    // Verify the JWT token
    const decoded = jwt.verify(token, JWT_SECRET_TOKEN, (err, decoded) => {
      if (err) {
        this.logger.error(err.message);
        throw new InternalServerErrorException(err.message);
      }
      return decoded;
    }) as any as { userId: string; identity: string };

    if (!decoded) {
      throw new BadRequestException('Invalid refresh token');
    }

    const { userId, identity } = decoded;

    if (!identity) {
      throw new BadRequestException('Invalid refresh token');
    }

    // Get the stored refresh token from Redis
    const refreshToken = await this.findByUserId(userId);

    if (!refreshToken) {
      throw new BadRequestException('Refresh Token not found');
    }

    // Check if the identity from token matches the one in Redis
    if (identity !== refreshToken.identity) {
      throw new BadRequestException('Invalid refresh token');
    }

    // Check if the token is used
    if (refreshToken.is_used) {
      throw new BadRequestException('Refresh token has already been used');
    }

    // Check if the token is expired
    const expirationTime = refreshToken.expiration_time;
    if (UtilsService.isDatePassed(expirationTime)) {
      throw new BadRequestException('Refresh token has expired');
    }

    // Get the user
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const newIdentity = createId();
    const newToken = jwt.sign({ userId, identity: newIdentity }, JWT_SECRET_TOKEN);

    try {
      const tokenData = await this.accessTokenService.create({
        id: user.id,
        email: user.email,
        phone_number: user.phone_number,
      });

      // Update the refresh token with new identity
      const updatedTokenData: StoredRefreshToken = {
        user_id: userId,
        identity: newIdentity,
        is_used: false,
        expiration_time: refreshToken.expiration_time,
      };

      const redisKey = this.getRedisKey(userId);
      const remainingTtl = await this.getRemainingTtl(userId);
      await this.redisService.set(
        redisKey,
        JSON.stringify(updatedTokenData),
        remainingTtl || REFRESH_TOKEN_TTL_SECONDS,
      );

      return { refreshToken: newToken, authToken: tokenData.decodedToken };
    } catch (error) {
      this.logger.error(error.message);
      throw new InternalServerErrorException('Something went wrong');
    }
  }

  /**
   * Gets the remaining TTL for a user's refresh token
   */
  private async getRemainingTtl(userId: string): Promise<number | null> {
    const client = this.redisService.getClient();
    const keyPrefix = process.env.REDIS_KEY_PREFIX || 'onedosh:';
    const redisKey = this.getRedisKey(userId);
    const ttl = await client.ttl(`${keyPrefix}${redisKey}`);
    return ttl > 0 ? ttl : null;
  }

  /**
   * Gets the refresh token by user ID
   */
  public async getRefreshTokenByUserId(userId: string) {
    this.logger.log('getRefreshTokenByUserId', 'RefreshTokenService');
    const refreshToken = await this.findByUserId(userId);
    if (!refreshToken) {
      throw new BadRequestException('Refresh token not found');
    }

    return refreshToken;
  }

  /**
   * Finds a refresh token by user ID
   */
  private async findByUserId(userId: string): Promise<StoredRefreshToken | null> {
    try {
      const redisKey = this.getRedisKey(userId);
      const data = await this.redisService.get(redisKey);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as StoredRefreshToken;
    } catch (error) {
      this.logger.error(error.message);
      return null;
    }
  }

  /**
   * Verifies if a refresh token is valid for a user
   */
  public async verify(userId: string, token: string): Promise<boolean> {
    const JWT_SECRET_TOKEN = EnvironmentService.getValue('JWT_SECRET_TOKEN');

    try {
      const decoded = jwt.verify(token, JWT_SECRET_TOKEN) as any as { userId: string; identity: string };

      if (!decoded?.identity) {
        return false;
      }

      const refreshToken = await this.findByUserId(userId);

      if (!refreshToken) {
        return false;
      }

      if (refreshToken.is_used) {
        return false;
      }

      if (decoded.identity !== refreshToken.identity) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Deletes the refresh token for a user
   */
  public async delete(userId: string): Promise<number> {
    this.logger.log('Delete', 'RefreshTokenService');
    const redisKey = this.getRedisKey(userId);
    return await this.redisService.del(redisKey);
  }
}
