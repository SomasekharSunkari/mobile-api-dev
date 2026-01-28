import { Injectable, Logger, Inject } from '@nestjs/common';
import { randomBytes, randomInt } from 'crypto';
import { Observable } from 'rxjs';
import { EventEmitterEventsEnum } from '../eventEmitter/eventEmitter.interface';
import { EventEmitterService } from '../eventEmitter/eventEmitter.service';
import { RedisService } from '../redis/redis.service';
import { BalanceUpdateData } from './interfaces/stream.interfaces';
import { InAppNotificationService } from '../../modules/inAppNotification/inAppNotification.service';

@Injectable()
export class StreamService {
  private readonly logger = new Logger(StreamService.name);

  constructor(
    private readonly eventEmitterService: EventEmitterService,
    private readonly redisService: RedisService,
    @Inject(InAppNotificationService)
    private readonly inAppNotificationService: InAppNotificationService,
  ) {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.logger.log('Setting up event listeners for StreamService');

    // Listen for balance changes
    this.eventEmitterService.on(EventEmitterEventsEnum.WALLET_BALANCE_CHANGED, (data: BalanceUpdateData) => {
      this.logger.log(`[StreamService] Received WALLET_BALANCE_CHANGED event: ${JSON.stringify(data)}`);
      this.publishStreamUpdate('balance', data);
    });

    // Listen for in-app notification creation and publish unread count (provided by emitter)
    this.eventEmitterService.on(
      EventEmitterEventsEnum.IN_APP_NOTIFICATION_CREATED,
      async (data: { userId: string; notificationId: string; unread_count: number; timestamp: Date }) => {
        this.logger.log(
          `[StreamService] Received IN_APP_NOTIFICATION_CREATED event for user=${data.userId} notif=${data.notificationId} unread=${data.unread_count}`,
        );
        try {
          await this.publishStreamUpdate('notification_unread', {
            userId: data.userId,
            unread_count: data.unread_count,
            timestamp: new Date(),
          });
        } catch (error) {
          this.logger.error('[StreamService] Failed to publish notification_unread update', error as Error);
        }
      },
    );

    this.logger.log('Event listeners setup complete');
  }

  private async publishStreamUpdate(streamType: string, data: any): Promise<void> {
    try {
      const sanitizeWallet = (wallet: any) => {
        try {
          if (!wallet) return wallet;
          if (typeof wallet.toJSON === 'function') return wallet.toJSON();
          if (typeof wallet.$toJson === 'function') return wallet.$toJson();
          return wallet;
        } catch {
          return wallet;
        }
      };

      const safeData = {
        ...data,
        wallet: sanitizeWallet(data?.wallet),
      };

      const eventData = {
        type: `${streamType}_update`,
        data: {
          ...safeData,
          timestamp: (data.timestamp instanceof Date ? data.timestamp : new Date()).toISOString(),
        },
      };

      const channel = `${streamType}:${data.userId}`;
      const publishResult = await this.redisService.publish(channel, JSON.stringify(eventData));

      this.logger.log(
        `[StreamService] Published to Redis channel=${channel}, result=${publishResult}, data=${JSON.stringify(eventData)}`,
      );
    } catch (error) {
      this.logger.error(`[StreamService] Error publishing ${streamType} update to Redis:`, error);
    }
  }

  // Get user-specific stream from Redis
  getUserStream(userId: string, streamType: string): Observable<any> {
    return new Observable((observer) => {
      const redisClient = this.redisService.getClient();
      const subscriber = redisClient.duplicate();
      const channel = `${streamType}:${userId}`;

      this.logger.log(`[SSE] Starting subscription to Redis channel=${channel} for user=${userId}`);

      subscriber.subscribe(channel);

      // Send immediate connection confirmation
      observer.next({
        data: JSON.stringify({
          type: 'connected',
          timestamp: new Date().toISOString(),
        }),
      });

      subscriber.on('message', (redisChannel, message) => {
        this.logger.log(`[SSE] Received message from Redis channel=${redisChannel}, message=${message}`);
        try {
          const data = JSON.parse(message);
          observer.next({ data: JSON.stringify(data) });
        } catch (error) {
          this.logger.error(`[SSE] Error parsing Redis message:`, error);
        }
      });

      subscriber.on('error', (error) => {
        this.logger.error(`[SSE] Redis subscription error for channel ${channel}:`, error);
        observer.error(error);
      });

      // Cleanup function
      return () => {
        this.logger.log(`[SSE] Unsubscribing from Redis channel=${channel} for user=${userId}`);
        subscriber.unsubscribe();
        subscriber.disconnect();
      };
    });
  }

