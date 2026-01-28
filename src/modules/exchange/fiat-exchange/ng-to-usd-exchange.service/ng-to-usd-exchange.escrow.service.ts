import { Inject, Logger } from '@nestjs/common';
import { RedisService } from '../../../../services/redis/redis.service';

export class NgToUsdExchangeEscrowService {
  private readonly logger = new Logger(NgToUsdExchangeEscrowService.name);

  @Inject(RedisService)
  private readonly redisService: RedisService;

  public readonly TRANSACTION_REFERENCE_PREFIX = 'ng-to-usd-exchange:transaction-reference';
  public readonly CARD_FUNDING_CONTEXT_PREFIX = 'card_funding_context';

  getKey(transactionReference: string): string {
    return `${this.TRANSACTION_REFERENCE_PREFIX}:${transactionReference}`;
  }

  getCardFundingContextKey(transactionReference: string): string {
    return `${this.CARD_FUNDING_CONTEXT_PREFIX}:${transactionReference}`;
  }

  async storeTransactionData(transactionReference: string, data: Record<string, any>) {
    this.logger.debug(`Storing transaction data for transaction reference ${transactionReference} in redis`);

    const key = this.getKey(transactionReference);
    const value = JSON.stringify(data);
    await this.redisService.getClient().set(key, value, 'EX', 600);
  }

  async removeTransactionData(transactionReference: string) {
    this.logger.debug(`Removing transaction data for transaction reference ${transactionReference} from redis`);

    const key = this.getKey(transactionReference);
    await this.redisService.getClient().del(key);
  }

  async getTransactionData(transactionReference: string): Promise<Record<string, any> | null> {
    this.logger.debug(`Getting transaction data for transaction reference ${transactionReference} from redis`);

    const key = this.getKey(transactionReference);
    const value = await this.redisService.getClient().get(key);
    return value ? JSON.parse(value) : null;
  }

  /**
   * Store card funding context in Redis
   * This context links an exchange transaction to a card funding operation.
   * Used to trigger USD transfer to Rain after exchange completes.
   *
   * @param transactionRef - Exchange transaction reference
   * @param context - Card funding context containing card details, amounts, and deposit address
   */
  async storeCardFundingContext(
    transactionRef: string,
    context: {
      cardId: string;
      cardUserId: string;
      userId: string;
      depositAddress: string;
      usdAmountAfterExchange: number;
      cardFeeUSD: number;
      netUsdUserWillReceive: number;
      rateId: string;
      ngnAmount: number;
    },
  ): Promise<void> {
    this.logger.debug(`Storing card funding context for transaction reference ${transactionRef} in redis`);

    const key = this.getCardFundingContextKey(transactionRef);
    const value = JSON.stringify(context);
    await this.redisService.getClient().set(key, value, 'EX', 3600); // Expires in 1 hour
  }

  /**
   * Retrieve card funding context from Redis
   * @param transactionRef - Exchange transaction reference
   * @returns Card funding context or null if not found
   */
  async getCardFundingContext(transactionRef: string): Promise<any> {
    this.logger.debug(`Getting card funding context for transaction reference ${transactionRef} from redis`);

    const key = this.getCardFundingContextKey(transactionRef);
    const value = await this.redisService.getClient().get(key);
    return value ? JSON.parse(value) : null;
  }

  /**
   * Update card funding context in Redis
   * Used to add card transaction ID after card transaction is created
   *
   * @param transactionRef - Exchange transaction reference
   * @param context - Updated card funding context
   */
  async updateCardFundingContext(transactionRef: string, context: any): Promise<void> {
    this.logger.debug(`Updating card funding context for transaction reference ${transactionRef} in redis`);

    const key = this.getCardFundingContextKey(transactionRef);
    const value = JSON.stringify(context);
    await this.redisService.getClient().set(key, value, 'EX', 3600);
  }

  /**
   * Remove card funding context from Redis
   * Called after card funding is completed or failed
   *
   * @param transactionRef - Exchange transaction reference
   */
  async removeCardFundingContext(transactionRef: string): Promise<void> {
    this.logger.debug(`Removing card funding context for transaction reference ${transactionRef} from redis`);

    const key = this.getCardFundingContextKey(transactionRef);
    await this.redisService.getClient().del(key);
  }
}
