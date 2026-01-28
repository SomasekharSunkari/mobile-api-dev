import { Inject, Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Wallet } from 'ethers';
import { Keypair } from '@solana/web3.js';
import * as crypto from 'node:crypto';
import { constants } from 'node:crypto';
import { IBlockchainService, ICreateAddressResult, IEncryptResult } from './blockchain.interface';

@Injectable()
export class BlockchainService implements IBlockchainService {
  private readonly logger = new Logger(BlockchainService.name);

  @Inject(ConfigService)
  private readonly configService: ConfigService;

  private getEncryptionKey(): string {
    const key = this.configService.get<string>('BLOCKCHAIN_ENCRYPTION_KEY') || '';

    if (!key) {
      this.logger.warn('BLOCKCHAIN_ENCRYPTION_KEY is not set in environment variables');
    }

    return key;
  }

  validateAddress(address: string, network?: string): boolean {
    if (!address || typeof address !== 'string') {
      return false;
    }

    const trimmedAddress = address.trim();

    if (trimmedAddress.length < 26 || trimmedAddress.length > 95) {
      return false;
    }

    const ethereumPattern = /^0x[a-fA-F0-9]{40}$/;
    const bitcoinPattern = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/;
    const solanaPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

    if (network === 'ethereum' || network === 'eth') {
      return ethereumPattern.test(trimmedAddress);
    }

    if (network === 'bitcoin' || network === 'btc') {
      return bitcoinPattern.test(trimmedAddress);
    }

    if (network === 'solana' || network === 'sol') {
      return solanaPattern.test(trimmedAddress);
    }

    return (
      ethereumPattern.test(trimmedAddress) || bitcoinPattern.test(trimmedAddress) || solanaPattern.test(trimmedAddress)
    );
  }

  validateTransactionHash(txHash: string): boolean {
    if (!txHash || typeof txHash !== 'string') {
      return false;
    }

    const trimmedHash = txHash.trim();

    const ethereumTxPattern = /^0x[a-fA-F0-9]{64}$/;
    const bitcoinTxPattern = /^[a-fA-F0-9]{64}$/;

    return ethereumTxPattern.test(trimmedHash) || bitcoinTxPattern.test(trimmedHash);
  }

  formatAddress(address: string): string {
    if (!address || typeof address !== 'string') {
      return '';
    }

    const normalized = this.normalizeAddress(address);

    if (normalized.length <= 10) {
      return normalized;
    }

    return `${normalized.substring(0, 6)}...${normalized.substring(normalized.length - 4)}`;
  }

  normalizeAddress(address: string): string {
    if (!address || typeof address !== 'string') {
      return '';
    }

    return address.trim().toLowerCase();
  }

  createEthereumAddress(): ICreateAddressResult {
    try {
      const wallet = Wallet.createRandom();
      const encrypted = this.encryptPrivateKey(wallet.privateKey);

      return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        encryptedPrivateKey: encrypted.encryptedData,
        encryptionIv: encrypted.iv,
        publicKey: wallet.publicKey,
      };
    } catch (error) {
      this.logger.error('Failed to create Ethereum address', error.stack);
      throw error;
    }
  }

  createSolanaAddress(): ICreateAddressResult {
    try {
      const keypair = Keypair.generate();
      const privateKeyHex = Buffer.from(keypair.secretKey).toString('hex');
      const encrypted = this.encryptPrivateKey(privateKeyHex);

      return {
        address: keypair.publicKey.toBase58(),
        privateKey: privateKeyHex,
        encryptedPrivateKey: encrypted.encryptedData,
        encryptionIv: encrypted.iv,
        publicKey: keypair.publicKey.toBase58(),
      };
    } catch (error) {
      this.logger.error('Failed to create Solana address', error.stack);
      throw error;
    }
  }

  encryptPrivateKey(privateKey: string): IEncryptResult {
    const rsaPrivateKey = this.getEncryptionKey();

    if (!rsaPrivateKey) {
      throw new InternalServerErrorException('Blockchain encryption key is not configured');
    }

    try {
      const publicKey = crypto.createPublicKey(rsaPrivateKey);
      const encryptedBuffer = crypto.publicEncrypt(
        {
          key: publicKey,
          padding: constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        Buffer.from(privateKey, 'utf8'),
      );

      const encryptedData = encryptedBuffer.toString('base64');

      return {
        encryptedData,
        iv: '',
      };
    } catch (error) {
      this.logger.error('Failed to encrypt private key', error.stack);
      throw new InternalServerErrorException('Failed to encrypt private key');
    }
  }

  decryptPrivateKey(encryptedData: string, _iv: string): string {
    const rsaPrivateKey = this.getEncryptionKey();

    if (!rsaPrivateKey) {
      throw new InternalServerErrorException('Blockchain encryption key is not configured');
    }

    if (!encryptedData) {
      throw new InternalServerErrorException('Encrypted data is required');
    }

    try {
      if (_iv) {
        // IV is ignored for RSA decryption; preserved for interface compatibility
      }
      const decryptedBuffer = crypto.privateDecrypt(
        {
          key: rsaPrivateKey,
          padding: constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        Buffer.from(encryptedData, 'base64'),
      );

      return decryptedBuffer.toString('utf8');
    } catch (error) {
      this.logger.error('Failed to decrypt private key', error.stack);
      throw new InternalServerErrorException('Failed to decrypt private key');
    }
  }
}
