import { Injectable } from '@nestjs/common';
import { addMinutes } from 'date-fns';
import * as jwt from 'jsonwebtoken';
import { EnvironmentService } from '../../config';
import { JWT_EXPIRATION_MINS } from './auth.constants';
import { JwtTokenResponse } from './auth.interface';
import { TokenPayload } from './strategies/tokenPayload.interface';
@Injectable()
export class AuthService {
  /**
   * Generates a signed JWT token using the provided payload
   */
  public async signJwt({ id, email, phone, identity }: Partial<TokenPayload>): Promise<JwtTokenResponse> {
    const JWT_SECRET_TOKEN = EnvironmentService.getValue('JWT_SECRET_TOKEN');

    const token = jwt.sign({ id, email, phone, identity }, JWT_SECRET_TOKEN, {
      expiresIn: `${JWT_EXPIRATION_MINS}hrs`,
    });

    const expiration = addMinutes(new Date(), JWT_EXPIRATION_MINS);

    return { access_token: token, expiration };
  }
}
