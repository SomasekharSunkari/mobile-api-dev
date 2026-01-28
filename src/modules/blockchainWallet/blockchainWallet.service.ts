import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BlockchainWaasAdapter } from '../../adapters/blockchain-waas/blockchain-waas-adapter';
import {
  IBlockchainResendWebhookRequest,
  IBlockchainResendWebhookResponse,
  IBlockchainVaultAccountAssetWebhookData,
  IBlockchainVaultAccountWebhookData,
  IBlockchainWebhookData,
  IBlockchainWebhookDataUnion,
  IBlockchainWebhookPayload,
  IBlockchainWebhookResponse,
  ICreateTransactionParams,
  ICreateWalletParams,
  ICreateWalletResponse,
  IEstimateExternalFeeParams,
  IEstimateInternalTransferFeeParams,
  IExternalTransferParams,
  IFeeEstimateResponse,
  IInternalTransferParams,
  IStableAsset,
  ITransferResponse,
} from '../../adapters/blockchain-waas/blockchain-waas-adapter.interface';
import { EnvironmentService } from '../../config/environment/environment.service';
import { FIREBLOCKS_ASSET_ID, FIREBLOCKS_MASTER_VAULT_ID } from '../../constants/constants';
import { StableCoinConfig, StableCoinsService } from '../../config/onedosh/stablecoins.config';
import { BLOCKCHAIN_ACCOUNT_RAIL, BlockchainAccountRail } from '../../constants/blockchainAccountRails';
import { IUser, UserModel } from '../../database';
import { BlockchainAccountModel } from '../../database/models/blockchain_account';
import { BlockchainAccountProvider } from '../../database/models/blockchain_account/blockchain_account.interface';
import { IBlockchainGasFundTransaction } from '../../database/models/blockchain_gas_fund_transaction';
import { BlockchainWalletModel, IBlockchainWallet } from '../../database/models/blockchain_wallet';
import {
  BlockchainWalletProvider,
  BlockchainWalletStatus,
  BlockchainWalletRails,
} from '../../database/models/blockchain_wallet/blockchain_wallet.interface';
import {
  BlockchainWalletTransactionType,
  IBlockchainWalletTransaction,
} from '../../database/models/blockchain_wallet_transaction/blockchain_wallet_transaction.interface';
import { BlockchainWalletTransactionModel } from '../../database/models/blockchain_wallet_transaction/blockchain_wallet_transaction.model';
import { TransactionStatus } from '../../database/models/transaction';
import {
  TransactionCategory,
  TransactionScope,
  TransactionType,
} from '../../database/models/transaction/transaction.interface';
import { EventEmitterEventsEnum } from '../../services/eventEmitter/eventEmitter.interface';
import { EventEmitterService } from '../../services/eventEmitter/eventEmitter.service';
import { AssetAmount } from '../../utils/asset-amount';
import { UtilsService } from '../../utils/utils.service';

import { LockerService } from '../../services/locker/locker.service';
import { BlockchainService } from '../../services/blockchain/blockchain.service';
import { UserRepository } from '../auth/user/user.repository';
import { BlockchainAccountsService } from '../blockchainAccounts/blockchainAccounts.service';
import { BlockchainGasFundTransactionService } from '../blockchainGasFundTransaction';
import { BlockchainWalletTransactionRepository } from '../blockchainWalletTransaction/blockchainWalletTransaction.repository';
import { BlockchainWalletTransactionService } from '../blockchainWalletTransaction/blockchainWalletTransaction.service';
import { GetUserTransactionsDto } from '../blockchainWalletTransaction/dto/get-user-transactions.dto';
import { DepositAddressService } from '../depositAddress/depositAddress.service';
import { IN_APP_NOTIFICATION_TYPE } from '../inAppNotification/inAppNotification.enum';
import { InAppNotificationService } from '../inAppNotification/inAppNotification.service';
import { TransactionRepository } from '../transaction/transaction.repository';
import { BlockchainWalletKeyRepository } from '../blockchainWalletKey/blockchainWalletKey.repository';
import {
  BlockchainWalletTransactionMetadata,
  ICreateWallet,
  ICreateCustomWallet,
  IEstimateFeeParams,
  IInitiateTransactionParams,
} from './blockchainWallet.interface';
import { BlockchainWalletRepository } from './blockchainWallet.repository';

@Injectable()
export class BlockchainWalletService {
  private readonly logger = new Logger(BlockchainWalletService.name);

  @Inject(BlockchainWaasAdapter)
  private readonly blockchainWaasAdapter: BlockchainWaasAdapter;

  @Inject(BlockchainWalletRepository)
  private readonly blockchainWalletRepository: BlockchainWalletRepository;

  @Inject(BlockchainWalletTransactionRepository)
  private readonly blockchainWalletTransactionRepository: BlockchainWalletTransactionRepository;

  @Inject(LockerService)
  private readonly lockerService: LockerService;

  @Inject(BlockchainWalletTransactionService)
  private readonly blockchainWalletTransactionService: BlockchainWalletTransactionService;

  @Inject(TransactionRepository)
  private readonly transactionRepository: TransactionRepository;

  @Inject(UserRepository)
  private readonly userRepository: UserRepository;

  @Inject(BlockchainAccountsService)
  private readonly blockchainAccountsService: BlockchainAccountsService;

  @Inject(DepositAddressService)
  private readonly depositAddressService: DepositAddressService;

  @Inject(BlockchainGasFundTransactionService)
  private readonly blockchainGasFundTransactionService: BlockchainGasFundTransactionService;

  @Inject(EventEmitterService)
  private readonly eventEmitterService: EventEmitterService;

  @Inject(InAppNotificationService)
  private readonly inAppNotificationService: InAppNotificationService;

  @Inject(BlockchainService)
  private readonly blockchainService: BlockchainService;

  @Inject(BlockchainWalletKeyRepository)
  private readonly blockchainWalletKeyRepository: BlockchainWalletKeyRepository;

