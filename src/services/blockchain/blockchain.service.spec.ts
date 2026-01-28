import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as crypto from 'node:crypto';
import { BlockchainService } from './blockchain.service';

describe('BlockchainService', () => {
  let service: BlockchainService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockEncryptionKey = '0123456789abcdef0123456789abcdef';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(mockEncryptionKey),
          },
        },
      ],
    }).compile();

    service = module.get<BlockchainService>(BlockchainService);
    configService = module.get(ConfigService);

    jest.spyOn(crypto, 'createPublicKey').mockImplementation((key: any) => key as any);

    jest.spyOn(crypto, 'publicEncrypt').mockImplementation((...args: any[]): any => {
      const buffer: Buffer = args[1] as Buffer;
      const random = crypto.randomBytes(8).toString('hex');
      return Buffer.from(`encrypted-${random}-${buffer.toString('utf8')}`, 'utf8');
    });

    jest.spyOn(crypto, 'privateDecrypt').mockImplementation((...args: any[]): any => {
      const buffer: Buffer = args[1] as Buffer;
      const value = buffer.toString('utf8');

      if (!value.startsWith('encrypted-')) {
        throw new Error('Decryption failed');
      }

      const parts = value.split('-');
      const original = parts.slice(2).join('-');

      return Buffer.from(original, 'utf8');
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('validateAddress', () => {
    it('should validate Ethereum address', () => {
      const validAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';
      expect(service.validateAddress(validAddress, 'ethereum')).toBe(true);
      expect(service.validateAddress(validAddress, 'eth')).toBe(true);
    });

    it('should validate Solana address', () => {
      const validAddress = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
      expect(service.validateAddress(validAddress, 'solana')).toBe(true);
      expect(service.validateAddress(validAddress, 'sol')).toBe(true);
    });

    it('should validate Bitcoin address', () => {
      const validAddress = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
      expect(service.validateAddress(validAddress, 'bitcoin')).toBe(true);
      expect(service.validateAddress(validAddress, 'btc')).toBe(true);
    });

    it('should return false for invalid address', () => {
      expect(service.validateAddress('invalid')).toBe(false);
      expect(service.validateAddress('')).toBe(false);
      expect(service.validateAddress('0x123')).toBe(false);
    });

    it('should return false for non-string input', () => {
      expect(service.validateAddress(null as any)).toBe(false);
      expect(service.validateAddress(undefined as any)).toBe(false);
      expect(service.validateAddress(123 as any)).toBe(false);
    });

    it('should validate address without network parameter', () => {
      const validEthAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';
      const validSolAddress = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
      expect(service.validateAddress(validEthAddress)).toBe(true);
      expect(service.validateAddress(validSolAddress)).toBe(true);
    });
  });

  describe('validateTransactionHash', () => {
    it('should validate Ethereum transaction hash', () => {
      const validHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      expect(service.validateTransactionHash(validHash)).toBe(true);
    });

    it('should validate Bitcoin transaction hash', () => {
      const validHash = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      expect(service.validateTransactionHash(validHash)).toBe(true);
    });

    it('should return false for invalid transaction hash', () => {
      expect(service.validateTransactionHash('invalid')).toBe(false);
      expect(service.validateTransactionHash('0x123')).toBe(false);
      expect(service.validateTransactionHash('')).toBe(false);
    });

    it('should return false for non-string input', () => {
      expect(service.validateTransactionHash(null as any)).toBe(false);
      expect(service.validateTransactionHash(undefined as any)).toBe(false);
    });
  });

  describe('formatAddress', () => {
    it('should format address correctly', () => {
      const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';
      const formatted = service.formatAddress(address);
      expect(formatted).toBe('0x742d...beb0');
    });

    it('should return full address if too short', () => {
      const shortAddress = '0x1234';
      expect(service.formatAddress(shortAddress)).toBe('0x1234');
    });

    it('should return empty string for invalid input', () => {
      expect(service.formatAddress('')).toBe('');
      expect(service.formatAddress(null as any)).toBe('');
      expect(service.formatAddress(undefined as any)).toBe('');
    });
  });

  describe('normalizeAddress', () => {
    it('should normalize address to lowercase', () => {
      const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';
      const normalized = service.normalizeAddress(address);
      expect(normalized).toBe('0x742d35cc6634c0532925a3b844bc9e7595f0beb0');
    });

    it('should trim whitespace', () => {
      const address = '  0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0  ';
      const normalized = service.normalizeAddress(address);
      expect(normalized).toBe('0x742d35cc6634c0532925a3b844bc9e7595f0beb0');
    });

    it('should return empty string for invalid input', () => {
      expect(service.normalizeAddress('')).toBe('');
      expect(service.normalizeAddress(null as any)).toBe('');
      expect(service.normalizeAddress(undefined as any)).toBe('');
    });
  });

  describe('createEthereumAddress', () => {
    it('should create Ethereum address with encrypted private key', () => {
      const result = service.createEthereumAddress();

      expect(result).toHaveProperty('address');
      expect(result).toHaveProperty('privateKey');
      expect(result).toHaveProperty('encryptedPrivateKey');
      expect(result).toHaveProperty('encryptionIv');
      expect(result).toHaveProperty('publicKey');

      expect(result.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(result.privateKey).toBeDefined();
      expect(result.encryptedPrivateKey).toBeDefined();
      expect(result.encryptionIv).toBeDefined();
      expect(result.publicKey).toBeDefined();
    });

    it('should create unique addresses on each call', () => {
      const result1 = service.createEthereumAddress();
      const result2 = service.createEthereumAddress();

      expect(result1.address).not.toBe(result2.address);
      expect(result1.privateKey).not.toBe(result2.privateKey);
    });

    it('should encrypt private key correctly', () => {
      const result = service.createEthereumAddress();
      const decrypted = service.decryptPrivateKey(result.encryptedPrivateKey, result.encryptionIv);

      expect(decrypted).toBe(result.privateKey);
    });
  });

  describe('createSolanaAddress', () => {
    it('should create Solana address with encrypted private key', () => {
      const result = service.createSolanaAddress();

      expect(result).toHaveProperty('address');
      expect(result).toHaveProperty('privateKey');
      expect(result).toHaveProperty('encryptedPrivateKey');
      expect(result).toHaveProperty('encryptionIv');
      expect(result).toHaveProperty('publicKey');

      expect(result.address).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
      expect(result.privateKey).toBeDefined();
      expect(result.encryptedPrivateKey).toBeDefined();
      expect(result.encryptionIv).toBeDefined();
      expect(result.publicKey).toBeDefined();
    });

    it('should create unique addresses on each call', () => {
      const result1 = service.createSolanaAddress();
      const result2 = service.createSolanaAddress();

      expect(result1.address).not.toBe(result2.address);
      expect(result1.privateKey).not.toBe(result2.privateKey);
    });

    it('should encrypt private key correctly', () => {
      const result = service.createSolanaAddress();
      const decrypted = service.decryptPrivateKey(result.encryptedPrivateKey, result.encryptionIv);

      expect(decrypted).toBe(result.privateKey);
    });
  });

  describe('encryptPrivateKey', () => {
    it('should encrypt private key successfully', () => {
      const privateKey = 'test-private-key';
      const result = service.encryptPrivateKey(privateKey);

      expect(result).toHaveProperty('encryptedData');
      expect(result).toHaveProperty('iv');
      expect(result.encryptedData).toBeDefined();
      expect(result.iv).toBeDefined();
    });

    it('should throw error when encryption key is not configured', () => {
      configService.get.mockReturnValue(undefined);

      expect(() => service.encryptPrivateKey('test-key')).toThrow(InternalServerErrorException);
    });

    it('should produce different encrypted data for same input', () => {
      const privateKey = 'test-private-key';
      const result1 = service.encryptPrivateKey(privateKey);
      const result2 = service.encryptPrivateKey(privateKey);

      expect(result1.encryptedData).not.toBe(result2.encryptedData);
    });
  });

  describe('decryptPrivateKey', () => {
    it('should decrypt private key successfully', () => {
      const privateKey = 'test-private-key';
      const encrypted = service.encryptPrivateKey(privateKey);
      const decrypted = service.decryptPrivateKey(encrypted.encryptedData, encrypted.iv);

      expect(decrypted).toBe(privateKey);
    });

    it('should throw error when encryption key is not configured', () => {
      configService.get.mockReturnValue(undefined);

      expect(() => service.decryptPrivateKey('encrypted-data', 'iv')).toThrow(InternalServerErrorException);
    });

    it('should throw error when encrypted data is missing', () => {
      expect(() => service.decryptPrivateKey('', 'iv')).toThrow(InternalServerErrorException);
    });

    it('should throw error when IV is missing', () => {
      expect(() => service.decryptPrivateKey('encrypted-data', '')).toThrow(InternalServerErrorException);
    });

    it('should throw error when encrypted data is too short', () => {
      const encrypted = service.encryptPrivateKey('test-key');
      const shortData = encrypted.encryptedData.substring(0, 10);

      expect(() => service.decryptPrivateKey(shortData, encrypted.iv)).toThrow(InternalServerErrorException);
    });

    it('should throw error when decryption fails', () => {
      const encrypted = service.encryptPrivateKey('test-key');
      const invalidData = 'invalid-encrypted-data';

      expect(() => service.decryptPrivateKey(invalidData, encrypted.iv)).toThrow(InternalServerErrorException);
    });
  });
});
