import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import * as jwt from 'jsonwebtoken';
import { DateTime } from 'luxon';
import { Transaction } from 'objection';
import { EnvironmentService } from '../../../config';
import { IVerificationType } from '../../../database/models/verificationToken/verificationToken.interface';
import { VerificationTokenRepository } from './verificationToken.repository';

@Injectable()
export class VerificationTokenService {
  private readonly logger = new Logger(VerificationTokenService.name);

  @Inject(VerificationTokenRepository)
  private readonly verificationTokenRepository: VerificationTokenRepository;

  /**
   * Generate a verification token for a user
   * @param userId - The ID of the user
   * @param verificationType - The type of verification
   * @param expiresInMinutes - Token expiration time in minutes (default: 30)
   * @param trx - Optional transaction
   * @returns Object containing the JWT token and token record
   */
  async generateToken(
    userId: string,
    verificationType: IVerificationType,
    expiresInMinutes: number = 30,
    trx?: Transaction,
  ) {
    await this.invalidateUserTokens(userId, verificationType, trx);
    this.logger.log(`Generating verification token for userId=${userId}, type=${verificationType}`);

    const tokenIdentifier = createId();
    const expiresAt = DateTime.now().plus({ minutes: expiresInMinutes }).toSQL();

    const tokenRecord = await this.verificationTokenRepository.create(
      {
        user_id: userId,
        token_identifier: tokenIdentifier,
        verification_type: verificationType,
        expires_at: expiresAt,
        is_used: false,
      },
      trx,
    );

    const JWT_SECRET_TOKEN = EnvironmentService.getValue('JWT_SECRET_TOKEN');
    const jwtToken = jwt.sign(
      {
        token_identifier: tokenIdentifier,
        user_id: userId,
        verification_type: verificationType,
      },
      JWT_SECRET_TOKEN,
      { expiresIn: `${expiresInMinutes}m` },
    );

    this.logger.log(`Verification token generated successfully for userId=${userId}, tokenId=${tokenRecord.id}`);

    return {
      token: jwtToken,
      tokenRecord,
    };
  }

  /**
   * Verify and validate a JWT token
   * @param token - The JWT token to verify
   * @returns The verification token record from database
   * @throws NotFoundException if token is invalid, expired, or already used
   */
  async verifyToken(token: string) {
    this.logger.log('Verifying token');

    const JWT_SECRET_TOKEN = EnvironmentService.getValue('JWT_SECRET_TOKEN');

    let decodedToken: { token_identifier: string; user_id: string; verification_type: IVerificationType };

    try {
      decodedToken = jwt.verify(token, JWT_SECRET_TOKEN) as {
        token_identifier: string;
        user_id: string;
        verification_type: IVerificationType;
      };
    } catch (error) {
      this.logger.warn(`Token verification failed: ${error.message}`);
      throw new NotFoundException('Invalid or expired token');
    }

    const { token_identifier } = decodedToken;

    const tokenRecord = await this.verificationTokenRepository.findOne({
      token_identifier,
    });

    if (!tokenRecord) {
      this.logger.warn(`Token not found in database: identifier=${token_identifier}`);
      throw new NotFoundException('Token not found');
    }

    if (tokenRecord.is_used) {
      this.logger.warn(`Token already used: identifier=${token_identifier}`);
      throw new NotFoundException('Token has already been used');
    }

    if (new Date() > new Date(tokenRecord.expires_at)) {
      this.logger.warn(`Token has expired: identifier=${token_identifier}`);
      throw new NotFoundException('Token has expired');
    }

    this.logger.log(`Token verified successfully: identifier=${token_identifier}`);
    await this.markTokenAsUsed(token_identifier);
    return tokenRecord;
  }

  /**
   * Mark a token as used
   * @param tokenIdentifier - The unique token identifier
   * @param trx - Optional transaction
   */
  async markTokenAsUsed(tokenIdentifier: string, trx?: Transaction) {
    this.logger.log(`Marking token as used: identifier=${tokenIdentifier}`);

    const tokenRecord = await this.verificationTokenRepository.findOne({ token_identifier: tokenIdentifier });

    if (!tokenRecord) {
      this.logger.warn(`Token not found when marking as used: identifier=${tokenIdentifier}`);
      throw new NotFoundException('Token not found');
    }

    await this.verificationTokenRepository.update(
      tokenRecord.id,
      {
        is_used: true,
        used_at: DateTime.now().toSQL(),
      },
      { trx },
    );

    this.logger.log(`Token marked as used successfully: identifier=${tokenIdentifier}`);
  }

  /**
   * Invalidate all unused tokens for a user and verification type
   * @param userId - The user ID
   * @param verificationType - The verification type
   * @param trx - Optional transaction
   */
  async invalidateUserTokens(userId: string, verificationType: IVerificationType, trx?: Transaction) {
    this.logger.log(`Invalidating tokens for userId=${userId}, type=${verificationType}`);

    const tokens = await this.verificationTokenRepository
      .query(trx)
      .where({
        user_id: userId,
        verification_type: verificationType,
        is_used: false,
      })
      .where('expires_at', '>', new Date());

    if (tokens.length > 0) {
      await this.verificationTokenRepository
        .query(trx)
        .patch({
          is_used: true,
          used_at: DateTime.now().toSQL(),
        } as any)
        .where({
          user_id: userId,
          verification_type: verificationType,
          is_used: false,
        })
        .where('expires_at', '>', new Date());

      this.logger.log(`Invalidated ${tokens.length} tokens for userId=${userId}, type=${verificationType}`);
    }
  }

  /**
   * Get a valid token by token identifier
   * @param tokenIdentifier - The unique token identifier
   * @returns The verification token record if valid
   * @throws NotFoundException if token is invalid, expired, or already used
   */
  async getValidToken(tokenIdentifier: string) {
    this.logger.log(`Getting valid token: identifier=${tokenIdentifier}`);

    const tokenRecord = await this.verificationTokenRepository.findOne({
      token_identifier: tokenIdentifier,
    });

    if (!tokenRecord) {
      throw new NotFoundException('Token not found');
    }

    if (tokenRecord.is_used) {
      throw new NotFoundException('Token has already been used');
    }

    if (new Date() > new Date(tokenRecord.expires_at)) {
      throw new NotFoundException('Token has expired');
    }

    return tokenRecord;
  }
}
