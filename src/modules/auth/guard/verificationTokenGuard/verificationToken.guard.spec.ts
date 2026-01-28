import { BadRequestException, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { VerificationTokenGuard } from './verificationToken.guard';

describe('VerificationTokenGuard', () => {
  let guard: VerificationTokenGuard;

  const mockReflector = {
    get: jest.fn().mockReturnValue([]),
  };

  const mockVerificationTokenService = {
    verifyToken: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockReflector.get.mockReturnValue([]);
    guard = new VerificationTokenGuard(mockReflector as any, mockVerificationTokenService as any);
  });

  const createMockExecutionContext = (user?: any, body?: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          body: body || {},
        }),
      }),
      getHandler: jest.fn(),
    } as unknown as ExecutionContext;
  };

  describe('canActivate', () => {
    it('should throw UnauthorizedException if user is not authenticated', async () => {
      const context = createMockExecutionContext(null, {});

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow('You are not authorized to access this resource');
    });

    it('should throw UnauthorizedException if user.id is missing', async () => {
      const context = createMockExecutionContext({}, {});

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow('You are not authorized to access this resource');
    });

    it('should throw BadRequestException if verification_token is missing', async () => {
      const context = createMockExecutionContext({ id: 'user-123' }, {});

      await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
      await expect(guard.canActivate(context)).rejects.toThrow('Verification token is required');
    });

    it('should throw BadRequestException if token user_id does not match authenticated user', async () => {
      const context = createMockExecutionContext({ id: 'user-123' }, { verification_token: 'valid-token' });

      const mockTokenRecord = {
        id: 'token-id',
        user_id: 'different-user-id',
        token_identifier: 'identifier-123',
        verification_type: 'change_pin',
        is_used: false,
        expires_at: new Date(),
      };

      mockVerificationTokenService.verifyToken.mockResolvedValue(mockTokenRecord);

      await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
      await expect(guard.canActivate(context)).rejects.toThrow('Invalid verification token');
    });

    it('should return true if verification is successful', async () => {
      const userId = 'user-123';
      const verificationToken = 'valid-token';
      const mockRequest: any = {
        user: { id: userId },
        body: { verification_token: verificationToken },
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
        getHandler: jest.fn(),
      } as unknown as ExecutionContext;

      const mockTokenRecord = {
        id: 'token-id',
        user_id: userId,
        token_identifier: 'identifier-123',
        verification_type: 'change_pin',
        is_used: false,
        expires_at: new Date(),
      };

      mockVerificationTokenService.verifyToken.mockResolvedValue(mockTokenRecord);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockVerificationTokenService.verifyToken).toHaveBeenCalledWith(verificationToken);
    });

    it('should propagate NotFoundException from verificationTokenService', async () => {
      const context = createMockExecutionContext({ id: 'user-123' }, { verification_token: 'invalid-token' });

      mockVerificationTokenService.verifyToken.mockRejectedValue(new BadRequestException('Token not found'));

      await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
      await expect(guard.canActivate(context)).rejects.toThrow('Token not found');
    });
  });
});
