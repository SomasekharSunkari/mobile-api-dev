import { Inject, Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../services/redis/redis.service';

@Injectable()
export class FiatWalletEscrowService {
  private readonly logger = new Logger(FiatWalletEscrowService.name);

  @Inject(RedisService)
  private readonly redisService: RedisService;

  async moveMoneyToEscrow(transactionId: string, amount: number) {
    this.logger.debug(`Moving ${amount} to escrow for transaction ${transactionId}`);
    const key = this.getEscrowKey(transactionId);
    await this.redisService.getClient().set(key, amount);
  }

  async releaseMoneyFromEscrow(transactionId: string) {
    this.logger.debug(`Releasing money from escrow for transaction ${transactionId}`);
    const key = this.getEscrowKey(transactionId);
    await this.redisService.getClient().del(key);
  }

  async getEscrowAmount(transactionId: string): Promise<number> {
    this.logger.debug(`Getting escrow amount for transaction ${transactionId}`);
    const key = this.getEscrowKey(transactionId);
    const amount = await this.redisService.getClient().get(key);
    return amount ? Number(amount) : 0;
  }

  private getEscrowKey(transactionId: string): string {
    return `fiat-wallet:transaction:${transactionId}:escrow:amount`;
  }
}
