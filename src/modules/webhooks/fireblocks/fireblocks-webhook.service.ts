import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  FIREBLOCKS_V1_TO_V2_EVENT_TYPES,
  FIREBLOCKS_V2_TO_V1_EVENT_TYPES,
  FireblocksV1EventType,
  FireblocksV2EventType,
  IFireblocksWebhookV1Payload,
  IFireblocksWebhookV2Payload,
} from '../../../adapters/blockchain-waas/fireblocks/fireblocks_interface';
import { EnvironmentService } from '../../../config';
import { BlockchainWalletService } from '../../blockchainWallet/blockchainWallet.service';
import { TransactionRepository } from '../../transaction';

@Injectable()
export class FireblocksWebhookService {
  private readonly logger = new Logger(FireblocksWebhookService.name);

  @Inject(TransactionRepository)
  private readonly transactionRepository: TransactionRepository;
  constructor(private readonly blockchainWalletService: BlockchainWalletService) {}

  /**
   * Processes incoming Fireblocks webhook
   * @param body - The webhook payload
   * @param headers - The webhook headers
   * @returns The processing result
   */
  async processWebhook(
    body: IFireblocksWebhookV1Payload | IFireblocksWebhookV2Payload,
    headers: Record<string, string>,
  ): Promise<any> {
    this.logger.log('Processing Fireblocks webhook request');

    // Validate required headers
    this.validateHeaders(headers);

    // Determine webhook version based on payload structure
    const webhookVersion = this.detectWebhookVersion(body);
    const timestamp = headers['fireblocks-timestamp'] || '';

    this.logger.debug(`Processing ${webhookVersion} webhook`);

    // Log webhook details for debugging
    this.logWebhookDetails(body, webhookVersion);

    // Convert body to string for signature verification
    const payload = JSON.stringify(body);

    // create a usd transaction and fiat wallet transaction on development environment
    // for the NG=>USD conversion to work
    if (!EnvironmentService.isProduction()) {
      await this.updateUSDTransactionExternalReference(body as IFireblocksWebhookV2Payload);
    }

    // Process webhook through the blockchain wallet service
    const result = await this.blockchainWalletService.processWebhook(
      payload,
      headers['fireblocks-signature'],
      timestamp,
      webhookVersion,
    );

    this.logger.log('Fireblocks webhook processed successfully');
    return result;
  }

  /**
   * Validates required webhook headers
   * @param headers - The webhook headers
   * @throws Error if required headers are missing
   */
  private validateHeaders(headers: Record<string, string>): void {
    if (!headers['fireblocks-signature']) {
      this.logger.warn('Missing required webhook signature header');
      throw new Error('Missing required webhook signature header');
    }
  }

  /**
   * Detects webhook version based on payload structure
   * @param body - The webhook payload
   * @returns The detected webhook version ('v1' or 'v2')
   */
  private detectWebhookVersion(body: IFireblocksWebhookV1Payload | IFireblocksWebhookV2Payload): 'v1' | 'v2' {
    const hasV1Structure = 'type' in body && 'tenantId' in body && 'timestamp' in body;
    const hasV2Structure = 'id' in body && 'eventType' in body && 'eventVersion' in body && 'workspaceId' in body;

    if (hasV2Structure) {
      return 'v2';
    } else if (hasV1Structure) {
      return 'v1';
    } else {
      // Default to v2 if structure is unclear
      return 'v2';
    }
  }

  /**
   * Logs webhook details for debugging
   * @param body - The webhook payload
   * @param version - The webhook version
   */
  private logWebhookDetails(
    body: IFireblocksWebhookV1Payload | IFireblocksWebhookV2Payload,
    version: 'v1' | 'v2',
  ): void {
    if (version === 'v1') {
      const v1Data = body as IFireblocksWebhookV1Payload;
      const transactionId = 'id' in v1Data.data ? v1Data.data.id : 'N/A';
      this.logger.debug(`V1 Webhook - Type: ${v1Data.type}, Transaction ID: ${transactionId}`);
    } else {
      const v2Data = body as IFireblocksWebhookV2Payload;
      this.logger.debug(`V2 Webhook - Event Type: ${v2Data.eventType}, Transaction ID: ${v2Data.data.id}`);
    }
  }

  /**
   * Maps v1 event type to v2 event type
   * @param v1EventType - The v1 event type
   * @returns The corresponding v2 event type
   */
  mapV1ToV2EventType(v1EventType: FireblocksV1EventType): FireblocksV2EventType {
    return FIREBLOCKS_V1_TO_V2_EVENT_TYPES[v1EventType] || FireblocksV2EventType.TRANSACTION_CREATED;
  }

  /**
   * Maps v2 event type to v1 event type
   * @param v2EventType - The v2 event type
   * @returns The corresponding v1 event type
   */
  mapV2ToV1EventType(v2EventType: FireblocksV2EventType): FireblocksV1EventType {
    return FIREBLOCKS_V2_TO_V1_EVENT_TYPES[v2EventType] || FireblocksV1EventType.TRANSACTION_CREATED;
  }

  private async updateUSDTransactionExternalReference(body: IFireblocksWebhookV2Payload): Promise<void> {
    this.logger.debug(
      `Fireblocks webhook: updating USD transaction external reference for transaction ${body.id} with tx hash ${body.data.txHash} FOR DEVELOPMENT ENVIRONMENT ONLY`,
    );
    if (body.data.txHash) {
      const transaction = await this.transactionRepository.findOne({
        external_reference: (body as any).data.id,
      });

      if (transaction) {
        await this.transactionRepository.update(transaction.id, {
          external_reference: body.data.txHash,
        });
      }
    }
  }
}
