import { InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';
import { EnvironmentService } from '../../../config';
import { PasswordPawnService } from './passwordPawn.service';

jest.mock('crypto');

describe('PasswordPawnService', () => {
  let service: PasswordPawnService;
  const mockUrl = 'https://hibp.test';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(EnvironmentService, 'getValue').mockReturnValue(mockUrl);
    service = new PasswordPawnService();
  });

  describe('checkIfPasswordIsPawned', () => {
    it('should return true if password is pawned', async () => {
      const password = 'password123';
      const hash = '5BAA6';
      const suffix = '0032B8E1AFA93DFAF4C6D8A0A6C9E0E8';
      const fullHash = hash + suffix;
      const responseData = `${suffix}:2\r\nOTHERHASH:1`;
      jest.spyOn(axios, 'get').mockResolvedValue({ data: responseData });
      (crypto.createHash as jest.Mock).mockReturnValue({
        update: () => ({ digest: () => fullHash }),
      });

      const result = await service.checkIfPasswordIsPawned(password);
      expect(axios.get).toHaveBeenCalledWith(`${mockUrl}/range/${hash}`);
      expect(result).toBeTruthy();
    });

    it('should return undefined if password is not pawned', async () => {
      const password = 'notpawned';
      const hash = 'ABCDE';
      const suffix = '1234567890ABCDEF1234567890ABCDEF';
      const fullHash = hash + suffix;
      const responseData = `ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ:1`;
      jest.spyOn(axios, 'get').mockResolvedValue({ data: responseData });
      (crypto.createHash as jest.Mock).mockReturnValue({
        update: () => ({ digest: () => fullHash }),
      });

      const result = await service.checkIfPasswordIsPawned(password);
      expect(axios.get).toHaveBeenCalledWith(`${mockUrl}/range/${hash}`);
      expect(result).toBeUndefined();
    });

    it('should throw InternalServerErrorException if axios throws', async () => {
      const password = 'errorcase';
      const hash = 'ERROR';
      const fullHash = hash + '1234567890ABCDEF1234567890ABCDEF';
      jest.spyOn(axios, 'get').mockRejectedValue(new Error('Network error'));
      (crypto.createHash as jest.Mock).mockReturnValue({
        update: () => ({ digest: () => fullHash }),
      });

      await expect(service.checkIfPasswordIsPawned(password)).rejects.toThrow(InternalServerErrorException);
    });
  });
});
