import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import { DateTime } from 'luxon';
import { EnvironmentService } from '../../../config';
import { VerificationType } from '../../../database/models/verificationToken/verificationToken.interface';
import { VerificationTokenRepository } from './verificationToken.repository';
import { VerificationTokenService } from './verificationToken.service';

jest.mock('jsonwebtoken');
jest.mock('../../../config');

describe('VerificationTokenService', () => {
  let service: VerificationTokenService;

  const mockVerificationTokenRepository = {
    create: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    query: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    (EnvironmentService.getValue as jest.Mock).mockReturnValue('test-secret');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationTokenService,
        { provide: VerificationTokenRepository, useValue: mockVerificationTokenRepository },
      ],
    }).compile();

    service = module.get<VerificationTokenService>(VerificationTokenService);
  });

  describe('generateToken', () => {
    it('should generate a verification token successfully', async () => {
      const userId = 'user-123';
      const verificationType = VerificationType.CHANGE_PIN;
      const expiresInMinutes = 30;

      const mockTokenRecord = {
        id: 'token-id-123',
        user_id: userId,
        token_identifier: 'token-identifier-abc',
        verification_type: verificationType,
        expires_at: DateTime.now().plus({ minutes: expiresInMinutes }).toJSDate(),
        is_used: false,
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        patch: jest.fn().mockReturnThis(),
      };

      mockVerificationTokenRepository.query.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.where.mockImplementation(() => {
        return {
          ...mockQueryBuilder,
          length: 0,
          then: (resolve) => resolve([]),
        };
      });

      mockVerificationTokenRepository.create.mockResolvedValue(mockTokenRecord);
      (jwt.sign as jest.Mock).mockReturnValue('jwt-token-123');

      const result = await service.generateToken(userId, verificationType, expiresInMinutes);

      expect(mockVerificationTokenRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          verification_type: verificationType,
          is_used: false,
          token_identifier: expect.any(String),
          expires_at: expect.any(String),
        }),
        undefined,
      );

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          verification_type: verificationType,
          token_identifier: expect.any(String),
        }),
        'test-secret',
        { expiresIn: `${expiresInMinutes}m` },
      );

      expect(result).toHaveProperty('token', 'jwt-token-123');
      expect(result).toHaveProperty('tokenRecord', mockTokenRecord);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token successfully', async () => {
      const token = 'valid-jwt-token';
      const tokenIdentifier = 'token-identifier-abc';
      const userId = 'user-123';

      const mockDecodedToken = {
        token_identifier: tokenIdentifier,
        user_id: userId,
        verification_type: VerificationType.CHANGE_PIN,
      };

      const mockTokenRecord = {
        id: 'token-id-123',
        user_id: userId,
        token_identifier: tokenIdentifier,
        verification_type: VerificationType.CHANGE_PIN,
        expires_at: DateTime.now().plus({ minutes: 30 }).toJSDate(),
        is_used: false,
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockDecodedToken);
      mockVerificationTokenRepository.findOne.mockResolvedValue(mockTokenRecord);

      const result = await service.verifyToken(token);

      expect(jwt.verify).toHaveBeenCalledWith(token, 'test-secret');
      expect(mockVerificationTokenRepository.findOne).toHaveBeenCalledWith({
        token_identifier: tokenIdentifier,
      });
      expect(result).toEqual(mockTokenRecord);
    });

    it('should throw NotFoundException if JWT verification fails', async () => {
      const token = 'invalid-jwt-token';

      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.verifyToken(token)).rejects.toThrow(NotFoundException);
      await expect(service.verifyToken(token)).rejects.toThrow('Invalid or expired token');
    });

    it('should throw NotFoundException if token not found in database', async () => {
      const token = 'valid-jwt-token';
      const tokenIdentifier = 'token-identifier-abc';

      const mockDecodedToken = {
        token_identifier: tokenIdentifier,
        user_id: 'user-123',
        verification_type: VerificationType.CHANGE_PIN,
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockDecodedToken);
      mockVerificationTokenRepository.findOne.mockResolvedValue(null);

      await expect(service.verifyToken(token)).rejects.toThrow(NotFoundException);
      await expect(service.verifyToken(token)).rejects.toThrow('Token not found');
    });

    it('should throw NotFoundException if token is already used', async () => {
      const token = 'valid-jwt-token';
      const tokenIdentifier = 'token-identifier-abc';

      const mockDecodedToken = {
        token_identifier: tokenIdentifier,
        user_id: 'user-123',
        verification_type: VerificationType.CHANGE_PIN,
      };

      const mockTokenRecord = {
        id: 'token-id-123',
        user_id: 'user-123',
        token_identifier: tokenIdentifier,
        verification_type: VerificationType.CHANGE_PIN,
        expires_at: DateTime.now().plus({ minutes: 30 }).toJSDate(),
        is_used: true,
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockDecodedToken);
      mockVerificationTokenRepository.findOne.mockResolvedValue(mockTokenRecord);

      await expect(service.verifyToken(token)).rejects.toThrow(NotFoundException);
      await expect(service.verifyToken(token)).rejects.toThrow('Token has already been used');
    });

    it('should throw NotFoundException if token has expired', async () => {
      const token = 'valid-jwt-token';
      const tokenIdentifier = 'token-identifier-abc';

      const mockDecodedToken = {
        token_identifier: tokenIdentifier,
        user_id: 'user-123',
        verification_type: VerificationType.CHANGE_PIN,
      };

      const mockTokenRecord = {
        id: 'token-id-123',
        user_id: 'user-123',
        token_identifier: tokenIdentifier,
        verification_type: VerificationType.CHANGE_PIN,
        expires_at: DateTime.now().minus({ minutes: 1 }).toJSDate(),
        is_used: false,
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockDecodedToken);
      mockVerificationTokenRepository.findOne.mockResolvedValue(mockTokenRecord);

      await expect(service.verifyToken(token)).rejects.toThrow(NotFoundException);
      await expect(service.verifyToken(token)).rejects.toThrow('Token has expired');
    });
  });

  describe('markTokenAsUsed', () => {
    it('should mark token as used successfully', async () => {
      const tokenIdentifier = 'token-identifier-abc';

      const mockTokenRecord = {
        id: 'token-id-123',
        user_id: 'user-123',
        token_identifier: tokenIdentifier,
        verification_type: VerificationType.CHANGE_PIN,
        expires_at: DateTime.now().plus({ minutes: 30 }).toJSDate(),
        is_used: false,
      };

      mockVerificationTokenRepository.findOne.mockResolvedValue(mockTokenRecord);
      mockVerificationTokenRepository.update.mockResolvedValue({ ...mockTokenRecord, is_used: true });

      await service.markTokenAsUsed(tokenIdentifier);

      expect(mockVerificationTokenRepository.findOne).toHaveBeenCalledWith({
        token_identifier: tokenIdentifier,
      });
      expect(mockVerificationTokenRepository.update).toHaveBeenCalledWith(
        mockTokenRecord.id,
        expect.objectContaining({
          is_used: true,
          used_at: expect.any(String),
        }),
        { trx: undefined },
      );
    });

    it('should throw NotFoundException if token not found', async () => {
      const tokenIdentifier = 'non-existent-identifier';

      mockVerificationTokenRepository.findOne.mockResolvedValue(null);

      await expect(service.markTokenAsUsed(tokenIdentifier)).rejects.toThrow(NotFoundException);
      await expect(service.markTokenAsUsed(tokenIdentifier)).rejects.toThrow('Token not found');
    });
  });

  describe('invalidateUserTokens', () => {
    it('should invalidate all unused tokens for a user and verification type', async () => {
      const userId = 'user-123';
      const verificationType = VerificationType.CHANGE_PIN;

      const mockTokens = [
        {
          id: 'token-1',
          user_id: userId,
          verification_type: verificationType,
          is_used: false,
        },
        {
          id: 'token-2',
          user_id: userId,
          verification_type: verificationType,
          is_used: false,
        },
      ];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        patch: jest.fn().mockReturnThis(),
      };

      // First call to query().where().where() returns mockTokens
      mockVerificationTokenRepository.query.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.where.mockImplementation(() => {
        return {
          ...mockQueryBuilder,
          length: mockTokens.length,
          then: (resolve) => resolve(mockTokens),
        };
      });

      await service.invalidateUserTokens(userId, verificationType);

      expect(mockVerificationTokenRepository.query).toHaveBeenCalled();
    });
  });

  describe('getValidToken', () => {
    it('should get a valid token successfully', async () => {
      const tokenIdentifier = 'token-identifier-abc';

      const mockTokenRecord = {
        id: 'token-id-123',
        user_id: 'user-123',
        token_identifier: tokenIdentifier,
        verification_type: VerificationType.CHANGE_PIN,
        expires_at: DateTime.now().plus({ minutes: 30 }).toJSDate(),
        is_used: false,
      };

      mockVerificationTokenRepository.findOne.mockResolvedValue(mockTokenRecord);

      const result = await service.getValidToken(tokenIdentifier);

      expect(mockVerificationTokenRepository.findOne).toHaveBeenCalledWith({
        token_identifier: tokenIdentifier,
      });
      expect(result).toEqual(mockTokenRecord);
    });

    it('should throw NotFoundException if token not found', async () => {
      const tokenIdentifier = 'non-existent-identifier';

      mockVerificationTokenRepository.findOne.mockResolvedValue(null);

      await expect(service.getValidToken(tokenIdentifier)).rejects.toThrow(NotFoundException);
      await expect(service.getValidToken(tokenIdentifier)).rejects.toThrow('Token not found');
    });

    it('should throw NotFoundException if token is already used', async () => {
      const tokenIdentifier = 'token-identifier-abc';

      const mockTokenRecord = {
        id: 'token-id-123',
        user_id: 'user-123',
        token_identifier: tokenIdentifier,
        verification_type: VerificationType.CHANGE_PIN,
        expires_at: DateTime.now().plus({ minutes: 30 }).toJSDate(),
        is_used: true,
      };

      mockVerificationTokenRepository.findOne.mockResolvedValue(mockTokenRecord);

      await expect(service.getValidToken(tokenIdentifier)).rejects.toThrow(NotFoundException);
      await expect(service.getValidToken(tokenIdentifier)).rejects.toThrow('Token has already been used');
    });

    it('should throw NotFoundException if token has expired', async () => {
      const tokenIdentifier = 'token-identifier-abc';

      const mockTokenRecord = {
        id: 'token-id-123',
        user_id: 'user-123',
        token_identifier: tokenIdentifier,
        verification_type: VerificationType.CHANGE_PIN,
        expires_at: DateTime.now().minus({ minutes: 1 }).toJSDate(),
        is_used: false,
      };

      mockVerificationTokenRepository.findOne.mockResolvedValue(mockTokenRecord);

      await expect(service.getValidToken(tokenIdentifier)).rejects.toThrow(NotFoundException);
      await expect(service.getValidToken(tokenIdentifier)).rejects.toThrow('Token has expired');
    });
  });
});
