import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NextFunction, Request, Response } from 'express';
import * as requestIp from 'request-ip';
import { IpMiddleware } from './ipMiddleware';

// Mock the request-ip module
jest.mock('request-ip');
const mockedRequestIp = requestIp as jest.Mocked<typeof requestIp>;

describe('IpMiddleware', () => {
  let middleware: IpMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IpMiddleware],
    }).compile();

    middleware = module.get<IpMiddleware>(IpMiddleware);

    mockRequest = {
      headers: {},
      method: 'POST',
      originalUrl: '/auth/login',
    };
    mockResponse = {};
    nextFunction = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  describe('use', () => {
    beforeEach(() => {
      mockedRequestIp.getClientIp.mockReturnValue('192.168.1.1');
    });

    it('should extract client IP and call next() when both required headers are present', () => {
      // Arrange
      mockRequest.headers = {
        'x-fingerprint': 'device-fingerprint-123',
        'x-forwarded-for': '192.168.1.1',
      };

      // Act
      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      // Assert
      expect(mockedRequestIp.getClientIp).toHaveBeenCalledWith(mockRequest);
      expect(mockRequest.clientIp).toBe('192.168.1.1');
      expect(nextFunction).toHaveBeenCalledTimes(1);
      expect(nextFunction).toHaveBeenCalledWith();
    });

    it('should throw BadRequestException when X-Fingerprint header is missing', () => {
      // Arrange
      mockRequest.headers = {
        'x-forwarded-for': '192.168.1.1',
      };

      // Act & Assert
      expect(() => {
        middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);
      }).toThrow(BadRequestException);

      expect(mockedRequestIp.getClientIp).toHaveBeenCalledWith(mockRequest);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should call next() when X-Forwarded-For header is missing but X-Fingerprint is present', () => {
      // Arrange
      mockRequest.headers = {
        'x-fingerprint': 'device-fingerprint-123',
      };

      // Act
      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      // Assert
      expect(mockedRequestIp.getClientIp).toHaveBeenCalledWith(mockRequest);
      expect(nextFunction).toHaveBeenCalledTimes(1);
      expect(nextFunction).toHaveBeenCalledWith();
    });

    it('should throw BadRequestException when both headers are missing', () => {
      // Arrange
      mockRequest.headers = {};

      // Act & Assert
      expect(() => {
        middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);
      }).toThrow(BadRequestException);

      expect(mockedRequestIp.getClientIp).toHaveBeenCalledWith(mockRequest);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException with correct message for missing X-Fingerprint', () => {
      // Arrange
      mockRequest.headers = {
        'x-forwarded-for': '192.168.1.1',
      };

      // Act & Assert
      try {
        middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.getResponse()).toEqual({
          message: 'X-Fingerprint header is required',
          error: 'Missing Required Header',
          statusCode: 400,
          timestamp: expect.any(String),
          path: '/auth/login',
        });
      }
    });

    it('should handle empty string headers as missing', () => {
      // Arrange
      mockRequest.headers = {
        'x-fingerprint': '',
        'x-forwarded-for': '192.168.1.1',
      };

      // Act & Assert
      expect(() => {
        middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);
      }).toThrow(BadRequestException);

      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should accept non-empty string values for headers', () => {
      // Arrange
      mockRequest.headers = {
        'x-fingerprint': 'valid-fingerprint',
        'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178',
      };

      // Act
      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      // Assert
      expect(mockedRequestIp.getClientIp).toHaveBeenCalledWith(mockRequest);
      expect(mockRequest.clientIp).toBe('192.168.1.1');
      expect(nextFunction).toHaveBeenCalledTimes(1);
    });

    it('should still extract IP even when validation fails', () => {
      // Arrange
      mockRequest.headers = {};

      // Act & Assert
      expect(() => {
        middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);
      }).toThrow(BadRequestException);

      // IP should still be extracted before validation
      expect(mockedRequestIp.getClientIp).toHaveBeenCalledWith(mockRequest);
      expect(mockRequest.clientIp).toBe('192.168.1.1');
    });
  });
});