  /**
   * Get available stable coins from the blockchain adapter
   *
   * This method fetches all available stable assets that can be used for blockchain transactions.
   * Stable assets are cryptocurrencies pegged to fiat currencies (like USDC, USDT, etc.)
   * that provide price stability for cross-border payments.
   *
   * @returns Promise<IStableAsset[]> Array of stable assets with their details including
   *          asset ID, symbol, name, and network information
   * @throws Error if the blockchain adapter is unavailable or returns an error
   *
   * @example
   * const stableCoins = await blockchainWalletService.getStableCoins();
   * // Returns: [{ id: 'usdc', symbol: 'USDC', name: 'USD Coin', network: 'ethereum' }, ...]
   */
  async getStableCoins(): Promise<IStableAsset[]> {
    try {
      this.logger.log('Fetching stable coins from database...');

      // Use the stable coins service to get configured stable coins
      const stableAssets = StableCoinsService.getSupportedStableCoins();

      this.logger.log(`Found ${stableAssets.length} stable coins`);

      return stableAssets;
    } catch (error) {
      this.logger.error(`Error fetching stable coins: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get stable coins from external provider
   * This method fetches stable coins from the blockchain provider and maps them to our internal format
   */
  async getStableCoinsFromProvider(provider?: string): Promise<IStableAsset[]> {
    try {
      this.logger.log('Fetching stable coins from external provider...');

      // First try to get from external provider
      const externalAssets = await this.blockchainWaasAdapter.getAvailableStableAssets();

      // Map external assets to our internal configuration
      const stableAssets = StableCoinsService.mapExternalAssetsToStableCoins(externalAssets, provider || 'fireblocks');

      this.logger.log(`Found ${stableAssets.length} stable coins from external provider`);

      return stableAssets;
    } catch (error) {
      this.logger.error(`Error fetching stable coins from provider: ${error.message}`, error.stack);

      // Fallback to configured stable coins if external provider fails
      this.logger.log('Falling back to configured stable coins...');
      return StableCoinsService.getSupportedStableCoins();
    }
  }

  /**
   * Create a blockchain account for a user
   *
   * This method creates a new blockchain account for a user in the blockchain provider's system.
   * The account serves as a container for multiple wallets and assets. Each user can have
   * one account that holds multiple wallets for different assets (USDC, USDT, etc.)
   *
   * The account creation is idempotent, meaning if the same idempotencyKey is used,
   * the same account will be returned without creating duplicates.
   *
   * @param user The user object containing user ID and username
   * @param params Account creation parameters including idempotencyKey for duplicate prevention
   * @returns Promise<ICreateAccountResponse> The created account response with account ID and status
   * @throws Error if account creation fails or user already has an account
   *
   * @example
   * const account = await blockchainWalletService.createAccount(user, { idempotencyKey: 'unique-key' });
   * // Returns: { id: 'acc_123', name: 'john' }
   */
  async createBlockchainAccount(user: IUser, rails?: BlockchainAccountRail): Promise<BlockchainAccountModel> {
    try {
      this.logger.log(`Creating account for user ${user.username} (${user.id})`);

      const existingAccounts = await this.blockchainAccountsService.getUserAccounts(user.id);

      const targetRails = rails || ('crypto' as BlockchainAccountRail);

      const existingAccount = existingAccounts.find((acc) => acc.rails === targetRails);

      if (existingAccount) {
        this.logger.log(
          `User already has a blockchain account for rails ${targetRails}: ${existingAccount.provider_ref}`,
        );

        return existingAccount;
      }

      const idempotencyKey = UtilsService.generateIdempotencyKey();
      this.logger.debug(`Generated idempotency key for account creation: ${idempotencyKey}`);

      const providerAccountResponse = await this.blockchainWaasAdapter.createAccount({
        user_id: user.id,
        user_name: `${user.username}-${targetRails}`,
        idempotencyKey: idempotencyKey,
      });

      if (!providerAccountResponse) {
        throw new NotFoundException('Blockchain account could not be created');
      }

      // Save the account using blockchain accounts service
      const blockchainAccount = await this.blockchainAccountsService.createAccount(
        user.id,
        providerAccountResponse.id,
        BlockchainAccountProvider.FIREBLOCKS,
        rails || ('crypto' as BlockchainAccountRail),
      );

      this.logger.log(`Account created successfully: ${blockchainAccount.id}`);

      return blockchainAccount;
    } catch (error) {
      this.logger.error(`Error creating account: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Create a blockchain wallet for a user with specified assets
   *
   * This method creates a blockchain wallet for specific assets within a user's account.
   * A wallet is asset-specific (e.g., USDC wallet, USDT wallet) and allows users to
   * hold and transact with that particular stablecoin.
   *
   * Multiple wallets can be created for different assets under the same user account.
   * Each wallet has its own balance and transaction history.
   *
   * @param user The user object for whom the wallet is being created
   * @param params Wallet creation parameters including asset IDs and idempotencyKey
   * @returns Promise<ICreateWalletResponse> The created wallet response with wallet details
   * @throws Error if wallet creation fails, asset not supported, or user account not found
   *
   * @example
   * const wallet = await blockchainWalletService.createWallet(user, {
   *   assetIds: ['usdc', 'usdt'],
   *   idempotencyKey: 'wallet-key'
   * });
   * // Returns: { id: 'wallet_123', account_id: 'acc_123', assets: ['usdc', 'usdt'] }
   */
  async createBlockchainWallet(user: IUser, params: ICreateWallet): Promise<ICreateWalletResponse> {
    try {
      this.logger.log(`Creating wallet for user ${user.id} and assets ${params.asset_ids}`);

      // Always generate a backend idempotency key for wallet/account creation
      const idempotencyKey = UtilsService.generateIdempotencyKey();
      this.logger.debug(`Generated idempotency key for wallet creation: ${idempotencyKey}`);

      // Get blockchain account details, tied to the specified rails (if provided)
      const targetRail = params.rail || ('crypto' as BlockchainAccountRail);
      let blockchainAccountId: string = params.blockchain_account_id;
      let blockChainAccountProviderRef: string = params.blockchain_account_ref;

      if (!blockchainAccountId && !blockChainAccountProviderRef) {
        const existingAccounts = await this.blockchainAccountsService.getUserAccounts(user.id);

        const accountForRail = existingAccounts.find((a) => a.rails === targetRail);

        if (accountForRail) {
          blockChainAccountProviderRef = accountForRail.provider_ref;
          blockchainAccountId = accountForRail.id;
          this.logger.log(`Using existing blockchain account for rails ${targetRail}: ${blockChainAccountProviderRef}`);
        } else {
          // No account exists for this rails, so create one
          const account = await this.createBlockchainAccount(user, targetRail);
          blockChainAccountProviderRef = account.provider_ref;
          // Get the created account from database to get the internal ID
          const createdAccount = await this.blockchainAccountsService.getUserAccounts(user.id);
          const newAccount = createdAccount.find((a) => a.rails === targetRail);
          blockchainAccountId = newAccount?.id || '';
          this.logger.log(`Created new blockchain account for rails ${targetRail}: ${blockChainAccountProviderRef}`);
        }
      }

      // confirm the main assets dont exist before trying to create it
      const requestedAssetIds = params.asset_ids.map((a) => a.asset_id);

      const existingWallets = await this.blockchainWalletRepository.findActiveWalletsByUserIdAndAssets(
        user.id,
        requestedAssetIds,
        targetRail,
      );

      const existingAssetIds = new Set(existingWallets.map((w) => w.asset));

      // get assets to create
      const assetIdsToCreate = params.asset_ids.filter((a) => !existingAssetIds.has(a.asset_id));

      // return nothing if nothing to create
      if (assetIdsToCreate.length === 0) {
        this.logger.log(`All requested wallets already exist for user ${user.id}: ${requestedAssetIds.join(', ')}`);
        return { successful: [], failed: [] };
      }

      const createParams: ICreateWalletParams = {
        provider_account_ref: blockChainAccountProviderRef,
        asset_ids: assetIdsToCreate,
        user_id: user.id,
        idempotencyKey: idempotencyKey,
      };

      const wallet = await this.blockchainWaasAdapter.createWallet(createParams);

      if (wallet.successful && wallet.successful.length > 0) {
        // Get the current provider from config/env
        const currentProvider = (EnvironmentService.getValues().default_blockchain_waas_adapter || '').toLowerCase();

        const providerEnum = (Object.values(BlockchainWalletProvider) as string[]).includes(currentProvider)
          ? (currentProvider as BlockchainWalletProvider)
          : BlockchainWalletProvider.FIREBLOCKS;

        const walletRecords = wallet.successful.map((w) => {
          const assetObj = params.asset_ids.find((a) => a.asset_id === w.asset_id);
          return {
            user_id: user.id,
            blockchain_account_id: blockchainAccountId,
            provider_account_ref: w.provider_account_ref,
            provider: providerEnum,
            asset: w.asset_id,
            base_asset: assetObj?.base_asset_id || '',
            address: w.address,
            status: BlockchainWalletStatus.ACTIVE,
            balance: '0',
            name: assetObj?.name,
            decimal: assetObj?.decimal,
            network: assetObj?.type,
            is_visible: targetRail === 'crypto',
          };
        });

        await this.blockchainWalletRepository.batchCreate(walletRecords);
      }

      this.logger.log(`Wallet created successfully for assets ${params.asset_ids}`);

      return wallet;
    } catch (error) {
      this.logger.error(`Error creating wallet: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get all active blockchain wallets for a user
   *
   * This method retrieves all active blockchain wallets associated with a user.
   * Active wallets are those that have been successfully created and are available
   * for transactions. Each wallet represents a specific asset (USDC, USDT, etc.)
   * that the user can hold and transact with.
   *
   * @param user The user object whose wallets to retrieve
   * @returns Promise<IBlockchainWallet[]> Array of active blockchain wallets with their
   *          balances, asset information, and status
   * @throws Error if no active wallets found for the user
   *
   * @example
   * const wallets = await blockchainWalletService.getUserAccount(user);
   * // Returns: [{ id: 'wallet_1', asset: 'usdc', balance: '100.50', status: 'active' }, ...]
   */
  async getUserAccount(user: IUser): Promise<IBlockchainWallet[]> {
    try {
      // Find all active blockchain wallets for the user (only visible)
      const wallets = await this.blockchainWalletRepository.findAllActiveWalletsByUserId(user.id, false);

      if (!wallets || wallets.length === 0) {
        this.logger.log(`No active blockchain wallets found for user ${user.id}`);
        return [];
      }

      this.logger.log(`Found ${wallets.length} active blockchain wallets for user ${user.id}`);

      // Get stablecoin configurations to add image URLs
      const stableCoins = StableCoinsService.getSupportedStableCoins();
      const stableCoinMap = new Map(stableCoins.map((coin) => [coin.id, coin]));

      // Add image URLs to wallets
      const walletsWithImages = wallets.map((wallet) => {
        const stableCoin = stableCoinMap.get(wallet.asset);
        return {
          ...wallet,
          image_url: stableCoin?.imageUrl || null,
        };
      });

      return walletsWithImages;
    } catch (error) {
      this.logger.error(`Error fetching vault account: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get the balance of a specific asset in a user's blockchain wallet
   *
   * This method fetches the current balance of a specific asset (e.g., USDC, USDT)
   * from the user's blockchain wallet. The balance is retrieved from the blockchain
   * provider in real-time to ensure accuracy.
   *
   * @param user The user object whose balance to check
   * @param assetId The asset ID to get balance for (e.g., 'usdc', 'usdt')
   * @returns Promise<IBlockchainWallet> The wallet asset with current balance, asset details,
   *          and last updated timestamp
   * @throws Error if wallet not found for user and asset, or blockchain provider error
   *
   * @example
   * const balance = await blockchainWalletService.getWalletBalance(user, 'usdc');
   * // Returns: { asset_id: 'usdc', balance: '100.50', symbol: 'USDC', last_updated: '2024-01-01T00:00:00Z' }
   */
  async getWalletBalance(user: IUser, assetId: string): Promise<IBlockchainWallet> {
    try {
      const wallet = await this.blockchainWalletRepository.findActiveWalletByUserIdAndAsset(user.id, assetId, false);

      if (!wallet) {
        throw new NotFoundException('No active blockchain wallet found for user and asset');
      }

      this.logger.log(`Returning asset balance from DB for user ID: ${user.id}, asset ID: ${assetId}`);

      // Get stablecoin configuration to add image URL
      const stableCoins = StableCoinsService.getSupportedStableCoins();
      const stableCoin = stableCoins.find((coin) => coin.id === wallet.asset);

      return {
        ...wallet,
        image_url: stableCoin?.imageUrl || null,
      };
    } catch (error) {
      this.logger.error(`Error fetching asset balance: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Estimate fees for blockchain transactions
   *
   * This method calculates the estimated fees for blockchain transactions before execution.
   * It supports both internal transfers (between users) and external transfers (to blockchain addresses).
   * Fee estimation helps users understand the total cost of their transaction including network fees.
   *
   * For internal transfers, both source and destination users must have wallets for the same asset.
   * For external transfers, a valid destination address is required.
   *
   * @param user The user initiating the transaction
   * @param params Fee estimation parameters including type (internal/external), amount, asset,
   *               destination details, and fee level preference
   * @returns Promise<IFeeEstimateResponse> Fee estimate with breakdown of network fees,
   *          provider fees, and total cost
   * @throws Error if source/destination wallets not found, invalid parameters, or estimation fails
   *
   * @example
   * const feeEstimate = await blockchainWalletService.estimateFee(user, {
   *   type: 'internal',
   *   assetId: 'usdc',
   *   amount: '100',
   *   destinationUsername: 'user_456',
   *   feeLevel: 'medium'
   * });
   * // Returns: { network_fee: '0.001', provider_fee: '0.50', total_fee: '0.501' }
   */
  async estimateFee(user: IUser, params: IEstimateFeeParams): Promise<IFeeEstimateResponse> {
    this.logger.log(`Estimating fee for user ${user.id} and asset ${params.asset_id}`);
    const sourceWallet = await this.blockchainWalletRepository.findActiveWalletByUserIdAndAsset(
      user.id,
      params.asset_id,
      false,
    );

    if (!sourceWallet) {
      throw new NotFoundException('Source wallet not found for the given user and asset');
    }

    let assetAmount: AssetAmount;

    try {
      assetAmount = AssetAmount.fromDecimal(params.asset_id, params.amount.toString(), sourceWallet.decimal);
    } catch (e) {
      this.logger.log(e);
      throw new BadRequestException('Amount must be a valid positive number');
    }

    if (assetAmount.lt(AssetAmount.zero(params.asset_id, sourceWallet.decimal))) {
      throw new BadRequestException('Amount must be a positive number');
    }

    if (params.type === 'internal') {
      if (!params.peer_username) {
        throw new BadRequestException('peer_username is required for internal fee estimation');
      }

      // get destination user id using username
      const destinationUser = await this.userRepository.findActiveByUsername(params.peer_username);

      if (!destinationUser) {
        throw new BadRequestException('Username not found');
      }

      const destinationWallet = await this.blockchainWalletRepository.findActiveWalletByUserIdAndAsset(
        destinationUser.id,
        params.asset_id,
        false,
      );

      if (!sourceWallet || !destinationWallet) {
        throw new BadRequestException('Source or destination wallet not found for the given user(s) and asset');
      }

      return await this.estimateInternalTransferFee({
        assetId: params.asset_id,
        amount: assetAmount.toDb(),
        sourceVaultId: sourceWallet.provider_account_ref,
        destinationVaultId: destinationWallet.provider_account_ref,
        feeLevel: params.fee_level,
        idempotencyKey: params.idempotencyKey,
      });
    } else if (params.type === 'external') {
      if (!params.peer_address) {
        throw new BadRequestException('peer_address is required for external fee estimation');
      }

      if (!sourceWallet) {
        throw new BadRequestException('Source wallet not found for the given user and asset');
      }

      return await this.estimateExternalTransactionFee({
        assetId: params.asset_id,
        amount: assetAmount.toDb(),
        sourceVaultId: sourceWallet.provider_account_ref,
        destinationAddress: params.peer_address,
        destinationTag: params.peer_tag,
        feeLevel: params.fee_level,
        idempotencyKey: params.idempotencyKey,
      });
    } else {
      throw new BadRequestException('Invalid fee estimation type');
    }
  }

  /**
   * Initiate a blockchain transaction (internal or external)
   *
   * This method initiates a blockchain transaction between users (internal) or to external
   * addresses (external). The transaction is processed through the blockchain provider
   * and can take time to confirm depending on network conditions.
   *
   * Internal transfers are instant and free, while external transfers incur network fees
   * and may take several minutes to confirm on the blockchain.
   *
   * @param user The user initiating the transaction
   * @param params Transaction parameters including type, amount, asset, destination details,
   *               and optional notes
   * @returns Promise<ITransferResponse> The transfer response with transaction ID, status,
   *          and provider reference
   * @throws Error if source/destination wallets not found, insufficient balance, or transfer fails
   *
   * @example
   * const transfer = await blockchainWalletService.initiateTransaction(user, {
   *   type: 'external',
   *   assetId: 'usdc',
   *   amount: '50',
   *   destinationAddress: '0x123...',
   *   note: 'Payment for services'
   * });
   * // Returns: { transactionId: 'tx_123', status: 'pending', externalTxId: '0xabc...' }
   */
  async initiateTransaction(user: IUser, params: IInitiateTransactionParams): Promise<ITransferResponse> {
    const sourceWallet = await this.blockchainWalletRepository.findActiveWalletByUserIdAndAsset(
      user.id,
      params.asset_id,
      false,
    );

    if (!sourceWallet) {
      throw new NotFoundException('Source wallet not found for the given user(s) and asset');
    }

    // Check for any pending transactions for this user
    const pendingTx = await this.blockchainWalletTransactionRepository.findFirstPendingByUserId(sourceWallet.id);

    if (pendingTx) {
      throw new BadRequestException(
        'You have a pending transaction. Please wait until it is completed before initiating a new one.',
      );
    }

    let destinationWallet: BlockchainWalletModel;
    let destinationUser: UserModel;

    // first level param validation for internal transaction
    if (params.type === 'internal') {
      if (!params.peer_username) {
        throw new BadRequestException('destinationUsername is required for internal transfer');
      }

      destinationUser = await this.userRepository.findActiveByUsername(params.peer_username);

      if (!destinationUser) {
        throw new BadRequestException('Username not found');
      }

      // Validate that source and destination users are not the same
      if (user.id === destinationUser.id) {
        throw new BadRequestException('Source and destination users cannot be the same for internal transfers');
      }

      destinationWallet = await this.blockchainWalletRepository.findActiveWalletByUserIdAndAsset(
        destinationUser.id,
        params.asset_id,
        false,
      );

      if (!destinationWallet) {
        throw new NotFoundException('Destination wallet not found for the given user(s) and asset');
      }
    }

    let transactionProviderRef: ITransferResponse;
    let blockchainWalletTransaction: BlockchainWalletTransactionModel;

    try {
      const debitResult = await this.debitWallet(sourceWallet.id, params.amount, params.asset_id, {
        description: params.note,
        transaction_type:
          params.type === 'internal'
            ? BlockchainWalletTransactionType.TRANSFER_OUT
            : BlockchainWalletTransactionType.WITHDRAWAL,
        destination: params.type === 'internal' ? destinationWallet.id : params.peer_address,
        transaction_scope: params.type === 'internal' ? TransactionScope.INTERNAL : TransactionScope.EXTERNAL,
      });

      blockchainWalletTransaction = debitResult.blockchainWalletTransaction;

      if (params.type === 'internal') {
        transactionProviderRef = await this.internalTransfer({
          assetId: params.asset_id,
          amount: String(params.amount),
          sourceVaultId: sourceWallet.provider_account_ref,
          destinationVaultId: destinationWallet.provider_account_ref,
          note: params.note,
          idempotencyKey: params.idempotencyKey,
          externalTxId: blockchainWalletTransaction.id,
        });
      } else if (params.type === 'external') {
        if (!params.peer_address) {
          throw new BadRequestException('peer_address is required for external transfer');
        }

        // Validate that source and destination addresses are not the same
        if (sourceWallet.address === params.peer_address) {
          throw new BadRequestException('Source and destination addresses cannot be the same for external transfers');
        }

        transactionProviderRef = await this.externalTransfer({
          assetId: params.asset_id,
          amount: String(params.amount),
          sourceVaultId: sourceWallet.provider_account_ref,
          destinationAddress: params.peer_address,
          destinationTag: params.peer_tag,
          note: params.note,
          idempotencyKey: params.idempotencyKey,
          externalTxId: blockchainWalletTransaction.id,
        });
      } else {
        throw new BadRequestException('Invalid transaction type');
      }

      // Update the blockchain wallet transaction with the provider reference before returning
      if (blockchainWalletTransaction && transactionProviderRef?.transactionId) {
        await this.blockchainWalletTransactionRepository.update(blockchainWalletTransaction.id, {
          provider_reference: transactionProviderRef.transactionId,
        });
      }

      return {
        transactionId: blockchainWalletTransaction.id,
        status: transactionProviderRef.status,
        externalTxId: transactionProviderRef.transactionId,
        systemMessages: transactionProviderRef.systemMessages,
      };
    } catch (error) {
      // Revert the debit if it was created
      if (blockchainWalletTransaction && sourceWallet) {
        try {
          await this.revertWalletDebit(
            user.id,
            sourceWallet.id,
            params.amount,
            params.asset_id,
            blockchainWalletTransaction,
            {
              description: 'Revert failed transaction',
              provider_metadata: undefined,
              source: undefined,
              destination: params.type === 'internal' ? destinationWallet.id : params.peer_address,
              transaction_type:
                params.type === 'internal'
                  ? BlockchainWalletTransactionType.TRANSFER_OUT
                  : BlockchainWalletTransactionType.WITHDRAWAL,
              transaction_scope: params.type === 'internal' ? TransactionScope.INTERNAL : TransactionScope.EXTERNAL,
            },
          );
        } catch (revertError) {
          this.logger.error(`Failed to revert transaction after error: ${revertError.message}`, revertError.stack);
        }
      }
      throw error;
    }
  }

  /**
   * Todo: temporary method to send funds from the master Fireblocks vault to an external address.
   * Send funds from the master Fireblocks vault to an external address.
   *
   * This helper is intended for non-user-specific transfers (e.g. test or operational flows)
   * where funds are moved from a predefined vault to a destination address.
   */
  async sendFromMasterVaultToAddress(params: {
    amount: number;
    destinationAddress: string;
    note?: string;
    idempotencyKey: string;
    assetId?: string;
    destinationTag?: string;
    externalTxId?: string;
  }): Promise<ITransferResponse> {
    return this.externalTransfer({
      assetId: params.assetId ?? FIREBLOCKS_ASSET_ID,
      amount: String(params.amount),
      sourceVaultId: FIREBLOCKS_MASTER_VAULT_ID,
      destinationAddress: params.destinationAddress,
      destinationTag: params.destinationTag,
      note: params.note,
      idempotencyKey: params.idempotencyKey,
      externalTxId: params.externalTxId,
    });
  }

  /**
   * Fund a user's blockchain wallet with native gas from the gas station
   * This sends native asset from GAS_STATION to the user's vault account for the same network
   */
  public async fundWalletFromGasStation(
    user: IUser,
    params: { wallet_id: string; native_asset_id?: string; amount: number; note?: string; idempotencyKey?: string },
  ): Promise<{ transactionId: string; status: string; externalTxId?: string }> {
    const wallet = (await this.blockchainWalletRepository.findUserWalletById(
      user.id,
      params.wallet_id,
    )) as BlockchainWalletModel;

    if (!wallet) {
      throw new NotFoundException('Wallet not found or does not belong to user');
    }

    // Prevent zero/negative amounts
    if (!params.amount || params.amount <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    // Use provided native_asset_id or get default from stablecoin config
    let nativeAssetId = params.native_asset_id;
    if (!nativeAssetId) {
      const defaultStableCoin = StableCoinsService.getDefaultStableCoin('fireblocks');
      if (!defaultStableCoin) {
        throw new BadRequestException('Unable to determine native asset for gas funding');
      }
      nativeAssetId = defaultStableCoin.nativeAsset;
    }

    // Create gas fund transaction record in pending status
    const gasFundTransaction = await this.blockchainGasFundTransactionService.create({
      user_id: user.id,
      blockchain_wallet_id: wallet.id,
      native_asset_id: nativeAssetId,
      amount: String(params.amount),
      status: TransactionStatus.PENDING,
      idempotency_key: params.idempotencyKey,
      metadata: {
        source: 'gas_station',
        note: params.note,
      },
    });

    this.logger.log(`Created gas fund transaction ${gasFundTransaction.id} in pending status`);

    try {
      // Create a blockchain provider transaction: GAS_STATION -> VAULT_ACCOUNT
      const createParams: ICreateTransactionParams = {
        operation: 'TRANSFER',
        assetId: nativeAssetId,
        amount: String(params.amount),
        source: {
          type: 'GAS_STATION',
        },
        destination: {
          type: 'VAULT_ACCOUNT',
          id: wallet.provider_account_ref,
        },
        note: params.note,
        externalTxId: gasFundTransaction.id,
        idempotencyKey: params.idempotencyKey,
        feeLevel: 'HIGH',
      };

      const tx = await this.blockchainWaasAdapter.createTransaction(createParams);

      // Update gas fund transaction with provider reference
      await this.blockchainGasFundTransactionService.updateProviderReference(gasFundTransaction.id, tx.id);

      this.logger.log(`Updated gas fund transaction ${gasFundTransaction.id} with provider reference ${tx.id}`);

      return {
        transactionId: tx.id,
        status: tx.status,
        externalTxId: tx.externalTxId,
      };
    } catch (error) {
      // Mark gas fund transaction as failed if blockchain transaction fails
      await this.blockchainGasFundTransactionService.markAsFailed(
        gasFundTransaction.id,
        error.message || 'Blockchain transaction failed',
      );

      this.logger.error(`Gas fund transaction ${gasFundTransaction.id} failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Debits a blockchain wallet and creates a pending transaction.
   * @param userId - The user ID
   * @param walletId - The wallet ID
   * @param amount - The amount to debit (decimal)
   * @param asset - The asset symbol
   * @param metadata - Additional transaction metadata
   * @throws NotFoundException, BadRequestException
   */
  public async debitWallet(
    walletId: string, // Todo: pass in the wallet object instead of the id
    amount: number,
    asset: string,
    metadata: BlockchainWalletTransactionMetadata = {},
  ) {
    const lockKey = `blockchain-wallet:${walletId}:debit`;
    return await this.lockerService.withLock(
      lockKey,
      async () => {
        const wallet = await this.blockchainWalletRepository.findById(walletId);

        if (!wallet) {
          this.logger.warn(`Wallet not found: ${walletId}`);
          throw new NotFoundException(`Blockchain wallet with ID ${walletId} not found`);
        }

        if (wallet.asset !== asset) {
          this.logger.warn(`Asset mismatch for wallet ${walletId}: expected ${wallet.asset}, got ${asset}`);
          throw new BadRequestException('Asset does not match wallet asset');
        }

        // Use AssetAmount for amount validation and arithmetic
        let debitAmount: AssetAmount;

        try {
          debitAmount = AssetAmount.fromDecimal(wallet.asset, amount.toString(), wallet.decimal);
        } catch (e) {
          console.error(e);
          this.logger.warn(`Invalid debit amount: ${amount} for wallet ${walletId}`);
          throw new BadRequestException('Amount must be a valid positive number');
        }

        if (debitAmount.lt(AssetAmount.zero(wallet.asset, wallet.decimal))) {
          this.logger.warn(`Invalid debit amount: ${amount} for wallet ${walletId}`);
          throw new BadRequestException('Amount must be a positive number');
        }

        const balanceBefore = AssetAmount.fromDb(wallet.asset, wallet.balance, wallet.decimal);
        const balanceAfter = balanceBefore.sub(debitAmount);

        if (balanceAfter.lt(AssetAmount.zero(wallet.asset, wallet.decimal))) {
          this.logger.warn(
            `Insufficient balance for wallet ${walletId}: requested ${amount}, available ${balanceBefore.toString()}`,
          );
          throw new BadRequestException('Insufficient balance for this transaction');
        }

        const transactionType = metadata.transaction_type || BlockchainWalletTransactionType.WITHDRAWAL;
        const idempotencyKey = metadata.idempotency_key || UtilsService.generateIdempotencyKey();

        return await this.blockchainWalletRepository.transaction(async (trx) => {
          // Create the blockchain wallet transaction first
          const blockchainWalletTransactionData = this.buildBlockchainWalletDebitTransactionData({
            walletId,
            transactionType,
            debitAmount,
            balanceBefore,
            balanceAfter,
            asset,
            metadata,
            idempotencyKey: idempotencyKey,
            type: 'debit',
          });

          const blockchainWalletTransaction = await this.blockchainWalletTransactionRepository.create(
            blockchainWalletTransactionData,
            trx,
          );

          // Now update the wallet balance
          const updatedWallet = await this.blockchainWalletRepository.update(
            walletId,
            { balance: balanceAfter.toDb() },
            { trx },
          );

          this.logger.log(`Debited wallet ${walletId} by ${amount} ${asset}, tx: ${blockchainWalletTransaction.id}`);

          // Emit balance change event for SSE
          this.eventEmitterService.emit(EventEmitterEventsEnum.WALLET_BALANCE_CHANGED, {
            userId: wallet.user_id,
            walletType: 'blockchain',
            walletId: walletId,
            currency: wallet.asset,
            balance: balanceAfter.toDb().toString(),
            previousBalance: balanceBefore.toDb().toString(),
            transactionId: blockchainWalletTransaction.id,
            timestamp: new Date(),
            wallet: updatedWallet,
          });

          return { blockchainWalletTransaction };
        });
      },
      { ttl: 30000, retryCount: 5, retryDelay: 500 },
    );
  }

  /**
   * Revert a debit on a blockchain wallet: restores the user's balance and marks the transactions as failed.
   *
   * @param userId The user ID who owns the wallet
   * @param walletId The blockchain wallet ID to revert
   * @param amount The amount to revert (must be a positive number)
   * @param asset The asset/currency being reverted (e.g., 'usdc', 'usdt')
   * @param transaction The main transaction to revert
   * @param blockchainWalletTransaction The blockchain wallet transaction to revert
   * @param metadata Additional metadata for the revert
   * @returns Promise<{wallet, blockchainWalletTransaction}>
   * @throws NotFoundException, BadRequestException
   */
  public async revertWalletDebit(
    userId: string, // Todo: pass in the user object instead of the id
    walletId: string, // Todo: pass in the wallet object instead of the id
    amount: number,
    asset: string,
    blockchainWalletTransaction: BlockchainWalletTransactionModel,
    metadata: BlockchainWalletTransactionMetadata = {},
  ) {
    const lockKey = `blockchain-wallet:${walletId}:revert-debit`;
    return await this.lockerService.withLock(
      lockKey,
      async () => {
        const wallet = await this.blockchainWalletRepository.findById(walletId);

        if (!wallet) {
          this.logger.warn(`Wallet not found: ${walletId}`);
          throw new NotFoundException(`Blockchain wallet with ID ${walletId} not found`);
        }

        const blockchainWalletTrx = await this.blockchainWalletTransactionRepository.findById(
          blockchainWalletTransaction.id,
        );

        if (!blockchainWalletTrx) {
          this.logger.warn(`Blockchain wallet transaction not found: ${blockchainWalletTransaction.id}`);
          throw new NotFoundException('Blockchain wallet transaction not found');
        }
        // Use AssetAmount for amount validation and arithmetic
        let revertAmount: AssetAmount;

        try {
          revertAmount = AssetAmount.fromDecimal(wallet.asset, amount.toString(), wallet.decimal);
        } catch (e) {
          console.error(e);
          this.logger.warn(`Invalid revert amount: ${amount} for wallet ${walletId}`);
          throw new BadRequestException('Amount must be a valid positive number');
        }

        if (revertAmount.lt(AssetAmount.zero(wallet.asset, wallet.decimal))) {
          this.logger.warn(`Invalid revert amount: ${amount} for wallet ${walletId}`);
          throw new BadRequestException('Amount must be a positive number');
        }

        const trxAmount = AssetAmount.fromDb(wallet.asset, blockchainWalletTrx.amount, wallet.decimal);

        if (trxAmount.toDb() !== revertAmount.toDb()) {
          this.logger.warn(`Amount mismatch: trx=${trxAmount.toDb()}, revert=${revertAmount.toDb()}`);
          throw new BadRequestException('Transaction amount does not match revert amount');
        }

        if (blockchainWalletTrx.status !== TransactionStatus.PENDING) {
          this.logger.warn(`Transaction not pending: ${blockchainWalletTrx.status}`);
          throw new BadRequestException('Transaction is not pending');
        }

        const balanceBefore = AssetAmount.fromDb(wallet.asset, wallet.balance, wallet.decimal);
        const balanceAfter = balanceBefore.add(revertAmount);

        // Create both transactions within the same transaction scope
        const result = await this.blockchainWalletRepository.transaction(async (trx) => {
          const updatedWallet = await this.blockchainWalletRepository.update(
            walletId,
            { balance: balanceAfter.toDb() },
            { trx },
          );

          // Only update allowed columns
          const updateData: Partial<BlockchainWalletTransactionModel> = {
            status: TransactionStatus.FAILED,
            description: metadata.description,
            provider_reference: metadata.provider_reference,
            tx_hash: metadata.tx_hash,
            network_fee: metadata.network_fee,
            failure_reason: metadata.failure_reason,
          };

          if (metadata.transaction_type === BlockchainWalletTransactionType.TRANSFER_OUT) {
            updateData.peer_wallet_id = metadata.destination;
          } else if (metadata.transaction_type === BlockchainWalletTransactionType.WITHDRAWAL) {
            updateData.peer_wallet_address = metadata.destination;
          }

          // Remove undefined values
          Object.keys(updateData).forEach((key) => updateData[key] === undefined && delete updateData[key]);

          await this.blockchainWalletTransactionRepository.update(blockchainWalletTransaction.id, updateData, { trx });

          // Create a record on the main transaction db
          const transaction = await this.transactionRepository.create(
            {
              user_id: userId,
              reference: blockchainWalletTransaction.id,
              asset,
              amount: Number(revertAmount.toBigInt()),
              balance_before: Number(balanceBefore.toBigInt()),
              balance_after: Number(balanceAfter.toBigInt()),
              transaction_type: this.mapBlockchainTypeToTransactionType(metadata.transaction_type),
              category: TransactionCategory.BLOCKCHAIN,
              status: TransactionStatus.FAILED,
              description: metadata.description,
              failure_reason: metadata.failure_reason,
              transaction_scope: metadata.transaction_scope,
            },
            trx,
          );

          // Note: main_transaction_id will be updated after transaction is committed

          this.logger.log(`Reverted debit of ${revertAmount.toDb()} ${asset} for wallet ${walletId}`);

          // Emit balance change event for SSE
          this.eventEmitterService.emit(EventEmitterEventsEnum.WALLET_BALANCE_CHANGED, {
            userId: wallet.user_id,
            walletType: 'blockchain',
            walletId: walletId,
            currency: wallet.asset,
            balance: balanceAfter.toDb().toString(),
            previousBalance: balanceBefore.toDb().toString(),
            transactionId: blockchainWalletTransaction.id,
            timestamp: new Date(),
            wallet: updatedWallet,
          });

          return { wallet: updatedWallet, blockchainWalletTransaction, mainTransaction: transaction };
        });

        // After the transaction is committed, update the main_transaction_id
        // This ensures the main transaction is committed and available for foreign key references
        await this.blockchainWalletTransactionRepository.update(blockchainWalletTransaction.id, {
          main_transaction_id: result.mainTransaction.id,
        });

        this.logger.log(
          `Updated blockchain wallet transaction ${blockchainWalletTransaction.id} with main_transaction_id: ${result.mainTransaction.id}`,
        );

        return { wallet: result.wallet, blockchainWalletTransaction: result.blockchainWalletTransaction };
      },
      { ttl: 30000, retryCount: 5, retryDelay: 500 },
    );
  }

  /**
   * Credits a blockchain wallet, creates a COMPLETED transaction,
   * updates the balance, and creates the main transaction record.
   * @param walletId - The wallet ID
   * @param txData - Partial<IBlockchainWalletTransaction> (must include amount, asset, transaction_type)
   * @throws NotFoundException, BadRequestException
   */
  public async fundWallet(walletId: string, txData: Partial<IBlockchainWalletTransaction>) {
    // Todo: pass in the wallet object instead of the id
    const lockKey = `blockchain-wallet:${walletId}:fund`;
    return await this.lockerService.withLock(
      lockKey,
      async () => {
        const wallet = (await this.blockchainWalletRepository.findById(walletId)) as BlockchainWalletModel;

        if (!wallet) {
          this.logger.warn(`Wallet not found: ${walletId}`);
          throw new NotFoundException(`Blockchain wallet with ID ${walletId} not found`);
        }

        // Validate required fields
        if (!txData.amount || !txData.asset || !txData.transaction_type) {
          throw new BadRequestException('amount, asset, and transaction_type are required in txData');
        }

        if (wallet.asset !== txData.asset) {
          this.logger.warn(`Asset mismatch for wallet ${walletId}: expected ${wallet.asset}, got ${txData.asset}`);
          throw new BadRequestException('Asset does not match wallet asset');
        }

        // Use AssetAmount for amount validation and arithmetic
        let creditAmount: AssetAmount;

        try {
          creditAmount = AssetAmount.fromDecimal(wallet.asset, txData.amount.toString(), wallet.decimal);
        } catch (e) {
          console.error(e);
          this.logger.warn(`Invalid credit amount: ${txData.amount} for wallet ${walletId}`);
          throw new BadRequestException('Amount must be a valid positive number');
        }

        if (!creditAmount.gt(AssetAmount.zero(wallet.asset, wallet.decimal))) {
          this.logger.warn(`Invalid credit amount: ${txData.amount} for wallet ${walletId}`);
          throw new BadRequestException('Amount must be a positive number');
        }

        const balanceBefore = AssetAmount.fromDb(wallet.asset, wallet.balance, wallet.decimal);
        const balanceAfter = balanceBefore.add(creditAmount);

        // Create both transactions within the same transaction scope
        const result = await this.blockchainWalletRepository.transaction(async (trx) => {
          const blockchainWalletTransactionData = this.buildBlockchainWalletFundTransactionData({
            wallet,
            txData,
            creditAmount,
            balanceBefore,
            balanceAfter,
            destination: txData.peer_wallet_address || txData.peer_wallet_id || '',
            transaction_scope: txData.peer_wallet_address ? TransactionScope.EXTERNAL : TransactionScope.INTERNAL,
          });

          const blockchainWalletTransaction = await this.blockchainWalletTransactionRepository.create(
            blockchainWalletTransactionData,
            trx,
          );

          const transaction = await this.transactionRepository.create(
            {
              user_id: wallet.user_id,
              reference: blockchainWalletTransaction.id,
              asset: wallet.asset,
              amount: Number(creditAmount.toBigInt()),
              balance_before: Number(balanceBefore.toBigInt()),
              balance_after: Number(balanceAfter.toBigInt()),
              transaction_type: this.mapBlockchainTypeToTransactionType(txData.transaction_type!),
              category: TransactionCategory.BLOCKCHAIN,
              transaction_scope: txData.peer_wallet_address ? TransactionScope.EXTERNAL : TransactionScope.INTERNAL,
              status: TransactionStatus.COMPLETED,
              description: txData.description,
              failure_reason: undefined,
            },
            trx,
          );

          // Update the blockchain wallet transaction with status (but NOT main_transaction_id yet)
          await this.blockchainWalletTransactionRepository.update(
            blockchainWalletTransaction.id,
            {
              status: TransactionStatus.COMPLETED,
            },
            { trx },
          );

          // Update the wallet balance
          const updatedWallet = await this.blockchainWalletRepository.update(
            walletId,
            { balance: balanceAfter.toDb() },
            { trx },
          );

          this.logger.log(
            `Credited wallet ${walletId} by ${txData.amount} ${wallet.asset}, tx: ${blockchainWalletTransaction.id}`,
          );

          // Emit balance change event for SSE
          this.eventEmitterService.emit(EventEmitterEventsEnum.WALLET_BALANCE_CHANGED, {
            userId: wallet.user_id,
            walletType: 'blockchain',
            walletId: walletId,
            currency: wallet.asset,
            balance: balanceAfter.toDb().toString(),
            previousBalance: balanceBefore.toDb().toString(),
            transactionId: blockchainWalletTransaction.id,
            timestamp: new Date(),
            wallet: updatedWallet,
          });

          return { blockchainWalletTransaction, wallet: updatedWallet, mainTransaction: transaction };
        });

        // After the transaction is committed, update the main_transaction_id
        // This ensures the main transaction is committed and available for foreign key references
        await this.blockchainWalletTransactionRepository.update(result.blockchainWalletTransaction.id, {
          main_transaction_id: result.mainTransaction.id,
        });

        this.logger.log(
          `Updated blockchain wallet transaction ${result.blockchainWalletTransaction.id} with main_transaction_id: ${result.mainTransaction.id}`,
        );

        // Create in-app notification for credited funds
        try {
          const amountStr = creditAmount.toString();
          await this.inAppNotificationService.createNotification({
            user_id: wallet.user_id,
            type: IN_APP_NOTIFICATION_TYPE.CREDIT,
            title: 'Funds received',
            message: `You received ${amountStr} ${wallet.asset} in your blockchain wallet`,
            metadata: {
              transactionId: result.mainTransaction.id,
              blockchainWalletTransactionId: result.blockchainWalletTransaction.id,
              amount: amountStr,
              asset: wallet.asset,
              scope: txData.peer_wallet_address ? 'external' : 'internal',
            },
          });
        } catch (e) {
          this.logger.error(`Failed to create credit notification: ${(e as Error).message}`);
        }

        return { blockchainWalletTransaction: result.blockchainWalletTransaction, wallet: result.wallet };
      },
      { ttl: 30000, retryCount: 5, retryDelay: 500 },
    );
  }

  /**
   * Process incoming blockchain webhooks
   *
   * This method processes webhooks received from the blockchain provider about transaction
   * status updates, completions, and failures. It validates the webhook signature for
   * security and routes the webhook to appropriate handlers based on the event type.
   *
   * Webhooks are crucial for keeping transaction status synchronized between the blockchain
   * provider and our system.
   *
   * @param payload The raw webhook payload as a string
   * @param signature The webhook signature for verification
   * @param timestamp The webhook timestamp for validation
   * @param version The webhook version ('v1' or 'v2') for proper parsing
   * @returns Promise<IBlockchainWebhookResponse> Webhook processing result with success
   *          status and transaction details
   * @throws Error if signature verification fails, invalid payload, or processing fails
   *
   * @example
   * const result = await blockchainWalletService.processWebhook(
   *   '{"type":"TRANSACTION_COMPLETED","data":{"id":"tx_123"}}',
   *   'signature_abc...',
   *   '1640995200',
   *   'v2'
   * );
   * // Returns: { success: true, message: 'Webhook processed successfully', transactionId: 'tx_123' }
   */
  async processWebhook(
    payload: string,
    signature: string,
    timestamp: string,
    version: 'v1' | 'v2' = 'v2',
  ): Promise<IBlockchainWebhookResponse> {
    try {
      this.logger.log(`Processing blockchain webhook (${version})`);

      const webhookData = await this.blockchainWaasAdapter.handleWebhook(payload, signature, timestamp, version);

      // Log based on webhook data type
      if (this.isBlockchainTransactionWebhookData(webhookData.data)) {
        this.logger.log(`Webhook processed successfully for transaction: ${webhookData.data.id}`);

        await this.handleTransactionWebhookByType(webhookData);

        return {
          success: true,
          message: 'Webhook processed successfully',
          transactionId: webhookData.data.id,
          status: webhookData.data.status,
        };
      } else if (this.isVaultAccountWebhookData(webhookData.data)) {
        this.logger.log(`Webhook processed successfully for vault account: ${webhookData.data.id}`);
        return {
          success: true,
          message: 'Vault account webhook processed successfully',
          transactionId: webhookData.data.id,
        };
      } else if (this.isVaultAccountAssetWebhookData(webhookData.data)) {
        this.logger.log(`Webhook processed successfully for vault account asset: ${webhookData.data.accountId}`);
        return {
          success: true,
          message: 'Vault account asset webhook processed successfully',
          transactionId: webhookData.data.accountId,
        };
      }

      return {
        success: true,
        message: 'Webhook processed successfully',
      };
    } catch (error) {
      this.logger.error(`Error processing webhook: ${error.message}`, error.stack);
      throw error;
    }
  }

  async resendWebhook(params?: IBlockchainResendWebhookRequest): Promise<IBlockchainResendWebhookResponse> {
    try {
      if (params?.txId) {
        this.logger.log(`Resending webhooks for transaction ${params.txId}`);
      } else {
        this.logger.log(`Resending all failed webhooks`);
      }

      const result = await this.blockchainWaasAdapter.resendWebhook(params);

      if (params?.txId) {
        this.logger.log(`Webhook resend completed for transaction ${params.txId}`);
      } else {
        this.logger.log(`Webhook resend completed for all failed webhooks`);
      }

      return result;
    } catch (error) {
      const errorContext = params?.txId ? `for transaction ${params.txId}` : 'for all failed webhooks';
      this.logger.error(`Error resending webhook ${errorContext}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Handle webhook data based on its type
   *
   * This private method routes webhook data to appropriate handlers based on the event type.
   * It supports various webhook types including transaction status updates, completions,
   * failures, and creations. Each type triggers different business logic and database updates.
   *
   * @param webhookData The webhook payload data containing type and transaction information
   * @returns Promise<void>
   *
   * @private
   */
  private async handleTransactionWebhookByType(webhookData: IBlockchainWebhookPayload): Promise<void> {
    const { type, data } = webhookData;

    switch (type) {
      case 'TRANSACTION_STATUS_UPDATED':
        await this.handleTransactionStatusUpdate(data);
        break;
      case 'TRANSACTION_CREATED':
        await this.handleTransactionCreated(data);
        break;
      default:
        this.logger.warn(`Unhandled webhook type: ${type}`);
    }
  }

  /**
   * Execute an internal transfer between vault accounts
   *
   * This private method handles internal transfers between users within the same blockchain
   * provider. Internal transfers are typically instant and free, as they don't require
   * actual blockchain transactions.
   *
   * @param params Internal transfer parameters including source and destination vault IDs,
   *               amount, asset, and optional notes
   * @returns Promise<ITransferResponse> The transfer response with transaction ID and status
   * @throws Error if transfer fails, insufficient balance, or vault accounts not found
   *
   * @private
   */
  private async internalTransfer(params: IInternalTransferParams): Promise<ITransferResponse> {
    try {
      this.logger.log(
        `Initiating internal transfer of ${params.amount} ${params.assetId} ` +
          `from vault ${params.sourceVaultId} to vault ${params.destinationVaultId}`,
      );
      const transfer = await this.blockchainWaasAdapter.internalTransfer(params);
      this.logger.log(`Internal transfer completed: ${transfer.transactionId}`);
      return transfer;
    } catch (error) {
      this.logger.error(`Error in internal transfer: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Execute an external transfer to a blockchain address
   *
   * This private method handles external transfers to blockchain addresses outside the
   * provider's system. External transfers require actual blockchain transactions and may
   * incur network fees and confirmation delays.
   *
   * @param params External transfer parameters including source vault ID, destination address,
   *               amount, asset, and optional destination tag
   * @returns Promise<ITransferResponse> The transfer response with transaction ID and status
   * @throws Error if transfer fails, insufficient balance, or invalid destination address
   *
   * @private
   */
  private async externalTransfer(params: IExternalTransferParams): Promise<ITransferResponse> {
    try {
      this.logger.log(
        `Initiating external transfer of ${params.amount} ${params.assetId} ` +
          `from vault ${params.sourceVaultId} to address ${params.destinationAddress}` +
          (params.destinationTag ? ` (tag: ${params.destinationTag})` : ''),
      );
      const transfer = await this.blockchainWaasAdapter.externalTransfer(params);
      this.logger.log(`External transfer completed: ${transfer.transactionId}`);
      return transfer;
    } catch (error) {
      this.logger.error(`Error in external transfer: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Handle transaction status update webhooks
   *
   * This private method processes webhooks when a transaction's status changes (e.g., from
   * pending to completed). It updates the database, sends notifications to users, and
   * triggers any business logic associated with status changes.
   *
   * @param data The webhook data containing transaction ID and new status
   * @returns Promise<void>
   *
   * @private
   */
  private async handleTransactionStatusUpdate(data: IBlockchainWebhookDataUnion): Promise<void> {
    // Ensure this is transaction data
    if (!this.isBlockchainTransactionWebhookData(data)) {
      this.logger.warn('Received non-transaction data in handleTransactionStatusUpdate');
      return;
    }

    this.logger.log(`Transaction status updated: ${data.id} -> ${data.status}`);

    // Check if this is a gas tank refill transaction
    if (this.isGasTankRefill(data)) {
      this.logger.log(`Detected gas tank refill transaction: ${data.id}`);
      await this.handleGasTankRefill(data, data.status);
      return;
    }

    switch (data.status) {
      case 'COMPLETED':
        await this.handleTransactionCompleted(data);
        break;
      case 'BROADCASTING':
        await this.handleTransactionBroadcasted(data);
        break;
      case 'FAILED':
        await this.handleTransactionFailed(data);
    }
  }

  /**
   * Handle transaction created webhooks
   *
   * This private method processes webhooks when a new transaction is created in the blockchain
   * provider's system. It creates corresponding records in our database and sends initial
   * confirmations to users.
   *
   * @param data The webhook data containing new transaction details
   * @returns Promise<void>
   *
   * @private
   */
  private async handleTransactionCreated(data: IBlockchainWebhookDataUnion): Promise<void> {
    // Ensure this is transaction data
    if (!this.isBlockchainTransactionWebhookData(data)) {
      this.logger.warn('Received non-transaction data in handleTransactionCreated');
      return;
    }

    // Check if this is a gas tank refill transaction
    if (this.isGasTankRefill(data)) {
      this.logger.log(`Detected gas tank refill transaction: ${data.id}`);
      await this.handleGasTankRefill(data, data.status);
      return;
    }
  }

  /**
   * Handle transaction broadcasted webhooks
   *
   * This private method processes webhooks when a transaction has been broadcasted to the blockchain.
   * It updates the blockchain transaction record with the transaction hash from the webhook data.
   *
   * @param data The webhook data containing transaction details and hash
   * @returns Promise<void>
   *
   * @private
   */
  private async handleTransactionBroadcasted(data: IBlockchainWebhookDataUnion): Promise<void> {
    // Ensure this is transaction data
    if (!this.isBlockchainTransactionWebhookData(data)) {
      this.logger.warn('Received non-transaction data in handleTransactionBroadcasted');
      return;
    }

    this.logger.log(`Transaction broadcasted: ${data.id} with hash: ${data.txHash}`);

    try {
      // Find the blockchain transaction by provider reference
      const transaction = await this.blockchainWalletTransactionRepository.findByProviderReference(data.id);

      if (!transaction) {
        this.logger.warn(`No blockchain wallet transaction found for provider reference: ${data.id}`);
        return;
      }

      // Update the transaction with the transaction hash
      const updateData: Partial<BlockchainWalletTransactionModel> = {
        tx_hash: data.txHash,
        status: TransactionStatus.PENDING, // Keep as pending until confirmed
      };

      await this.blockchainWalletTransactionRepository.update(transaction.id, updateData);

      this.logger.log(`Updated blockchain transaction ${transaction.id} with hash: ${data.txHash}`);
    } catch (error) {
      this.logger.error(`Error updating transaction hash for ${data.id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Handle transaction completed webhooks
   *
   * This private method processes webhooks when a transaction is successfully completed.
   * It updates transaction status, adjusts wallet balances, sends success notifications,
   * and triggers any post-completion business logic like reward calculations or analytics.
   *
   * @param data The webhook data containing completed transaction details
   * @returns Promise<void>
   *
   * @private
   */
  private async handleTransactionCompleted(data: IBlockchainWebhookDataUnion): Promise<void> {
    // Ensure this is transaction data
    if (!this.isBlockchainTransactionWebhookData(data)) {
      this.logger.warn('Received non-transaction data in handleTransactionCompleted');
      return;
    }

    this.logger.log(`Transaction completed: ${data.id}`);

    // Determine transaction type
    let transaction: BlockchainWalletTransactionModel | undefined = undefined;
    let transactionScope: TransactionScope = TransactionScope.INTERNAL;

    // Handle deposit type (source.type is UNKNOWN and source.sourceAddress is not null
    // and destination.type is VAULT_ACCOUNT)
    if (data.source?.type === 'UNKNOWN' && data.source?.sourceAddress && data.destination?.type === 'VAULT_ACCOUNT') {
      this.logger.log('Detected DEPOSIT transaction type');

      // Check if transaction already exists for this provider reference
      const existingTransaction = await this.blockchainWalletTransactionRepository.findByProviderReference(data.id);

      if (existingTransaction) {
        this.logger.log(`Deposit transaction already exists for provider reference: ${data.id}, skipping funding`);
        return;
      }

      // Find the destination wallet for the deposit
      const destinationWallet = await this.blockchainWalletRepository.findByProviderAccountRef(
        data.destination.id,
        data.assetId,
      );

      if (!destinationWallet) {
        this.logger.warn(`No destination wallet found for vault account id ${data.destination.id}`);
        return;
      }

      this.logger.log(
        `Found destination wallet ${destinationWallet.id} for deposit to vault account id ${data.destination.id}`,
      );

      transactionScope = TransactionScope.EXTERNAL;

      // Fund the wallet with the deposit
      await this.fundWallet(destinationWallet.id, {
        amount: data.amountInfo?.amount,
        asset: data.assetId,
        transaction_type: BlockchainWalletTransactionType.DEPOSIT,
        description: 'External deposit received',
        provider_reference: data.id,
        peer_wallet_address: data.source.sourceAddress,
        tx_hash: data.txHash,
        network_fee: data.feeInfo?.networkFee,
        metadata: {
          transaction_scope: transactionScope,
        },
      });

      return;
    }

    if (!transaction) {
      this.logger.error(`No blockchain wallet transaction found for provider reference: ${data.id}`);
      return;
    }

    // 2. Handle non-deposit types (source.type is VAULT_ACCOUNT)
    if (data.source?.type === 'VAULT_ACCOUNT') {
      transaction = await this.blockchainWalletTransactionRepository.findByProviderReference(data.id);

      // Get the wallet associated with the transaction
      const wallet = (await this.blockchainWalletRepository.findById(
        transaction.blockchain_wallet_id,
      )) as BlockchainWalletModel;

      this.logger.log(`Found transaction ${transaction.id} and wallet ${wallet.id} for provider reference ${data.id}`);

      // Handle the senders transaction settlement
      await this.blockchainWalletTransactionService.markTransactionAsSuccessful(transaction.id, wallet, {
        provider_reference: data.id,
        tx_hash: data.txHash,
        network_fee: data.feeInfo?.networkFee,
      });

      this.logger.log(`Transaction ${transaction.id} marked as successful.`);

      // If the destination is also a vault account, (TRANSFER_IN from another OneDosh user)
      if (data.destination?.type === 'VAULT_ACCOUNT' && data.destination?.id) {
        const destinationWallet = await this.blockchainWalletRepository.findByProviderAccountRef(
          data.destination.id,
          data.assetId,
        );

        if (destinationWallet) {
          this.logger.log(
            `Found destination wallet ${destinationWallet.id} for vault account id ${data.destination.id}`,
          );

          await this.fundWallet(destinationWallet.id, {
            amount: data.amountInfo?.amount,
            asset: data.assetId,
            transaction_type: BlockchainWalletTransactionType.TRANSFER_IN,
            description: 'Internal transfer received',
            provider_reference: data.id,
            peer_wallet_id: destinationWallet.id,
            parent_id: transaction.id,
            metadata: {
              transaction_scope: transactionScope,
            },
          });
        } else {
          this.logger.warn(`No destination wallet found for vault account id ${data.destination.id}`);
        }
      }
      return;
    }

    // If neither case matches, log and exit
    this.logger.warn('Transaction type could not be determined or is not handled by this webhook');
  }

  /**
   * Handle transaction failed webhooks
   *
   * This private method processes webhooks when a transaction fails. It updates transaction
   * status, sends failure notifications to users, and triggers any failure handling logic
   * like refunds or retry mechanisms.
   *
   * @param data The webhook data containing failed transaction details
   * @returns Promise<void>
   *
   * @private
   */
  private async handleTransactionFailed(data: IBlockchainWebhookDataUnion): Promise<void> {
    // Ensure this is transaction data
    if (!this.isBlockchainTransactionWebhookData(data)) {
      this.logger.warn('Received non-transaction data in handleTransactionFailed');
      return;
    }

    this.logger.log(`Transaction failed: ${data.id}`);
    // TODO: Update transaction status to failed
    // TODO: Send failure notification to user
    // TODO: Trigger any failure handling logic
  }

  /**
   * Estimate fees for internal transfers
   *
   * This private method calculates fee estimates for internal transfers between users.
   * Internal transfers typically have minimal or no fees since they don't require
   * actual blockchain transactions.
   *
   * @param params Internal transfer fee estimation parameters including source and destination
   *               vault IDs, amount, asset, and fee level preference
   * @returns Promise<IFeeEstimateResponse> Fee estimate with breakdown of costs
   * @throws Error if estimation fails or vault accounts not found
   *
   * @private
   */
  private async estimateInternalTransferFee(params: IEstimateInternalTransferFeeParams): Promise<IFeeEstimateResponse> {
    try {
      this.logger.log(
        `Estimating internal fee for ${params.assetId}, from ${params.sourceVaultId} to ${params.destinationVaultId}`,
      );
      const estimate = await this.blockchainWaasAdapter.estimateInternalTransferFee(params);
      this.logger.log('Internal fee estimated successfully');
      return estimate;
    } catch (error) {
      this.logger.error(`Error estimating internal fee: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Estimate fees for external transactions
   *
   * This private method calculates fee estimates for external transactions to blockchain
   * addresses. External transactions incur network fees that vary based on blockchain
   * congestion and fee level preferences.
   *
   * @param params External transaction fee estimation parameters including source vault ID,
   *               destination address, amount, asset, and fee level preference
   * @returns Promise<IFeeEstimateResponse> Fee estimate with network and provider fee breakdown
   * @throws Error if estimation fails or invalid parameters
   *
   * @private
   */
  private async estimateExternalTransactionFee(params: IEstimateExternalFeeParams): Promise<IFeeEstimateResponse> {
    try {
      this.logger.log(
        `Estimating external fee for ${params.assetId}, from ${params.sourceVaultId} to ${params.destinationAddress}`,
      );
      const estimate = await this.blockchainWaasAdapter.estimateExternalTransactionFee(params);
      this.logger.log('External fee estimated successfully');
      return estimate;
    } catch (error) {
      this.logger.error(`Error estimating external fee: ${error.message}`, error.stack);
      throw error;
    }
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

  private buildBlockchainWalletDebitTransactionData(params: {
    walletId: string;
    transactionType: BlockchainWalletTransactionType;
    debitAmount: AssetAmount;
    balanceBefore: AssetAmount;
    balanceAfter: AssetAmount;
    asset: string;
    metadata: BlockchainWalletTransactionMetadata;
    idempotencyKey: string;
    type: 'debit' | 'credit';
  }): any {
    const {
      walletId,
      transactionType,
      debitAmount,
      balanceBefore,
      balanceAfter,
      asset,
      metadata,
      idempotencyKey,
      type,
    } = params;

    const data: any = {
      blockchain_wallet_id: walletId,
      transaction_type: transactionType,
      amount: debitAmount.toDb(),
      balance_before: balanceBefore.toDb(),
      balance_after: balanceAfter.toDb(),
      asset,
      status: TransactionStatus.PENDING,
      description: metadata.description,
      provider_reference: metadata.provider_reference,
      metadata: metadata.provider_metadata,
      idempotency_key: idempotencyKey,
      type: type,
      transaction_scope: metadata.transaction_scope,
    };
    if (transactionType === BlockchainWalletTransactionType.TRANSFER_OUT) {
      data.peer_wallet_id = metadata.destination;
    } else if (transactionType === BlockchainWalletTransactionType.WITHDRAWAL) {
      data.peer_wallet_address = metadata.destination;
    }
    return data;
  }

  /**
   * Build transaction data for funding a wallet (credit)
   */
  private buildBlockchainWalletFundTransactionData(params: {
    wallet: BlockchainWalletModel;
    txData: Partial<IBlockchainWalletTransaction>;
    creditAmount: AssetAmount;
    balanceBefore: AssetAmount;
    balanceAfter: AssetAmount;
    destination: string;
    transaction_scope: TransactionScope;
  }): Partial<IBlockchainWalletTransaction> {
    const { wallet, txData, creditAmount, balanceBefore, balanceAfter, destination, transaction_scope } = params;
    const data: Partial<IBlockchainWalletTransaction> = {
      blockchain_wallet_id: wallet.id,
      transaction_type: txData.transaction_type!,
      amount: creditAmount.toDb(),
      balance_before: balanceBefore.toDb(),
      balance_after: balanceAfter.toDb(),
      asset: wallet.asset,
      status: TransactionStatus.COMPLETED,
      transaction_scope: transaction_scope,
      type: 'credit',
      description: txData.description,
      provider_reference: txData.provider_reference,
      tx_hash: txData.tx_hash,
      network_fee: txData.network_fee,
      metadata: txData.metadata || {},
    };
    if (txData.transaction_type === BlockchainWalletTransactionType.DEPOSIT) {
      data.peer_wallet_address = destination;
    } else if (txData.transaction_type === BlockchainWalletTransactionType.TRANSFER_IN) {
      data.peer_wallet_id = destination;
    }
    return data;
  }

  /**
   * Create internal blockchain account for users
   *
   * This method checks if a user has a blockchain account for the specified rails.
   * If they do, it checks for a wallet using the default currency from stablecoin config.
   * If they don't have an account, it creates one and the default wallet.
   *
   * @param user The user object
   * @param rail The rails type (crypto, fiat, card)
   * @param useBaseAsset Whether to use the native asset as asset_id (true) or the full asset (false)
   * @returns Promise<IBlockchainWallet> The default wallet for the user
   * @throws Error if account/wallet creation fails
   */
  async createInternalBlockchainAccount(
    user: IUser,
    rail: BlockchainAccountRail,
    useBaseAsset: boolean = false,
  ): Promise<IBlockchainWallet> {
    try {
      this.logger.log(`Creating internal blockchain account for user ${user.id} with rails: ${rail}`);

      // Check if user has a blockchain account for the specified rails
      const existingBlockchainAccounts = await this.blockchainAccountsService.getUserAccounts(user.id);
      let blockchainAccount = existingBlockchainAccounts.find((acc) => acc.rails === rail);

      if (!blockchainAccount) {
        this.logger.log(`No account found for user ${user.id} with rails ${rail}, creating account`);

        // Create account using wallet service method (ensures internal flow)
        blockchainAccount = await this.createBlockchainAccount(user, rail);
      }

      // Get default stablecoin (USDC on Solana)
      const defaultCurrency = StableCoinsService.getDefaultStableCoin();
      if (!defaultCurrency) {
        return null; // return null if no default stablecoin is configured
      }

      // Determine which asset to use based on useBaseAsset parameter
      const assetId = useBaseAsset ? defaultCurrency.nativeAsset : defaultCurrency.id;
      const baseAssetId = useBaseAsset ? '' : defaultCurrency.nativeAsset;

      // Check if user has a wallet for the determined asset
      const existingWallet = await this.blockchainWalletRepository.findActiveWalletByUserIdAndAsset(
        user.id,
        assetId,
        true, // Include invisible wallets for internal operations
      );

      if (existingWallet) {
        this.logger.log(`User ${user.id} already has wallet for asset ${assetId}`);
        return existingWallet;
      }

      // Create wallet for the determined asset
      this.logger.log(`Creating default wallet for user ${user.id} with asset ${assetId}`);

      const walletResult = await this.createBlockchainWallet(user, {
        asset_ids: [
          {
            asset_id: assetId,
            base_asset_id: baseAssetId,
            name: defaultCurrency.name,
            decimal: defaultCurrency.decimals,
            type: defaultCurrency.type,
          },
        ],
        rail: rail,
        blockchain_account_id: blockchainAccount.id,
        blockchain_account_ref: blockchainAccount.provider_ref,
      });

      // Update the created wallet to be invisible (internal)
      if (walletResult.successful && walletResult.successful.length > 0) {
        const createdWallet = walletResult.successful[0];
        // Find the wallet by asset and user to get the correct ID
        const wallet = await this.blockchainWalletRepository.findActiveWalletByUserIdAndAsset(
          user.id,
          createdWallet.asset_id,
          true, // Include invisible wallets for internal operations
        );
        if (wallet) {
          await this.blockchainWalletRepository.update(wallet.id, {
            is_visible: rail === BLOCKCHAIN_ACCOUNT_RAIL.CRYPTO,
          });
        }
      }

      if (walletResult.successful && walletResult.successful.length > 0) {
        const createdWallet = walletResult.successful[0];
        this.logger.log(`Created default wallet ${createdWallet.asset_id} for user ${user.id}`);

        // Return the created wallet from database
        const wallet = await this.blockchainWalletRepository.findActiveWalletByUserIdAndAsset(
          user.id,
          createdWallet.asset_id,
          true, // Include invisible wallets for internal operations
        );

        if (!wallet) {
          throw new BadRequestException('Failed to retrieve created wallet');
        }

        return wallet;
      } else {
        throw new BadRequestException('Failed to create default wallet');
      }
    } catch (error) {
      this.logger.error(`Error creating internal blockchain account: ${error.message}`, error.stack);
      throw error;
    }
  }

  async createCustomWallet(user: UserModel, params: ICreateCustomWallet): Promise<IBlockchainWallet> {
    try {
      this.logger.log(
        `Creating custom wallet for user ${user.id} with network: ${params.network}, asset: ${params.asset}`,
      );

      this.validateCustomWalletNetwork(params.network);

      const targetRail = this.resolveCustomWalletRail(params.rail);

      const { assetId, baseAssetId, stableCoinConfig } = this.resolveCustomWalletAsset(params);

      const existingWallet = await this.findExistingCustomWallet(user.id, assetId);
      if (existingWallet) {
        return existingWallet;
      }

      const addressResult = this.createCustomWalletAddress(params.network);

      const walletData: Partial<BlockchainWalletModel> = {
        user_id: user.id,
        blockchain_account_id: null,
        provider_account_ref: addressResult.address,
        provider: BlockchainWalletProvider.CUSTOM,
        asset: assetId,
        base_asset: baseAssetId,
        address: addressResult.address,
        status: BlockchainWalletStatus.ACTIVE,
        balance: '0',
        name: params.name || stableCoinConfig?.name || assetId,
        decimal: stableCoinConfig?.decimals,
        network: params.network,
        rails: targetRail,
        is_visible: false,
      };

      const wallet = await this.blockchainWalletRepository.create(walletData);

      const walletKeyData = {
        blockchain_wallet_id: wallet.id,
        encrypted_private_key: addressResult.encryptedPrivateKey,
        encryption_iv: addressResult.encryptionIv,
        network: params.network,
        public_key: addressResult.publicKey,
        key_index: 0,
      };

      await this.blockchainWalletKeyRepository.create(walletKeyData);

      this.logger.log(`Created custom wallet ${wallet.id} for user ${user.id} with address ${addressResult.address}`);

      return wallet;
    } catch (error) {
      this.logger.error(`Error creating custom wallet: ${error.message}`, error.stack);
      throw error;
    }
  }

  private validateCustomWalletNetwork(network: string): void {
    if (!network || !['ethereum', 'solana'].includes(network)) {
      throw new BadRequestException('Network must be either "ethereum" or "solana"');
    }
  }

  private resolveCustomWalletRail(rail?: BlockchainAccountRail): BlockchainWalletRails {
    if (rail === BLOCKCHAIN_ACCOUNT_RAIL.CRYPTO) {
      return BlockchainWalletRails.CRYPTO;
    }

    return BlockchainWalletRails.REMITTANCE;
  }

  private resolveCustomWalletAsset(params: ICreateCustomWallet): {
    assetId: string;
    baseAssetId: string;
    stableCoinConfig: StableCoinConfig | undefined;
  } {
    if (params.useDefault) {
      const defaultCurrency = StableCoinsService.getDefaultStableCoin('custom');
      if (!defaultCurrency) {
        throw new BadRequestException('No default stablecoin configured');
      }

      const stableCoinConfig = StableCoinsService.getStableCoinConfigBySymbol(defaultCurrency.symbol);
      const assetId = params.useBase ? defaultCurrency.nativeAsset : defaultCurrency.id;
      const baseAssetId = params.useBase ? '' : defaultCurrency.nativeAsset;

      return { assetId, baseAssetId, stableCoinConfig };
    }

    if (!params.asset) {
      throw new BadRequestException('Asset is required when useDefault is false');
    }

    const stableCoinConfig = StableCoinsService.getStableCoinConfigBySymbol(params.asset);
    if (!stableCoinConfig) {
      throw new BadRequestException(`Asset ${params.asset} not found in configuration`);
    }

    const providerAssetId = StableCoinsService.getProviderAssetId(params.asset, 'custom');
    const providerNativeAsset = StableCoinsService.getProviderNativeAsset(params.asset, 'custom');

    const assetId = params.useBase ? providerNativeAsset || params.asset : providerAssetId || params.asset;
    const baseAssetId = params.useBase ? '' : providerNativeAsset || '';

    return { assetId, baseAssetId, stableCoinConfig };
  }

  private async findExistingCustomWallet(userId: string, assetId: string): Promise<IBlockchainWallet | null> {
    const existingWallet = await this.blockchainWalletRepository.findActiveWalletByUserIdAndAsset(
      userId,
      assetId,
      true,
    );

    if (existingWallet && existingWallet.provider === BlockchainWalletProvider.CUSTOM) {
      this.logger.log(`User ${userId} already has custom wallet for asset ${assetId}`);
      return existingWallet;
    }

    return null;
  }

  private createCustomWalletAddress(network: 'ethereum' | 'solana') {
    const addressResult =
      network === 'ethereum'
        ? this.blockchainService.createEthereumAddress()
        : this.blockchainService.createSolanaAddress();

    if (!addressResult.encryptedPrivateKey) {
      throw new BadRequestException('Failed to encrypt private key');
    }

    return addressResult;
  }

  /**
   * Get transactions for a user's wallet
   * @param userId The user's ID
   * @param walletId The wallet's ID
   * @param filters Filters for the transaction query
   */
  async getUserWalletTransactions(userId: string, filters: GetUserTransactionsDto) {
    let useWalletId = false;
    let idToQuery: string;

    if (filters.walletId) {
      const wallet = await this.blockchainWalletRepository.findUserWalletById(userId, filters.walletId);

      if (!wallet) {
        throw new Error('walletId does not belong to the user');
      }

      idToQuery = filters.walletId;
      useWalletId = true;
    } else {
      idToQuery = userId;
    }

    return this.blockchainWalletTransactionService.getUserTransactions(idToQuery, filters, useWalletId);
  }

  /**
   * Send money to ZeroHash or YellowCard for themselves
   *
   * This method allows sending money from a user's blockchain wallet to ZeroHash or YellowCard.
   * For ZeroHash USD transfers, it first gets the user's ZeroHash deposit address and then
   * constructs a transaction to send the money.
   *
   * @param user The user initiating the transfer
   * @param walletId The blockchain wallet ID to send from
   * @param amount The amount to send
   * @param provider The provider to send to ('zerohash' or 'yellowcard')
   * @param note Optional note for the transaction
   * @returns Promise<ITransferResponse> The transfer response with transaction details
   * @throws BadRequestException if wallet doesn't support required assets or other validation errors
   */
  async convertToCurrency(
    user: IUser,
    walletId: string,
    amount: number,
    toCurrency: 'NGN' | 'USD',
    note?: string,
  ): Promise<ITransferResponse> {
    try {
      this.logger.log(`Sending ${amount} from wallet ${walletId} to ${toCurrency} for user ${user.id}`);

      // Get the wallet and validate it belongs to the user
      const wallet = await this.blockchainWalletRepository.findUserWalletById(user.id, walletId);

      if (!wallet) {
        throw new BadRequestException('Wallet not found or does not belong to user');
      }

      // Check for pending transactions
      const pendingTx = await this.blockchainWalletTransactionRepository.findFirstPendingByUserId(walletId);
      if (pendingTx) {
        throw new BadRequestException(
          'You have a pending transaction. Please wait until it is completed before initiating a new one.',
        );
      }

      let transactionProviderRef: ITransferResponse;
      let blockchainWalletTransaction: BlockchainWalletTransactionModel;
      let destinationAddress: string;

      try {
        if (toCurrency === 'USD') {
          // Get user's ZeroHash deposit address
          const depositAddresses = await this.depositAddressService.getDepositAddresses(user as UserModel);
          const zerohashAddress = depositAddresses.find((addr) => addr.provider === 'zerohash');

          if (!zerohashAddress) {
            throw new BadRequestException('No ZeroHash deposit address found for user');
          }

          destinationAddress = zerohashAddress.address;

          const [depositAssetPart, depositBaseAssetPart] = zerohashAddress.asset.split('.');

          const isDefaultAsset = wallet.asset.toLowerCase().includes(depositAssetPart.toLowerCase());
          const isDefaultBaseAsset = wallet.base_asset.toLowerCase().includes(depositBaseAssetPart.toLowerCase());

          if (!isDefaultAsset || !isDefaultBaseAsset) {
            throw new BadRequestException(
              `You can only convert from wallets that match the default asset network ${zerohashAddress.asset}. ` +
                `Selected wallet: asset=${wallet.asset}, base_asset=${wallet.base_asset}`,
            );
          }

          // Debit the wallet first
          const debitResult = await this.debitWallet(walletId, amount, wallet.asset, {
            description: note || `convert to ${toCurrency}`,
            transaction_type: BlockchainWalletTransactionType.WITHDRAWAL,
            destination: destinationAddress,
          });

          blockchainWalletTransaction = debitResult.blockchainWalletTransaction;

          // Send to ZeroHash address
          transactionProviderRef = await this.externalTransfer({
            assetId: wallet.asset,
            amount: String(amount),
            sourceVaultId: wallet.provider_account_ref,
            destinationAddress: destinationAddress,
            note: note || `convert to ${toCurrency}`,
            idempotencyKey: UtilsService.generateIdempotencyKey(),
            externalTxId: blockchainWalletTransaction.id,
          });
        } else if (toCurrency === 'NGN') {
          // Use the provided address for NGN conversion
          // TODO: Get the address from yellowcard
          destinationAddress = '0x0Cb5f26d509D054549a58052C0c1415C000AD7b1';

          // Debit the wallet first
          const debitResult = await this.debitWallet(walletId, amount, wallet.asset, {
            description: note || `convert to ${toCurrency}`,
            transaction_type: BlockchainWalletTransactionType.WITHDRAWAL,
            destination: destinationAddress,
          });

          blockchainWalletTransaction = debitResult.blockchainWalletTransaction;

          // Send to NGN address
          transactionProviderRef = await this.externalTransfer({
            assetId: wallet.asset,
            amount: String(amount),
            sourceVaultId: wallet.provider_account_ref,
            destinationAddress: destinationAddress,
            note: note || `convert to ${toCurrency}`,
            idempotencyKey: UtilsService.generateIdempotencyKey(),
            externalTxId: blockchainWalletTransaction.id,
          });
        } else {
          throw new BadRequestException('Invalid currency. Only "USD" and "NGN" conversions are supported.');
        }

        // Update the blockchain wallet transaction with the provider reference
        if (blockchainWalletTransaction && transactionProviderRef?.transactionId) {
          await this.blockchainWalletTransactionRepository.update(blockchainWalletTransaction.id, {
            provider_reference: transactionProviderRef.transactionId,
          });
        }

        return {
          transactionId: blockchainWalletTransaction.id,
          status: transactionProviderRef.status,
          systemMessages: transactionProviderRef.systemMessages,
        };
      } catch (error) {
        // Revert the debit if it was created
        if (blockchainWalletTransaction && wallet) {
          try {
            await this.revertWalletDebit(user.id, walletId, amount, wallet.asset, blockchainWalletTransaction, {
              description: 'Revert failed provider transfer',
              provider_metadata: undefined,
              source: undefined,
              destination: destinationAddress,
              transaction_type: BlockchainWalletTransactionType.WITHDRAWAL,
            });
          } catch (revertError) {
            this.logger.error(`Failed to revert transaction after error: ${revertError.message}`, revertError.stack);
          }
        }
        throw error;
      }
    } catch (error) {
      this.logger.error(`Error sending to provider: ${error.message}`, error.stack);
      throw error;
    }
  }

  private isGasTankRefill(txData: IBlockchainWebhookData): boolean {
    const fireblocksData = txData as any;
    return fireblocksData.createdBy === 'gas-station';
  }

  private async handleGasTankRefill(txData: IBlockchainWebhookData, status: string): Promise<void> {
    try {
      this.logger.log(`Handling gas tank refill for transaction: ${txData.id} with status: ${status}`);

      // Check if gas fund transaction already exists by provider reference
      const existingTransaction = await this.blockchainGasFundTransactionService.findByProviderReference(txData.id);

      if (existingTransaction) {
        // Update existing transaction status
        this.logger.log(`Updating existing gas fund transaction ${existingTransaction.id} status to ${status}`);

        let transactionStatus: TransactionStatus;
        const updateData: Partial<IBlockchainGasFundTransaction> = {};

        switch (status) {
          case 'COMPLETED':
            transactionStatus = TransactionStatus.COMPLETED;
            if (txData.txHash) {
              updateData.tx_hash = txData.txHash;
            }
            // Extract network fee if available
            if (txData.feeInfo?.networkFee) {
              updateData.network_fee = txData.feeInfo.networkFee;
            }
            break;
          case 'BROADCASTING':
            transactionStatus = TransactionStatus.PROCESSING;
            if (txData.txHash) {
              updateData.tx_hash = txData.txHash;
            }
            // Extract network fee if available
            if (txData.feeInfo?.networkFee) {
              updateData.network_fee = txData.feeInfo.networkFee;
            }
            break;
          case 'FAILED':
            transactionStatus = TransactionStatus.FAILED;
            updateData.failure_reason = txData.subStatus || 'Transaction failed';
            break;
          default:
            transactionStatus = TransactionStatus.PENDING;
        }

        // Update the transaction with status and additional fields
        updateData.status = transactionStatus;
        updateData.metadata = {
          ...existingTransaction.metadata,
          webhook_status: status,
          updated_at: new Date().toISOString(),
        };

        await this.blockchainGasFundTransactionService.update(existingTransaction.id, updateData);

        this.logger.log(`Gas fund transaction ${existingTransaction.id} status updated to ${transactionStatus}`);
      } else {
        // Create new gas fund transaction if it doesn't exist
        this.logger.log(`Creating new gas fund transaction for provider reference: ${txData.id}`);

        // Find the wallet using provider account reference
        // For gas tank refill, the destination should be the vault account
        const providerAccountRef = txData.destination?.id;
        if (!providerAccountRef) {
          this.logger.error(
            `Unable to extract provider account reference from gas tank refill transaction: ${txData.id}`,
          );
          return;
        }

        // Find the wallet by provider account reference
        const wallet = await this.blockchainWalletRepository.findByProviderAccountRef(
          providerAccountRef,
          null,
          txData.assetId,
        );

        if (!wallet) {
          this.logger.error(
            `No wallet found for provider account reference ${providerAccountRef} in gas tank refill transaction: ${txData.id}`,
          );
          return;
        }

        const userId = wallet.user_id;
        const walletId = wallet.id;

        // Create the gas fund transaction with PENDING status
        await this.blockchainGasFundTransactionService.create({
          user_id: userId,
          blockchain_wallet_id: walletId,
          native_asset_id: txData.assetId,
          amount: txData.amountInfo?.amount || '0',
          status: status === 'COMPLETED' ? TransactionStatus.COMPLETED : TransactionStatus.PENDING,
          provider_reference: txData.id,
          tx_hash: txData?.txHash,
          metadata: {
            webhook_status: status,
            operation: txData.operation,
            created_by: 'gas-station',
            created_at: new Date().toISOString(),
          },
        });

        this.logger.log(`New gas fund transaction created for provider reference: ${txData.id}`);
      }

      return;
    } catch (error) {
      this.logger.error(`Error handling gas tank refill for transaction ${txData.id}: ${error.message}`, error.stack);
      // Don't throw the error to prevent webhook processing from failing
    }
  }

  /**
   * Type guard to check if webhook data is blockchain transaction data
   * @param data The webhook data to check
   * @returns True if data is IBlockchainWebhookData
   * @private
   */
  private isBlockchainTransactionWebhookData(data: IBlockchainWebhookDataUnion): data is IBlockchainWebhookData {
    return 'status' in data && 'txHash' in data && 'source' in data;
  }

  /**
   * Type guard to check if webhook data is vault account data
   * @param data The webhook data to check
   * @returns True if data is IBlockchainVaultAccountWebhookData
   * @private
   */
  private isVaultAccountWebhookData(data: IBlockchainWebhookDataUnion): data is IBlockchainVaultAccountWebhookData {
    return 'name' in data && 'assets' in data && !('status' in data);
  }

  /**
   * Type guard to check if webhook data is vault account asset data
   * @param data The webhook data to check
   * @returns True if data is IBlockchainVaultAccountAssetWebhookData
   * @private
   */
  private isVaultAccountAssetWebhookData(
    data: IBlockchainWebhookDataUnion,
  ): data is IBlockchainVaultAccountAssetWebhookData {
    return 'accountId' in data && 'assetId' in data && !('status' in data) && !('name' in data);
  }
}
