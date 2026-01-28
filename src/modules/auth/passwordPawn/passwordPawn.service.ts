import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import axios from 'axios';
import { createHash } from 'crypto';
import { EnvironmentService } from '../../../config';

@Injectable()
export class PasswordPawnService {
  private readonly logger = new Logger(PasswordPawnService.name);
  private readonly passwordPawnUrl: string = EnvironmentService.getValue('HIBP_URL');

  async checkIfPasswordIsPawned(password: string): Promise<boolean> {
    const hashedPassword = createHash('sha1').update(password).digest('hex').toUpperCase();
    const fiveChars = hashedPassword.slice(0, 5);

    try {
      const response = await axios.get(`${this.passwordPawnUrl}/range/${fiveChars}`);
      const hashes = response.data.split('\r\n');
      const passwordSuffix = hashedPassword.slice(5);
      const isPawned = hashes.find((hash: string) => hash.startsWith(passwordSuffix));

      return isPawned;
    } catch (error) {
      this.logger.error(error.message, 'PasswordPawnService');
      throw new InternalServerErrorException('Error checking password against PasswordPawn API');
    }
  }
}
