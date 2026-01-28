import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';

import { IUser, UserStatus } from '../../../database/models/user';
import { RestrictionErrorType, RestrictionException } from '../../../exceptions/restriction_exception';
import { AccessTokenService } from '../accessToken/accessToken.service';
import { UserRepository } from '../user/user.repository';
import { JwtObject } from './jwtObject';
import { TokenPayload } from './tokenPayload.interface';

@Injectable()
export class JwtStrategyService extends PassportStrategy(Strategy, 'jwt') {
  @Inject(UserRepository)
  private readonly userRepository: UserRepository;

  @Inject(AccessTokenService)
  private readonly accessTokenService: AccessTokenService;

  constructor() {
    super(JwtObject);
  }

  async validate({ email, phone_number, username, id, identity }: TokenPayload) {
    if (!id) {
      throw new ForbiddenException('Unauthorized');
    }

    // Verify that the token's identity exists in Redis
    // This ensures that when a user logs in from another device, old sessions are invalidated
    if (identity) {
      const accessToken = await this.accessTokenService.findByIdentity(id, identity);

      if (!accessToken) {
        throw new RestrictionException(RestrictionErrorType.ERR_USER_SESSION_EXPIRED);
      }
    }

    const user: IUser = (await this.userRepository
      .query()
      .where((builder) => {
        if (email) {
          builder = builder.whereILike('email', email);
        }
        if (username) {
          builder = builder.orWhereILike('username', username);
        }
        if (phone_number) {
          builder = builder.orWhereILike('phone_number', phone_number);
        }

        return builder;
      })
      .where('id', id)
      .withGraphFetched('[userRoles]')
      .first()) as unknown as IUser;

    if (!user) {
      throw new UnauthorizedException('Expired login session');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account not active');
    }

    delete user.password;

    return user;
  }
}
