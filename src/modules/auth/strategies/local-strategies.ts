import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import * as bcrypt from 'bcryptjs';
import { Strategy } from 'passport-local';
import { UserModel, UserStatus } from '../../../database/models/user';
import { AuthService } from '../auth.service';
import { ROLES } from '../guard';
import { UserRepository } from '../user/user.repository';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  @Inject(UserRepository)
  private readonly userRepository: UserRepository;

  @Inject(AuthService)
  private readonly authService: AuthService;

  constructor() {
    super({
      usernameField: 'email',
      passwordField: 'password',
    });
  }

  error(err: Error): void {
    console.error(err.message);
  }

  async validate(email: string, password: string): Promise<Partial<UserModel>> {
    if (!password) {
      throw new BadRequestException('Password is required');
    }

    email = email.toLowerCase();

    const user = (await this.userRepository
      .query()
      .select(UserModel.publicProperty())
      .modify('notDeleted')
      .whereILike('email', email)
      .first()) as UserModel;

    const dummyHash = '$2a$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ12';
    const passwordToCompare = user?.password || dummyHash;
    const isPasswordCorrect = await bcrypt.compare(password, passwordToCompare);

    if (!user || !isPasswordCorrect) {
      throw new ForbiddenException('Invalid credentials');
    }

    const isUserActive = user.userRoles.some((userRole) => userRole.slug === ROLES.ACTIVE_USER);

    if (user.status !== UserStatus.ACTIVE || !isUserActive) {
      const authToken = await this.authService.signJwt({
        id: user.id,
        email: user.email,
      });

      throw new ForbiddenException({
        message: 'Account not active',
        data: {
          user,
          authToken,
          accountActive: false,
        },
      });
    }

    delete user.password;
    return user;
  }
}
