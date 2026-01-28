export interface ICreateAddressResult {
  address: string;
  privateKey: string;
  encryptedPrivateKey?: string;
  encryptionIv?: string;
  publicKey?: string;
}

export interface IEncryptResult {
  encryptedData: string;
  iv: string;
}

export interface IBlockchainService {
  validateAddress(address: string, network?: string): boolean;
  validateTransactionHash(txHash: string): boolean;
  formatAddress(address: string): string;
  normalizeAddress(address: string): string;
  createEthereumAddress(): ICreateAddressResult;
  createSolanaAddress(): ICreateAddressResult;
  encryptPrivateKey(privateKey: string): IEncryptResult;
  decryptPrivateKey(encryptedData: string, iv: string): string;
}