  // Convenience methods for specific stream types
  getUserBalanceStream(userId: string): Observable<any> {
    return this.getUserStream(userId, 'balance');
  }

  getUserUnreadNotificationCountStream(userId: string): Observable<any> {
    return new Observable((observer) => {
      const redisClient = this.redisService.getClient();
      const subscriber = redisClient.duplicate();
      const channel = `notification_unread:${userId}`;

      this.logger.log(`[SSE] Starting subscription to Redis channel=${channel} for user=${userId}`);

      subscriber.subscribe(channel);

      // Send immediate connection confirmation with current unread count
      this.getCurrentUnreadCount(userId)
        .then((unreadCount) => {
          observer.next({
            data: JSON.stringify({
              type: 'connected',
              data: {
                userId: userId,
                unread_count: unreadCount,
                timestamp: new Date().toISOString(),
              },
            }),
          });
        })
        .catch((error) => {
          this.logger.error(`[SSE] Error fetching initial unread count for user ${userId}:`, error);
          observer.next({
            data: JSON.stringify({
              type: 'connected',
              data: {
                userId: userId,
                unread_count: 0,
                timestamp: new Date().toISOString(),
              },
            }),
          });
        });

      subscriber.on('message', (redisChannel, message) => {
        this.logger.log(`[SSE] Received message from Redis channel=${redisChannel}, message=${message}`);
        try {
          const data = JSON.parse(message);
          observer.next({ data: JSON.stringify(data) });
        } catch (error) {
          this.logger.error(`[SSE] Error parsing Redis message:`, error);
        }
      });

      subscriber.on('error', (error) => {
        this.logger.error(`[SSE] Redis subscription error for channel ${channel}:`, error);
        observer.error(error);
      });

      // Cleanup function
      return () => {
        this.logger.log(`[SSE] Unsubscribing from Redis channel=${channel} for user=${userId}`);
        subscriber.unsubscribe();
        subscriber.disconnect();
      };
    });
  }

  // Publish a sample balance update for testing SSE streams(temporarily for testing)
  async triggerSampleBalanceUpdate(
    userId: string,
    walletType: 'fiat' | 'blockchain',
    overrides?: Partial<BalanceUpdateData>,
  ): Promise<void> {
    const now = new Date();
    const defaultCurrency = walletType === 'fiat' ? 'NGN' : 'USDC';

    const randomId = () => `sample_${randomBytes(5).toString('hex')}`;
    const randomBalance = (decimals: number) => (randomInt(0, 100000) / 100).toFixed(decimals);

    const fiatWalletShape = () => ({
      id: overrides?.walletId || randomId(),
      user_id: userId,
      balance: Number(overrides?.balance ?? randomBalance(2)),
      credit_balance: 0,
      asset: defaultCurrency,
      status: 'active',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });

    const blockchainWalletShape = () => ({
      id: overrides?.walletId || randomId(),
      user_id: userId,
      provider_account_ref: 'provider_acc_ref_sample',
      provider: 'fireblocks',
      asset: defaultCurrency,
      base_asset: 'USD',
      address: '0xsampleaddress000000000000000000000000000000',
      balance: String(overrides?.balance ?? randomBalance(6)),
      name: 'Sample Wallet',
      status: 'active',
      network: 'ETH',
      rails: 'crypto',
      decimal: 6,
      is_visible: true,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });
    const sampleData: BalanceUpdateData = {
      userId,
      walletType,
      walletId: overrides?.walletId || 'sample_wallet_id',
      currency: overrides?.currency || defaultCurrency,
      balance: overrides?.balance || randomBalance(2),
      previousBalance: overrides?.previousBalance || randomBalance(2),
      transactionId: overrides?.transactionId || undefined,
      timestamp: overrides?.timestamp || now,
      wallet: overrides?.wallet || (walletType === 'fiat' ? fiatWalletShape() : blockchainWalletShape()),
    };

    await this.publishStreamUpdate('balance', sampleData);
  }

  // Get current unread count for a user
  private async getCurrentUnreadCount(userId: string): Promise<number> {
    try {
      // Use the notification repository to get unread count
      const unreadCount = await this.inAppNotificationService['notificationRepository'].countUnreadByUserId(userId);
      this.logger.log(`[StreamService] Current unread count for user ${userId}: ${unreadCount}`);
      return unreadCount;
    } catch (error) {
      this.logger.error(`[StreamService] Error fetching unread count for user ${userId}:`, error);
      return 0;
    }
  }
}
