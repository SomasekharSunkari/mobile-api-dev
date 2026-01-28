jest.mock('./config/environment', () => ({
  EnvironmentService: {
    getValue: jest.fn(),
    getValues: jest.fn(() => ({
      db_host: 'localhost',
      db_password: 'test',
      db_user: 'test',
      db_name: 'test',
      db_port: 5432,
      db_ssl: false,
    })),
  },
}));

jest.mock('./database/database.connection', () => ({
  KnexDB: {
    connection: jest.fn(() => ({
      raw: jest.fn(),
      destroy: jest.fn(),
    })),
  },
}));

jest.mock('jsonwebtoken');
jest.mock('./database/models/userRole');

import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { DecodeAndDecompressAuthHeader } from './app.middleware';
import { EnvironmentService } from './config/environment';
import { UserRoleModel } from './database/models/userRole';
import { ROLES } from './modules/auth/guard';

describe('DecodeAndDecompressAuthHeader', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequest = {
      url: 'https://example.com/test',
      headers: {
        host: 'example.com',
        authorization: 'Bearer valid-token',
      },
      body: {},
    } as Partial<Request>;

    mockResponse = {
      locals: {},
    } as Partial<Response>;

    mockNext = jest.fn();
  });

  describe('handle', () => {
    it('should skip authentication for exempted paths - login', async () => {
      mockRequest.url = '/auth/login';

      await DecodeAndDecompressAuthHeader.handle(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockResponse.locals.userId).toBeUndefined();
    });

    it('should skip authentication for exempted paths - signup', async () => {
      mockRequest.url = '/auth/signup';

      await DecodeAndDecompressAuthHeader.handle(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockResponse.locals.userId).toBeUndefined();
    });

    it('should skip authentication for exempted paths - docs', async () => {
      mockRequest.url = '/docs';

      await DecodeAndDecompressAuthHeader.handle(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockResponse.locals.userId).toBeUndefined();
    });

    it('should skip authentication for webhook paths', async () => {
      mockRequest.url = '/webhooks/plaid';

      await DecodeAndDecompressAuthHeader.handle(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockResponse.locals.userId).toBeUndefined();
    });

    it('should skip authentication for paths containing webhooks', async () => {
      mockRequest.url = '/webhooks/test-endpoint';

      await DecodeAndDecompressAuthHeader.handle(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockResponse.locals.userId).toBeUndefined();
    });

    it('should authenticate successfully with valid token', async () => {
      const mockTokenPayload = {
        id: 'user-123',
        identity: 'token-identity',
        email: 'test@example.com',
        phone: '+1234567890',
      };

      const mockUserRoles = [
        {
          user_id: 'user-123',
          role: {
            slug: ROLES.ACTIVE_USER,
            permissions: [{ name: 'read' }, { name: 'write' }],
          },
        },
      ];

      (jwt.verify as jest.Mock).mockReturnValue(mockTokenPayload);
      (EnvironmentService.getValue as jest.Mock).mockReturnValue('secret');
      (UserRoleModel.query as jest.Mock).mockReturnValue({
        where: jest.fn().mockReturnThis(),
        withGraphFetched: jest.fn().mockResolvedValue(mockUserRoles),
      });

      await DecodeAndDecompressAuthHeader.handle(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.locals.userId).toBe('user-123');
      expect(mockResponse.locals.userEmail).toBe('test@example.com');
      expect(mockResponse.locals.phone).toBe('+1234567890');
      expect(mockResponse.locals.roles).toContain(ROLES.ACTIVE_USER);
      expect(mockResponse.locals.permissions).toContain('read');
      expect(mockResponse.locals.permissions).toContain('write');
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should throw UnauthorizedException if authorization header is missing', async () => {
      mockRequest.headers.authorization = undefined;

      await DecodeAndDecompressAuthHeader.handle(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
    });

    it('should throw UnauthorizedException if Bearer keyword is missing', async () => {
      mockRequest.headers.authorization = 'Token valid-token';
      (EnvironmentService.getValue as jest.Mock).mockReturnValue('secret');

      await DecodeAndDecompressAuthHeader.handle(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
    });

    it('should throw UnauthorizedException if token verification fails', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });
      (EnvironmentService.getValue as jest.Mock).mockReturnValue('secret');

      await DecodeAndDecompressAuthHeader.handle(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
    });

    it('should throw ForbiddenException if user is not active', async () => {
      const mockTokenPayload = {
        id: 'user-123',
        identity: 'token-identity',
        email: 'test@example.com',
      };

      const mockUserRoles = [
        {
          user_id: 'user-123',
          role: {
            slug: 'some-other-role',
            permissions: [{ name: 'read' }],
          },
        },
      ];

      (jwt.verify as jest.Mock).mockReturnValue(mockTokenPayload);
      (EnvironmentService.getValue as jest.Mock).mockReturnValue('secret');
      (UserRoleModel.query as jest.Mock).mockReturnValue({
        where: jest.fn().mockReturnThis(),
        withGraphFetched: jest.fn().mockResolvedValue(mockUserRoles),
      });

      await DecodeAndDecompressAuthHeader.handle(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenException));
    });
  });

  describe('isRouteExempted', () => {
    it('should return true for exempted route', () => {
      const exemptedPaths = [/^\/auth\/login$/, /^\/docs/];
      mockRequest.url = '/auth/login';
      mockRequest.headers.host = 'example.com';

      const result = DecodeAndDecompressAuthHeader.isRouteExempted(exemptedPaths, mockRequest as Request);

      expect(result).toBe(true);
    });

    it('should return false for non-exempted route', () => {
      const exemptedPaths = [/^\/auth\/login$/, /^\/docs/];
      mockRequest.url = '/api/users';
      mockRequest.headers.host = 'example.com';

      const result = DecodeAndDecompressAuthHeader.isRouteExempted(exemptedPaths, mockRequest as Request);

      expect(result).toBe(false);
    });

    it('should handle multiple exempted paths correctly', () => {
      const exemptedPaths = [/^\/auth\/login$/, /^\/auth\/signup$/, /^\/docs/];
      mockRequest.headers.host = 'example.com';

      mockRequest.url = '/auth/signup';
      expect(DecodeAndDecompressAuthHeader.isRouteExempted(exemptedPaths, mockRequest as Request)).toBe(true);

      mockRequest.url = '/docs/api';
      expect(DecodeAndDecompressAuthHeader.isRouteExempted(exemptedPaths, mockRequest as Request)).toBe(true);

      mockRequest.url = '/api/test';
      expect(DecodeAndDecompressAuthHeader.isRouteExempted(exemptedPaths, mockRequest as Request)).toBe(false);
    });
  });
});
