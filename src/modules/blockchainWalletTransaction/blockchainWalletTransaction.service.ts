import { Injectable, Inject, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { BlockchainWalletTransactionRepository } from './blockchainWalletTransaction.repository';
import { FireblocksAdapter } from '../../adapters/blockchain-waas/fireblocks/fireblocks_adapter';
import { ITransactionHistoryItem } from '../../adapters/blockchain-waas/blockchain-waas-adapter.interface';
import { GetUserTransactionsDto } from './dto/get-user-transactions.dto';
import { LockerService } from '../../services/locker/locker.service';
import { TransactionRepository } from '../transaction/transaction.repository';
import { BlockchainWalletTransactionModel } from '../../database/models/blockchain_wallet_transaction/blockchain_wallet_transaction.model';
import { IBlockchainWalletTransaction } from '../../database/models/blockchain_wallet_transaction/blockchain_wallet_transaction.interface';
import { IBlockchainWalletTransactionResponse, IAsset } from './blockchainWalletTransaction.interface';
import { TransactionModel, TransactionStatus } from '../../database/models/transaction';
import { BlockchainWalletTransactionType } from '../../database/models/blockchain_wallet_transaction/blockchain_wallet_transaction.interface';
import {
  TransactionCategory,
  TransactionType,
  TransactionScope,
} from '../../database/models/transaction/transaction.interface';
import { AssetAmount } from '../../utils/asset-amount';
import { StableCoinsService } from '../../config/onedosh/stablecoins.config';
import { IStableAsset } from '../../adapters/blockchain-waas/blockchain-waas-adapter.interface';
import { BlockchainWalletModel } from '../../database/models/blockchain_wallet/blockchain_wallet.model';
import { BlockchainWalletRepository } from '../blockchainWallet/blockchainWallet.repository';
import { InAppNotificationService } from '../inAppNotification/inAppNotification.service';
import { IN_APP_NOTIFICATION_TYPE } from '../inAppNotification/inAppNotification.enum';

@Injectable()
export class BlockchainWalletTransactionService {
  private readonly logger = new Logger(BlockchainWalletTransactionService.name);

  @Inject(BlockchainWalletTransactionRepository)
  private readonly blockchainWalletTransactionRepository: BlockchainWalletTransactionRepository;

  @Inject(FireblocksAdapter)
  private readonly blockchainWaasAdapter: FireblocksAdapter;

  @Inject(LockerService)
  private readonly lockerService: LockerService;

  @Inject(TransactionRepository)
  private readonly transactionRepository: TransactionRepository;

  @Inject(BlockchainWalletRepository)
  private readonly blockchainWalletRepository: BlockchainWalletRepository;

  @Inject(InAppNotificationService)
  private readonly inAppNotificationService: InAppNotificationService;

  async getTransaction(params: { txId?: string; externalTxId?: string }): Promise<ITransactionHistoryItem> {
    try {
      if (params.externalTxId) {
        this.logger.log(`Fetching transaction by external ID: ${params.externalTxId}`);
      } else if (params.txId) {
        this.logger.log(`Fetching transaction by ID: ${params.txId}`);
      } else {
        throw new Error('Either txId or externalTxId must be provided');
      }
      const transaction = await this.blockchainWaasAdapter.getTransaction({
        txId: params.txId,
        externalTxId: params.externalTxId,
      });
      if (params.externalTxId) {
        this.logger.log(`Transaction with external ID ${params.externalTxId} fetched successfully`);
      } else {
        this.logger.log(`Transaction with ID ${params.txId} fetched successfully`);
      }
      return transaction;
    } catch (error) {
      this.logger.error(`Error fetching transaction: ${params.externalTxId || params.txId}`, error.stack);
      throw error;
    }
  }

  async getUserTransactions(idToQuery: string, filters: GetUserTransactionsDto, useWalletId: boolean) {
    const result = await this.blockchainWalletTransactionRepository.findByUserIdWithFilters(
      idToQuery,
      filters,
      useWalletId,
    );

    // Handle null/undefined results
    if (!result) {
      return result;
    }

    // Map asset IDs to asset objects and peer user details
    if (result.data && Array.isArray(result.data)) {
      const mappedData = await this.mapTransactionsWithAssetInfo(result.data as BlockchainWalletTransactionModel[]);
      return {
        ...result,
        data: mappedData,
      };
    }

    return result;
  }

  /**
   * Map asset ID to asset object with name and network
   *
   * This method takes an asset ID and returns an object containing the asset ID,
   * name, and network information from the provided stablecoin configuration.
   *
   * @param assetId The asset ID to map
   * @param stableCoins Array of stablecoin configurations to search through
   * @returns IAsset object with id, name, and network
   *
   * @example
   * const stableCoins = StableCoinsService.getSupportedStableCoins();
   * const asset = blockchainWalletTransactionService.mapAssetIdToAsset('USDC_ETH_TEST5_0GER', stableCoins);
   * // Returns: { id: 'USDC_ETH_TEST5_0GER', name: 'USD Coin', network: 'ETH' }
   */
  private mapAssetIdToAsset(assetId: string, stableCoins: IStableAsset[]): IAsset {
    try {
      const stableCoin = stableCoins.find((coin) => coin.id === assetId);

      if (stableCoin) {
        return {
          id: assetId,
          name: stableCoin.name,
          network: (stableCoin as any).network || stableCoin.type,
        };
      }

      // Fallback: if not found in stablecoin config, return basic info
      this.logger.warn(`Asset ID ${assetId} not found in stablecoin configuration`);
      return {
        id: assetId,
        name: assetId,
        network: 'Unknown',
      };
    } catch (error) {
      this.logger.error(`Error mapping asset ID ${assetId}: ${error.message}`, error.stack);
      return {
        id: assetId,
        name: assetId,
        network: 'Unknown',
      };
    }
  }

  /**
   * Map transactions to include asset information and peer user details
   *
   * This method takes an array of blockchain wallet transactions and maps each
   * transaction's asset ID to a full asset object containing id, name, and network.
   * For internal transactions, it also fetches peer user details via peer_wallet_id.
   * Optimized to fetch stablecoins configuration once and reuse for all transactions.
   *
   * @param transactions Array of blockchain wallet transactions
   * @returns Array of transactions with mapped asset information and peer user details
   */
  private async mapTransactionsWithAssetInfo(
    transactions: BlockchainWalletTransactionModel[],
  ): Promise<IBlockchainWalletTransactionResponse[]> {
    // Get stablecoins configuration once for all transactions
    const stableCoins = StableCoinsService.getSupportedStableCoins();

    // Get unique peer wallet IDs for internal transactions
    const peerWalletIds = transactions
      .filter((tx) => tx.peer_wallet_id && tx.transaction_scope === 'internal')
      .map((tx) => tx.peer_wallet_id)
      .filter((id, index, arr) => arr.indexOf(id) === index); // Remove duplicates

    // Fetch peer wallet details with user information
    const peerWallets = await Promise.all(
      peerWalletIds.map(async (walletId) => {
        const wallet = await this.blockchainWalletRepository.findWalletByIdWithUser(walletId);
        return { walletId, wallet };
      }),
    );

    // Create a map for quick lookup
    const peerWalletMap = new Map(peerWallets.filter((pw) => pw.wallet).map((pw) => [pw.walletId, pw.wallet]));

    const mappedTransactions = transactions.map((transaction) => {
      const assetInfo = this.mapAssetIdToAsset(transaction.asset, stableCoins);

      // Get peer user details for internal transactions
      let peerUser = undefined;
      if (transaction.peer_wallet_id && transaction.transaction_scope === 'internal') {
        const peerWallet = peerWalletMap.get(transaction.peer_wallet_id);
        peerUser = peerWallet?.user;
      }

      return {
        ...transaction,
        asset: assetInfo,
        peer_user: peerUser,
      } as IBlockchainWalletTransactionResponse;
    });

    return mappedTransactions;
  }

  /**
   * Get a blockchain wallet transaction by transaction hash
   *
   * This method retrieves a blockchain wallet transaction from the database using
   * the transaction hash. It's useful for looking up transactions that have been
   * broadcasted to the blockchain and have a hash assigned.
   *
   * @param txHash The transaction hash to search for
   * @returns Promise<BlockchainWalletTransactionModel | null> The found transaction or null if not found
   * @throws Error if there's an issue with the database query
   *
   * @example
   * const transaction = await blockchainWalletTransactionService.getTransactionByHash('0x123...');
   * if (transaction) {
   *   this.logger.log(`Found transaction: ${transaction.id} with status: ${transaction.status}`);
   * }
   */
  async getTransactionByHash(txHash: string): Promise<BlockchainWalletTransactionModel | null> {
    try {
      this.logger.log(`Fetching blockchain wallet transaction by hash: ${txHash}`);

      if (!txHash || txHash.trim() === '') {
        throw new BadRequestException('Transaction hash is required');
      }

      const transaction = await this.blockchainWalletTransactionRepository.findByTransactionHash(txHash.trim());

      if (transaction) {
        this.logger.log(`Found blockchain wallet transaction with hash ${txHash}: ${transaction.id}`);
      } else {
        this.logger.log(`No blockchain wallet transaction found with hash: ${txHash}`);
      }

      return transaction;
    } catch (error) {
      this.logger.error(
        `Error fetching blockchain wallet transaction by hash ${txHash}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Mark a blockchain wallet transaction as successful
   *
   * This method updates a pending blockchain wallet transaction to successful status,
   * validates the transaction exists and is still pending, then creates a corresponding
   * main transaction record. The operation is atomic and uses locks to prevent
   * concurrent modifications.
   *
   * @param transactionId The ID of the blockchain wallet transaction to mark as successful
   * @param updateData Partial data to update the transaction with (provider_reference, tx_hash, etc.)
   * @returns Promise<{blockchainWalletTransaction: BlockchainWalletTransactionModel,
   * mainTransaction: TransactionModel}>
   * @throws NotFoundException if transaction not found
   * @throws BadRequestException if transaction is not pending or invalid data
   */
  async markTransactionAsSuccessful(
    transactionId: string,
    wallet: BlockchainWalletModel,
    updateData: Partial<IBlockchainWalletTransaction> = {},
  ): Promise<{ blockchainWalletTransaction: BlockchainWalletTransactionModel; mainTransaction: TransactionModel }> {
    const lockKey = `blockchain-wallet-transaction:${transactionId}:mark-successful`;

    return await this.lockerService.withLock(
      lockKey,
      async () => {
        // Find the transaction and validate it exists and is pending
        const blockchainWalletTransaction = await this.blockchainWalletTransactionRepository.findOne({
          id: transactionId,
          type: 'debit',
        });

        if (!blockchainWalletTransaction) {
          this.logger.warn(`Blockchain wallet transaction not found: ${transactionId}`);
          throw new NotFoundException(`Blockchain wallet transaction with ID ${transactionId} not found`);
        }

        if (blockchainWalletTransaction.status !== TransactionStatus.PENDING) {
          this.logger.warn(
            `Transaction ${transactionId} is not pending, current status: ${blockchainWalletTransaction.status}`,
          );
          throw new BadRequestException(
            `Transaction is not pending, current status: ${blockchainWalletTransaction.status}`,
          );
        }

        // Create both transactions within the same transaction scope
        const result = await this.blockchainWalletTransactionRepository.transaction(async (trx) => {
          // Create main transaction record first
          const mainTransactionData = {
            user_id: wallet.user_id,
            reference: transactionId,
            asset: blockchainWalletTransaction.asset,
            amount: Number(
              AssetAmount.fromDb(
                blockchainWalletTransaction.asset,
                blockchainWalletTransaction.amount,
                wallet.decimal,
              ).toBigInt(),
            ),
            balance_before: Number(
              AssetAmount.fromDb(
                blockchainWalletTransaction.asset,
                blockchainWalletTransaction.balance_before,
                wallet.decimal,
              ).toBigInt(),
            ),
            balance_after: Number(
              AssetAmount.fromDb(
                blockchainWalletTransaction.asset,
                blockchainWalletTransaction.balance_after,
                wallet.decimal,
              ).toBigInt(),
            ),
            transaction_type: this.mapBlockchainTypeToTransactionType(blockchainWalletTransaction.transaction_type),
            category: TransactionCategory.BLOCKCHAIN,
            transaction_scope: TransactionScope.INTERNAL,
            status: TransactionStatus.COMPLETED,
            description: updateData.description || blockchainWalletTransaction.description,
            failure_reason: updateData.failure_reason,
            processed_at: DateTime.now().toSQL(),
          };

          const mainTransaction = await this.transactionRepository.create(mainTransactionData, trx);

          // Update the blockchain wallet transaction with status (but NOT main_transaction_id yet)
          const blockchainWalletUpdateData: Partial<BlockchainWalletTransactionModel> = {
            status: TransactionStatus.COMPLETED,
          };

          // Add allowed fields from updateData
          const allowedFields = ['tx_hash', 'network_fee', 'metadata'];
          allowedFields.forEach((field) => {
            if (updateData[field] !== undefined) {
              blockchainWalletUpdateData[field] = updateData[field];
            }
          });

          const updatedBlockchainWalletTransaction = await this.blockchainWalletTransactionRepository.update(
            transactionId,
            blockchainWalletUpdateData,
            { trx },
          );

          this.logger.log(`Transaction ${transactionId} marked as successful for user ${wallet.user_id}`);

          // Update the main transaction with the blockchain wallet transaction ID as reference
          await this.transactionRepository.update(
            mainTransaction.id,
            { reference: updatedBlockchainWalletTransaction.id },
            { trx },
          );

          return {
            blockchainWalletTransaction: updatedBlockchainWalletTransaction,
            mainTransaction,
          };
        });

        // After the transaction is committed, update the main_transaction_id
        // This ensures the main transaction is committed and available for foreign key references
        await this.blockchainWalletTransactionRepository.update(transactionId, {
          main_transaction_id: result.mainTransaction.id,
        });

        this.logger.log(
          `Updated blockchain wallet transaction ${transactionId} with main_transaction_id: ${result.mainTransaction.id}`,
        );

        // Create in-app notification for sender (transaction resolved)
        try {
          await this.inAppNotificationService.createNotification({
            user_id: wallet.user_id,
            type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
            title: 'Transaction completed',
            message: `Your blockchain transaction has been completed successfully`,
            metadata: {
              transactionId: result.mainTransaction.id,
              blockchainWalletTransactionId: transactionId,
              asset: wallet.asset,
            },
          });
        } catch (e) {
          this.logger.error(`Failed to create transaction success notification: ${(e as Error).message}`);
        }

        return result;
      },
      { ttl: 30000, retryCount: 5, retryDelay: 500 },
    );
  }

  /**
   * Map BlockchainWalletTransactionType to TransactionType
   */
  private mapBlockchainTypeToTransactionType(type: BlockchainWalletTransactionType): TransactionType {
    switch (type) {
      case BlockchainWalletTransactionType.DEPOSIT:
        return TransactionType.DEPOSIT;
      case BlockchainWalletTransactionType.WITHDRAWAL:
        return TransactionType.WITHDRAWAL;
      case BlockchainWalletTransactionType.TRANSFER_IN:
      case BlockchainWalletTransactionType.TRANSFER_OUT:
        return TransactionType.TRANSFER;
      case BlockchainWalletTransactionType.REFUND:
        return TransactionType.REFUND;
      case BlockchainWalletTransactionType.FEE:
        return TransactionType.FEE;
      case BlockchainWalletTransactionType.SWAP:
        return TransactionType.EXCHANGE;
      case BlockchainWalletTransactionType.REVERSAL:
        return TransactionType.REFUND; // or another appropriate type
      default:
        throw new Error('Unsupported blockchain wallet transaction type');
    }
  }
}
