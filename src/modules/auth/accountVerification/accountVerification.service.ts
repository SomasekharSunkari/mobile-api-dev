import { BadRequestException, Inject, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { DateTime } from 'luxon';
import { EnvironmentService } from '../../../config';
import { UtilsService } from '../../../utils/utils.service';
import { AccountVerificationRepository } from './accountVerification.repository';

import { AccountVerificationModel } from '../../../database/models/accountVerification/accountVerification.model';
import { VerifyCodeDto } from './dtos/verifiyCode';

export class AccountVerificationService {
  private readonly logger = new Logger(AccountVerificationService.name);
  @Inject(AccountVerificationRepository)
  private readonly accountVerificationRepository: AccountVerificationRepository;

  public async create(data: Partial<AccountVerificationModel>) {
    await this.accountVerificationRepository.create({
      code: data.code,
      email: data.email?.toLowerCase(),
      expiration_time: data.expiration_time,
    });
  }

  async verifyAccount(data: VerifyCodeDto) {
    this.logger.log('Initializing account verification', 'verifyAccount', 'AccountVerificationService');

    // Get the validated verification code directly from findOrThrowIfCodeIsInvalid
    const verificationCode = await this.findOrThrowIfCodeIsInvalid(data.code, data.email);

    try {
      const JWT_SECRET_TOKEN = EnvironmentService.getValue('JWT_SECRET_TOKEN');

      /**
       * This token will be used to register the user
       */
      const registrationToken = jwt.sign({ verification_token: verificationCode.code }, JWT_SECRET_TOKEN);
      return { success: true, registrationToken };
    } catch (error) {
      this.logger.error(error?.message, 'verifyAccount', 'AccountVerificationService');
      throw new InternalServerErrorException('Error while verifying the account');
    }
  }

  /**
   * Verify the registration token
   * @param token
   * @returns
   * @description This function will verify the registration token and return the account verification object
   */
  public async verifyRegistrationToken(token: string) {
    try {
      const JWT_SECRET_TOKEN = EnvironmentService.getValue('JWT_SECRET_TOKEN');
      const decodedToken = jwt.verify(token, JWT_SECRET_TOKEN) as { verification_token: string };
      const { verification_token: code } = decodedToken;

      const accountVerification = await this.accountVerificationRepository.findOne({ code });

      if (!accountVerification) {
        throw new NotFoundException('Account verification not found');
      }

      if (accountVerification.is_used) {
        throw new NotFoundException('Account verification already used');
      }

      return accountVerification;
    } catch (error) {
      // Re-throw NotFoundException as they are intentional business logic exceptions
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(error?.message, 'verifyRegistrationToken', 'AccountVerificationService');
      throw new BadRequestException('Error while verifying the account');
    }
  }

  public async markAccountVerificationAsUsed(userId: string, id: string, trx?: any) {
    return this.accountVerificationRepository.update({ id }, { is_used: true, user_id: userId }, { trx });
  }

  private async findOrThrowIfCodeIsInvalid(code: string, email: string): Promise<AccountVerificationModel> {
    const now = DateTime.now().toSQL();

    // Query for the most recent, non-expired, unused verification code
    const accountVerificationCode = (await this.accountVerificationRepository
      .query()
      .whereILike('email', email)
      .andWhere({ is_used: false })
      .andWhere('expiration_time', '>', now)
      .orderBy('created_at', 'desc')
      .first()) as AccountVerificationModel;

    if (!accountVerificationCode) {
      throw new NotFoundException('Invalid verification code. Please check the code and try again.');
    }

    // Check if the code matches
    const isCodeMatch = await UtilsService.comparePassword(code, accountVerificationCode.code);
    if (!isCodeMatch) {
      throw new NotFoundException('Invalid code, please try again');
    }

    return accountVerificationCode;
  }

  public async expireUnusedCode(identifier: string) {
    const now = DateTime.now().toSQL();
    const passedDate = DateTime.now().minus({ minutes: 1 }).toSQL();

    // Expire ALL active, unused codes for this email/user_id
    await this.accountVerificationRepository
      .query()
      .where((builder) => {
        builder.whereILike('email', identifier).orWhere({ user_id: identifier });
      })
      .andWhere('expiration_time', '>', now)
      .andWhere({ is_used: false })
      .patch({ expiration_time: passedDate } as Partial<AccountVerificationModel>);
  }
}
