import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as crypto from 'crypto';
import forge from 'node-forge';
import { RainConfig, RainConfigProvider } from '../../../config/rain.config';

@Injectable()
export class RainHelper {
  /** Padding character used to fill PIN block format to required length (ISO format requires F padding) */
  private readonly PIN_PADDING = 'F';
  /** Byte count for AES encryption operations (16 bytes for AES-128) and IV generation */
  private readonly ENCRYPTION_BYTE_COUNT = 16;

  private readonly rainConfig: RainConfig;

  constructor() {
    this.rainConfig = new RainConfigProvider().getConfig();
  }

  /**
   * Generates a session ID for Rain API authentication
   *
   * Creates a secure session by generating a secret key (either from config or random UUID),
   * converting it to base64, and encrypting it using RSA public key encryption with OAEP padding.
   *
   * @returns Object containing:
   *   - secretKey: Hex string used for subsequent encryption operations
   *   - sessionId: Base64 encoded encrypted secret for API authentication
   *
   * @throws When PEM key is missing or secret is not a valid hex string
   */
  public async generateSessionId() {
    const pem = this.rainConfig.pem;
    const secret = this.rainConfig.secret;

    if (!pem) throw new InternalServerErrorException('Pem is required');
    if (secret && !/^[0-9A-Fa-f]+$/.test(secret)) {
      throw new InternalServerErrorException('Secret must be a hex string');
    }

    const secretKey = secret ?? crypto.randomUUID().replaceAll('-', '');
    const secretKeyBase64 = Buffer.from(secretKey, 'hex').toString('base64');
    const secretKeyBase64Buffer = Buffer.from(secretKeyBase64, 'utf-8');
    const secretKeyBase64BufferEncrypted = crypto.publicEncrypt(
      {
        key: pem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      },
      secretKeyBase64Buffer,
    );

    return {
      secretKey,
      sessionId: secretKeyBase64BufferEncrypted.toString('base64'),
    };
  }

  /**
   * Decrypts a base64 encoded secret using AES-128-GCM decryption
   *
   * Takes an encrypted secret and initialization vector, both base64 encoded,
   * and decrypts the secret using the configured secret key with AES-128-GCM cipher.
   *
   * @param base64Secret Base64 encoded encrypted secret data
   * @param base64Iv Base64 encoded initialization vector used for encryption
   *
   * @returns Decrypted secret as a UTF-8 string (trimmed)
   *
   * @throws When:
   *   - base64Secret is missing or empty
   *   - base64Iv is missing or empty
   *   - Secret key is missing or not a valid hex string
   */
  public async decryptSecret(base64Secret: string, base64Iv: string) {
    if (!base64Secret) throw new InternalServerErrorException('Base64 secret is required');
    if (!base64Iv) throw new InternalServerErrorException('Base64 IV is required');

    const secretKey = this.rainConfig.secret;

    if (!secretKey || !/^[0-9A-Fa-f]+$/.test(secretKey)) {
      throw new InternalServerErrorException('Secret key must be a hex string');
    }

    const secret = Buffer.from(base64Secret, 'base64');
    const iv = Buffer.from(base64Iv, 'base64');
    const secretKeyBuffer = Buffer.from(secretKey, 'hex');

    // AES-GCM requires the authentication tag to be provided to the decipher.
    // The provider returns ciphertext with the auth tag appended (ciphertext || tag) encoded in base64.
    // Extract the last 16 bytes as the tag (128-bit tag) and use the rest as ciphertext.
    const AUTH_TAG_LENGTH = 16;
    if (secret.length < AUTH_TAG_LENGTH) {
      throw new InternalServerErrorException('Encrypted secret is too short to contain auth tag');
    }

    const authTag = secret.subarray(secret.length - AUTH_TAG_LENGTH);
    const ciphertext = secret.subarray(0, secret.length - AUTH_TAG_LENGTH);

    try {
      const decipher = crypto.createDecipheriv('aes-128-gcm', secretKeyBuffer, iv);
      decipher.setAuthTag(authTag);

      const decryptedBuffers: Buffer[] = [];
      const updated = decipher.update(ciphertext);
      if (updated && updated.length) decryptedBuffers.push(updated);
      const finalBuf = decipher.final();
      if (finalBuf && finalBuf.length) decryptedBuffers.push(finalBuf);

      const decrypted = Buffer.concat(decryptedBuffers);
      return decrypted.toString('utf-8').trim();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      throw new InternalServerErrorException('Failed to decrypt secret');
    }
  }

  /**
   * Encrypts a card PIN using ISO format PIN block and AES-GCM encryption
   *
   * Formats the PIN according to ISO standards (2 + PIN length + PIN + F padding),
   * then encrypts it using AES-GCM with a generated session key and random IV.
   * The PIN block format follows: 2[length][pin][padding] (e.g., 246784FFFFFFFFFF)
   *
   * @param pin The card PIN to encrypt (numeric string)
   *
   * @returns Object containing:
   *   - encryptedPin: Base64 encoded encrypted PIN block with authentication tag
   *   - encodedIv: Base64 encoded initialization vector used for encryption
   *
   * @throws When session ID generation fails or encryption errors occur
   *
   * @example
   * // PIN "6784" becomes PIN block "246784FFFFFFFFFF" before encryption
   * const result = await encryptCardPin("6784");
   * // Returns: { encryptedPin: "base64String...", encodedIv: "base64IV..." }
   */
  public async encryptCardPin(pin: string) {
    const { secretKey: sessionKey, sessionId } = await this.generateSessionId();

    const padding = this.PIN_PADDING.repeat(14 - pin.length);
    const formattedPin = `2${pin.length.toString(this.ENCRYPTION_BYTE_COUNT)}${pin}${padding}`;
    // PIN block format: 246784FFFFFFFFFF. 2 = ISO format, 4 = PIN length, 6784 = PIN, FFFFFFFFFF = Padding

    const iv = forge.random.getBytesSync(this.ENCRYPTION_BYTE_COUNT);
    const encodedIv = forge.util.encode64(iv); // Encoded IV to send to API
    const keyBytes = forge.util.hexToBytes(sessionKey);

    const cipher = forge.cipher.createCipher('AES-GCM', keyBytes);
    cipher.start({ iv: iv });
    cipher.update(forge.util.createBuffer(formattedPin));
    cipher.finish();

    const tag = cipher.mode.tag.data;
    const encryptedPin = forge.util.encode64(cipher.output.data + tag);

    return {
      encryptedPin,
      encodedIv,
      sessionId,
    };
  }
}
