import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { FireblocksAxiosHelper } from './fireblocks_http';
import {
  IFireblocksAsset,
  IFireblocksCreateAccountRequest,
  IFireblocksCreateAccountResponse,
  IFireblocksCreateTransactionRequest,
  IFireblocksCreateTransactionResponse,
  IFireBlocksCreateWalletRequest,
  IFireBlocksCreateWalletResponse,
  IFireblocksEstimateFeeRequest,
  IFireblocksEstimateFeeResponse,
  IFireblocksTransaction,
  IFireblocksVaultAccount,
  IFireblocksVaultAsset,
  IFireblocksTravelRuleMessage,
  IFireblocksWebhookV1Payload,
  IFireblocksWebhookV2Payload,
  FIREBLOCKS_V1_TO_V2_EVENT_TYPES,
  FIREBLOCKS_V2_TO_V1_EVENT_TYPES,
  VaultType,
  FireblocksV2EventType,
  FireblocksV1EventType,
  IFireblocksVaultAccountAssetWebhookData,
  IFireblocksWebhookV1Data,
  IFireblocksVaultAccountWebhookData,
} from './fireblocks_interface';
import {
  IBlockchainWaasManagement,
  ICreateAccountParams,
  ICreateAccountResponse,
  ICreateTransactionParams,
  ICreateTransactionResponse,
  ICreateWalletParams,
  ICreateWalletResponse,
  ITransactionHistoryItem,
  ITransactionHistoryParams,
  ITransactionHistoryResponse,
  IEstimateTransactionFeeParams,
  IEstimateInternalTransferFeeParams,
  IEstimateExternalFeeParams,
  IFeeEstimateResponse,
  IVaultAccount,
  IVaultAsset,
  STABLE_COIN_KEYWORDS,
  IBlockchainWebhookPayload,
  IInternalTransferParams,
  IExternalTransferParams,
  ITransferResponse,
  IBlockchainResendWebhookRequest,
  IBlockchainResendWebhookResponse,
} from '../blockchain-waas-adapter.interface';
import { createHmac, createVerify } from 'crypto';
import { FireblocksConfigProvider } from '../../../config';

@Injectable()
export class FireblocksAdapter extends FireblocksAxiosHelper implements IBlockchainWaasManagement {
  private readonly logger = new Logger(FireblocksAdapter.name);

  /**
   * Retrieves a list of supported stablecoin assets from Fireblocks API.
   * Filters the full asset list to only include assets matching STABLE_COIN_KEYWORDS.
   *
   * @returns Promise resolving to an array of stablecoin assets with id, name, type, and nativeAsset properties
   * @throws InternalServerErrorException if the request fails
   */
  public async getAvailableStableAssets(): Promise<
    Pick<IFireblocksAsset, 'id' | 'name' | 'type' | 'nativeAsset' | 'decimals'>[]
  > {
    try {
      this.logger.log('Requesting supported assets from Fireblocks...');
      const response = await this.get<IFireblocksAsset[]>('/v1/supported_assets');

      this.logger.debug(`Received ${response.data.length} assets. Filtering for stablecoins...`);

      const filteredAssets = response.data.filter((asset: { name: string }) =>
        STABLE_COIN_KEYWORDS.some((keyword) => asset.name.toLowerCase().includes(keyword)),
      );

      this.logger.log(`Filtered ${filteredAssets.length} stable assets.`);
      return filteredAssets.map(({ id, name, type, nativeAsset, decimals }) => ({
        id,
        name,
        type,
        nativeAsset,
        decimals,
      }));
    } catch (error) {
      this.logger.error('Failed to get stable assets from Fireblocks', error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  /**
   * Creates a new vault account in Fireblocks for the specified user.
   *
   * @param params - Contains user details for account creation:
   *   - user_name: Name for the new vault account
   *   - user_id: Customer reference ID to associate with the account
   *   - idempotencyKey: Optional key to prevent duplicate operations
   *
   * @returns Promise resolving to account creation response containing:
   *   - account_id: The Fireblocks vault account ID
   *   - account_name: The name of the vault account
   *   - user_id: The associated customer reference ID
   * @throws InternalServerErrorException if the request fails
   */
  public async createAccount(params: ICreateAccountParams): Promise<ICreateAccountResponse> {
    try {
      this.logger.log(`Creating vault account for user ${params.user_name}`);

      const requestBody: IFireblocksCreateAccountRequest = {
        name: params.user_name,
        hiddenOnUI: false,
        customerRefId: params.user_id,
        autoFuel: true,
        vaultType: VaultType.MPC,
      };

      const response = await this.post<IFireblocksCreateAccountResponse>(
        '/v1/vault/accounts',
        requestBody,
        params?.idempotencyKey,
      );

      this.logger.log(`Successfully created vault account with ID: ${response.data.id}`);
      const { id, name, customerRefId: user_id } = response.data;

      return { id, name, user_id };
    } catch (error) {
      this.logger.error('Failed to create vault account in Fireblocks', error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  /**
   * Creates deposit addresses for multiple assets within a vault account.
   * Processes assets in parallel and returns both successful and failed creations.
   *
   * @param params - Contains wallet creation parameters:
   *   - account_id: The vault account ID to create wallets in
   *   - asset_ids: Array of asset IDs to create wallets for
   *   - user_id: Customer reference ID to associate with wallets
   *   - idempotencyKey: Optional base key for idempotent requests
   *
   * @returns Promise resolving to an object containing:
   *   - successful: Array of successfully created wallets
   *   - failed: Array of failed wallet creations with error details
   * @throws InternalServerErrorException if there's an overarching failure
   */
  public async createWallet(params: ICreateWalletParams): Promise<ICreateWalletResponse> {
    try {
      this.logger.log(
        `Creating deposit addresses for vault ${params.provider_account_ref} and assets ${params.asset_ids.map((a) => a.asset_id).join(', ')}`,
      );

      const results: ICreateWalletResponse = {
        successful: [],
        failed: [],
      };

      for (const { asset_id, base_asset_id } of params.asset_ids) {
        if (base_asset_id && base_asset_id !== asset_id) {
          // Always attempt to create base asset first
          const baseRes = await this.createWalletForAsset(params, base_asset_id);
          if (!baseRes.success) {
            results.failed.push({
              asset_id: asset_id,
              error: `Base asset (${base_asset_id}) creation failed: ${baseRes.error?.error || baseRes.error}`,
            });
            continue;
          }
        }

        // Now create the main asset
        const mainRes = await this.createWalletForAsset(params, asset_id);
        if (mainRes.success) {
          results.successful.push(mainRes.data);
        } else {
          results.failed.push(mainRes.error);
        }
      }

      return results;
    } catch (error) {
      this.logger.error('Failed to create wallets in Fireblocks', error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  /**
   * Private helper to create a wallet for a single asset
   */
  private async createWalletForAsset(
    params: ICreateWalletParams,
    asset_id: string,
  ): Promise<{
    success: boolean;
    data?: {
      asset_id: string;
      address: string;
      user_id: string;
      provider_account_ref: string;
    };
    error?: any;
  }> {
    try {
      const requestBody: IFireBlocksCreateWalletRequest = {
        customerRefId: params.user_id,
      };

      const assetIdempotencyKey = params?.idempotencyKey
        ? `${params?.idempotencyKey}-${asset_id.toLowerCase()}`.slice(0, 40)
        : null;

      const response = await this.post<IFireBlocksCreateWalletResponse>(
        `/v1/vault/accounts/${params.provider_account_ref}/${asset_id}`,
        requestBody,
        assetIdempotencyKey,
      );

      this.logger.log(`Successfully created wallet for asset ${asset_id} with address ${response.data.address}`);

      return {
        success: true,
        data: {
          asset_id,
          address: response.data.address,
          user_id: response.data.customerRefId,
          provider_account_ref: params.provider_account_ref,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to create wallet for asset ${asset_id}`, error.stack);
      return {
        success: false,
        error: {
          asset_id,
          error: error.message,
        },
      };
    }
  }

  /**
   * Retrieves details of a specific vault account including its asset balances.
   *
   * @param vaultAccountId - The ID of the vault account to fetch
   *
   * @returns Promise resolving to vault account details including:
   *   - id: The vault account ID
   *   - name: The account name
   *   - user_id: The associated customer reference ID
   *   - assets: Array of asset balances in the account
   * @throws InternalServerErrorException if the request fails
   */
  public async getVaultAccount(vaultAccountId: string): Promise<IVaultAccount> {
    try {
      this.logger.log(`Fetching vault account with ID: ${vaultAccountId}`);
      const response = await this.get<IFireblocksVaultAccount>(`/v1/vault/accounts/${vaultAccountId}`);
      const { id, name, customerRefId: user_id, assets = [] } = response.data;

      // Filter for stable coins using STABLE_COIN_KEYWORDS against asset IDs
      const mappedAssets: IVaultAsset[] = assets
        .filter((asset) => STABLE_COIN_KEYWORDS.some((keyword) => asset.id.toLowerCase().includes(keyword)))
        .map((asset) => ({
          id: asset.id,
          total: asset.total || '0', // Ensure default values
          available: asset.available || '0',
          pending: asset.pending,
          frozen: asset.frozen,
          lockedAmount: asset.lockedAmount,
        }));

      this.logger.log(`Found ${mappedAssets.length} stable assets in vault account ${vaultAccountId}`);

      return {
        id,
        name,
        user_id,
        assets: mappedAssets,
      };
    } catch (error) {
      this.logger.error(`Error fetching vault account ${vaultAccountId}`, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  /**
   * Retrieves balance information for a specific asset within a vault account.
   *
   * @param vaultAccountId - The ID of the vault account
   * @param assetId - The ID of the asset to check
   *
   * @returns Promise resolving to asset balance details including:
   *   - id: The asset ID
   *   - total: Total balance
   *   - available: Available balance
   *   - pending: Pending transactions
   *   - lockedAmount: Locked amount
   * @throws InternalServerErrorException if the request fails
   */
  public async getAssetBalance(vaultAccountId: string, assetId: string): Promise<IVaultAsset> {
    try {
      this.logger.log(`Fetching asset balance for asset ${assetId} in vault account ${vaultAccountId}`);
      const response = await this.get<IFireblocksVaultAsset>(`/v1/vault/accounts/${vaultAccountId}/${assetId}`);
      const { id, total, available, pending, lockedAmount } = response.data;

      return {
        id,
        total,
        available,
        pending,
        lockedAmount,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching asset balance for asset ${assetId} in vault account ${vaultAccountId}`,
        error.stack,
      );
      throw new InternalServerErrorException(error.message);
    }
  }

  /**
   * Estimates transaction fees for various transaction types
   * @param params Fee estimation parameters
   * @returns Fee estimate response
   * @throws InternalServerErrorException if the request fails
   */
  public async estimateTransactionFee(params: IEstimateTransactionFeeParams): Promise<IFeeEstimateResponse> {
    try {
      this.logger.log(
        `Estimating transaction fee for ${params.assetId} from ${params.source.type} to ${params.destination.type}`,
      );

      const requestBody: IFireblocksEstimateFeeRequest = {
        assetId: params.assetId,
        amount: params.amount,
        source: {
          type: params.source.type,
          id: params.source.id,
        },
        destination: {
          type: params.destination.type,
          id: params.destination.id,
        },
        operation: params.operation || 'TRANSFER',
        feeLevel: params.feeLevel || 'HIGH',
      };

      // Handle ONE_TIME_ADDRESS destination type
      if (params.destination.type === 'ONE_TIME_ADDRESS' && (params.destination as any).address) {
        (requestBody.destination as any).oneTimeAddress = {
          address: (params.destination as any).address,
          tag: (params.destination as any).tag,
        };
      }

      const response = await this.post<IFireblocksEstimateFeeResponse>('/v1/transactions/estimate_fee', requestBody);

      this.logger.log(`Fee estimated successfully for ${params.assetId}`);

      return response.data;
    } catch (error) {
      this.logger.error('Failed to estimate transaction fees', error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  /**
   * Estimates internal transfer fees between vault accounts
   * @param params Internal transfer fee estimation parameters
   * @returns Fee estimate response
   * @throws InternalServerErrorException if the request fails
   */
  public async estimateInternalTransferFee(params: IEstimateInternalTransferFeeParams): Promise<IFeeEstimateResponse> {
    return await this.estimateTransactionFee({
      assetId: params.assetId,
      amount: params.amount,
      source: {
        type: 'VAULT_ACCOUNT',
        id: params.sourceVaultId,
      },
      destination: {
        type: 'VAULT_ACCOUNT',
        id: params.destinationVaultId,
      },
      operation: 'TRANSFER',
      feeLevel: params.feeLevel,
    });
  }

  /**
   * Estimates external transaction fees to blockchain addresses
   * @param params External transaction fee estimation parameters
   * @returns Fee estimate response
   * @throws InternalServerErrorException if the request fails
   */
  public async estimateExternalTransactionFee(params: IEstimateExternalFeeParams): Promise<IFeeEstimateResponse> {
    return await this.estimateTransactionFee({
      assetId: params.assetId,
      amount: params.amount,
      source: {
        type: 'VAULT_ACCOUNT',
        id: params.sourceVaultId,
      },
      destination: {
        type: 'ONE_TIME_ADDRESS',
        id: params.destinationAddress,
      },
      operation: 'TRANSFER',
      feeLevel: params.feeLevel,
    });
  }

  /**
   * Creates a new transaction in Fireblocks with support for various transaction types and parameters.
   *
   * @param params - Transaction creation parameters including source, destination, and transaction details
   * @returns Promise resolving to transaction creation response
   * @throws InternalServerErrorException if the request fails
   */
  public async createTransaction(params: ICreateTransactionParams): Promise<ICreateTransactionResponse> {
    try {
      this.logger.log(
        `Creating ${params.operation || 'TRANSFER'} transaction for asset ${params.assetId} ` +
          `from ${params.source.type}${params.source.id ? ` (ID: ${params.source.id})` : ''} ` +
          `to ${params.destination.type}${params.destination.id ? ` (ID: ${params.destination.id})` : ''}`,
      );

      const requestBody = this.buildFireblocksTransactionRequest(params);

      const response = await this.post<IFireblocksCreateTransactionResponse>(
        '/v1/transactions',
        requestBody,
        params.idempotencyKey,
      );

      this.logger.log(
        `Transaction created with ID: ${response.data.id}, ` +
          `status: ${response.data.status}, ` +
          `externalTxId: ${response.data.externalTxId || 'none'}`,
      );

      return {
        id: response.data.id,
        status: response.data.status,
        externalTxId: response.data.externalTxId,
      };
    } catch (error) {
      this.logger.error('Failed to create transaction in Fireblocks', error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  /**
   * Creates an internal transfer between vault accounts
   *
   * @param params - Internal transfer parameters
   * @returns Promise resolving to transfer response
   * @throws InternalServerErrorException if the request fails
   */
  public async internalTransfer(params: IInternalTransferParams): Promise<ITransferResponse> {
    try {
      this.logger.log(
        `Creating internal transfer of ${params.amount} ${params.assetId} ` +
          `from vault ${params.sourceVaultId} to vault ${params.destinationVaultId}`,
      );

      const transactionParams: ICreateTransactionParams = {
        operation: 'TRANSFER',
        assetId: params.assetId,
        source: {
          type: 'VAULT_ACCOUNT',
          id: params.sourceVaultId,
        },
        destination: {
          type: 'VAULT_ACCOUNT',
          id: params.destinationVaultId,
        },
        amount: params.amount,
        note: params.note,
        externalTxId: params.externalTxId,
        feeLevel: params.feeLevel || 'HIGH',
        idempotencyKey: params.idempotencyKey,
        treatAsGrossAmount: false,
        forceSweep: false,
        failOnLowFee: false,
        useGasless: false,
      };

      const response = await this.createTransaction(transactionParams);

      return {
        transactionId: response.id,
        status: response.status,
        externalTxId: response.externalTxId,
        systemMessages: response.systemMessages,
      };
    } catch (error) {
      this.logger.error('Failed to create internal transfer in Fireblocks', error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  /**
   * Creates an external transfer to a blockchain address
   *
   * @param params - External transfer parameters
   * @returns Promise resolving to transfer response
   * @throws InternalServerErrorException if the request fails
   */
  public async externalTransfer(params: IExternalTransferParams): Promise<ITransferResponse> {
    try {
      this.logger.log(
        `Creating external transfer of ${params.amount} ${params.assetId} ` +
          `from vault ${params.sourceVaultId} to address ${params.destinationAddress}` +
          (params.destinationTag ? ` (tag: ${params.destinationTag})` : ''),
      );

      const transactionParams: ICreateTransactionParams = {
        operation: 'TRANSFER',
        assetId: params.assetId,
        source: {
          type: 'VAULT_ACCOUNT',
          id: params.sourceVaultId,
        },
        destination: {
          type: 'ONE_TIME_ADDRESS',
          address: params.destinationAddress,
          tag: params.destinationTag,
        },
        amount: params.amount,
        note: params.note,
        externalTxId: params.externalTxId,
        feeLevel: params.feeLevel || 'HIGH',
        idempotencyKey: params.idempotencyKey,
        travelRuleMessage: params.travelRuleMessage,
        treatAsGrossAmount: false,
        forceSweep: false,
        failOnLowFee: false,
        useGasless: false,
      };

      const response = await this.createTransaction(transactionParams);

      return {
        transactionId: response.id,
        status: response.status,
        externalTxId: response.externalTxId,
        systemMessages: response.systemMessages,
      };
    } catch (error) {
      this.logger.error('Failed to create external transfer in Fireblocks', error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  /**
   * Retrieves transaction history with filtering and pagination support
   * @param params Filtering and pagination parameters
   * @returns Transaction history response
   * @throws InternalServerErrorException if the request fails
   */
  public async getTransactionHistory(params: ITransactionHistoryParams): Promise<ITransactionHistoryResponse> {
    try {
      this.logger.log('Fetching transaction history with params:', params);

      const queryParams = this.buildTransactionHistoryQueryParams(params);

      const response = await this.getPaginated<IFireblocksTransaction[]>('/v1/transactions', queryParams);

      this.logger.log(`Fetched ${response.data.transactions.length} transactions`);

      // Transform Fireblocks transactions to our interface
      const transactions = response.data.transactions.map((tx) => ({
        id: tx.id,
        externalTxId: tx.externalTxId,
        status: tx.status,
        operation: tx.operation,
        assetId: tx.assetId,
        source: {
          type: tx.source.type,
          id: tx.source.id,
          address: tx.source.sourceAddress,
        },
        destination: tx.destination
          ? {
              type: tx.destination.type,
              id: tx.destination.id,
              address: tx.destination.destinationAddress,
              tag: tx.destination.destinationTag,
            }
          : undefined,
        amount: tx.amountInfo.amount,
        fee: tx.feeInfo?.networkFee,
        txHash: tx.txHash,
        createdAt: new Date(tx.createdAt),
        lastUpdated: new Date(tx.lastUpdated),
      }));

      return {
        transactions,
        nextPageToken: response.data.pageDetails.nextPage,
      };
    } catch (error) {
      this.logger.error('Failed to fetch transaction history', error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  /**
   * Retrieves a transaction by either Fireblocks transaction ID or external transaction ID.
   * If both IDs are provided, the Fireblocks ID will take precedence.
   *
   * @param params - Object containing either:
   *   - txId: Fireblocks transaction ID (takes precedence if both are provided)
   *   - externalTxId: Your external transaction ID
   *
   * @returns Promise resolving to transaction details
   * @throws InternalServerErrorException if the request fails
   * @throws Error if neither ID is provided
   */
  public async getTransaction(params: { txId?: string; externalTxId?: string }): Promise<ITransactionHistoryItem> {
    try {
      if (!params.txId && !params.externalTxId) {
        throw new Error('Either txId or externalTxId must be provided');
      }

      let response: { data: IFireblocksTransaction };

      if (params.txId) {
        this.logger.log(`Fetching transaction by Fireblocks ID: ${params.txId}`);
        response = await this.get<IFireblocksTransaction>(`/v1/transactions/${params.txId}`);
      } else {
        this.logger.log(`Fetching transaction by external ID: ${params.externalTxId}`);
        response = await this.get<IFireblocksTransaction>(`/v1/transactions/external_tx_id/${params.externalTxId}`);
      }

      const tx = response.data;

      return {
        id: tx.id,
        externalTxId: tx.externalTxId,
        status: tx.status,
        operation: tx.operation,
        assetId: tx.assetId,
        source: {
          type: tx.source.type,
          id: tx.source.id,
          address: tx.source.sourceAddress,
        },
        destination: tx.destination
          ? {
              type: tx.destination.type,
              id: tx.destination.id,
              address: tx.destination.destinationAddress,
              tag: tx.destination.destinationTag,
            }
          : undefined,
        amount: tx.amountInfo.amount,
        fee: tx.feeInfo?.networkFee,
        txHash: tx.txHash,
        createdAt: new Date(tx.createdAt),
        lastUpdated: new Date(tx.lastUpdated),
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch transaction ${params.txId ? `with ID ${params.txId}` : `with external ID ${params.externalTxId}`}, 
      ${error.stack}`,
      );
      throw new InternalServerErrorException(error.message);
    }
  }

  private buildFireblocksTransactionRequest(params: ICreateTransactionParams): IFireblocksCreateTransactionRequest {
    const requestBody: IFireblocksCreateTransactionRequest = {
      operation: params.operation || 'TRANSFER',
      note: params.note,
      externalTxId: params.externalTxId,
      assetId: params.assetId,
      source: {
        type: params.source.type,
        id: params.source.id,
        walletId: params.source.walletId,
        name: params.source.name,
      },
      destination: {
        type: params.destination.type,
        id: params.destination.id,
        walletId: params.destination.walletId,
        name: params.destination.name,
      },
      amount: params.amount,
      treatAsGrossAmount: params.treatAsGrossAmount,
      forceSweep: params.forceSweep,
      feeLevel: params.feeLevel,
      fee: params.fee,
      priorityFee: params.priorityFee,
      failOnLowFee: params.failOnLowFee,
      maxFee: params.maxFee,
      gasLimit: params.gasLimit,
      gasPrice: params.gasPrice,
      networkFee: params.networkFee,
      replaceTxByHash: params.replaceTxByHash,
      customerRefId: params.customerRefId,
      useGasless: params.useGasless,
    };

    // Handle ONE_TIME_ADDRESS destination type
    if (params.destination.type === 'ONE_TIME_ADDRESS' && params.destination.address) {
      (requestBody.destination as any).oneTimeAddress = {
        address: params.destination.address,
        tag: params.destination.tag,
      };
    }

    // Add travel rule message if provided
    if (params.travelRuleMessage) {
      requestBody.travelRuleMessage = this.buildTravelRuleMessage(params.travelRuleMessage);
    }

    return requestBody;
  }

  private buildTravelRuleMessage(travelRuleMessage: IFireblocksTravelRuleMessage): IFireblocksTravelRuleMessage {
    const message: IFireblocksTravelRuleMessage = {
      originatorVASPdid: travelRuleMessage.originatorVASPdid,
      beneficiaryVASPdid: travelRuleMessage.beneficiaryVASPdid,
      originatorVASPname: travelRuleMessage.originatorVASPname,
      beneficiaryVASPname: travelRuleMessage.beneficiaryVASPname,
      beneficiaryVASPwebsite: travelRuleMessage.beneficiaryVASPwebsite,
      encrypted: travelRuleMessage.encrypted,
      protocol: travelRuleMessage.protocol,
      skipBeneficiaryDataValidation: travelRuleMessage.skipBeneficiaryDataValidation,
      travelRuleBehavior: travelRuleMessage.travelRuleBehavior,
      originatorRef: travelRuleMessage.originatorRef,
      beneficiaryRef: travelRuleMessage.beneficiaryRef,
      travelRuleBehaviorRef: travelRuleMessage.travelRuleBehaviorRef,
      beneficiaryDid: travelRuleMessage.beneficiaryDid,
      originatorDid: travelRuleMessage.originatorDid,
      isNonCustodial: travelRuleMessage.isNonCustodial,
    };

    if (travelRuleMessage.originatorProof) {
      message.originatorProof = { ...travelRuleMessage.originatorProof };
    }
    if (travelRuleMessage.beneficiaryProof) {
      message.beneficiaryProof = { ...travelRuleMessage.beneficiaryProof };
    }
    return message;
  }

  /**
   * Builds query parameters for transaction history requests.
   * @param params Filtering and pagination parameters
   * @returns Query params as Record<string, string>
   */
  private buildTransactionHistoryQueryParams(params: ITransactionHistoryParams): Record<string, string> {
    const queryParams: Record<string, string> = {};

    const mappings: [keyof ITransactionHistoryParams, string][] = [
      ['status', 'status'],
      ['orderBy', 'orderBy'],
      ['sort', 'sort'],
      ['limit', 'limit'],
      ['sourceType', 'sourceType'],
      ['destType', 'destType'],
      ['assetId', 'assetId'],
      ['sourceId', 'sourceId'],
      ['nextPageToken', 'pageToken'],
    ];

    // Handle before/after with timestamp conversion
    if (params?.before) {
      const beforeTimestamp = params.before instanceof Date ? params.before.getTime() : params.before;
      queryParams.before = beforeTimestamp.toString();
    }
    if (params?.after) {
      const afterTimestamp = params.after instanceof Date ? params.after.getTime() : params.after;
      queryParams.after = afterTimestamp.toString();
    }

    for (const [paramKey, queryKey] of mappings) {
      const value = params[paramKey];
      if (value !== undefined && value !== null) {
        queryParams[queryKey] = value.toString();
      }
    }

    return queryParams;
  }

  /**
   * Verifies the signature of a Fireblocks webhook request.
   * Supports both v1 and v2 webhook signatures.
   *
   * @param payload - The webhook payload
   * @param signature - The webhook signature from X-Fireblocks-Signature header
   * @param timestamp - The timestamp from X-Fireblocks-Timestamp header
   * @param version - The webhook version ('v1' or 'v2')
   * @returns boolean indicating if the signature is valid
   */
  private async verifyWebhookSignature(
    payload: string,
    signature: string,
    timestamp: string,
    version: 'v1' | 'v2' = 'v1',
  ): Promise<boolean> {
    try {
      const config = new FireblocksConfigProvider().getConfig();

      if (version === 'v1') {
        // V1 webhooks use RSA-SHA512 signature verification
        if (!config.webhookPublicKey) {
          this.logger.error('Webhook public key not configured for v1 webhook verification');
          return false;
        }

        const verifier = createVerify('RSA-SHA512');
        verifier.write(payload);
        verifier.end();

        const isVerified = verifier.verify(config.webhookPublicKey, signature, 'base64');
        this.logger.debug(`V1 webhook signature verification result: ${isVerified}`);
        return isVerified;
      } else {
        // V2 webhooks use HMAC-SHA256 signature verification
        if (!config.webhookPublicKey) {
          this.logger.error('Webhook secret not configured for v2 webhook verification');
          return false;
        }

        const timestampNum = Number.parseInt(timestamp, 10);
        const now = Math.floor(Date.now() / 1000);

        // Check if timestamp is within 5 minutes
        if (Math.abs(now - timestampNum) > 300) {
          this.logger.warn('Webhook timestamp is too old or in the future');
          return false;
        }

        const message = `${timestamp}.${payload}`;
        const expectedSignature = createHmac('sha256', config.webhookPublicKey).update(message).digest('hex');

        const isVerified = signature === expectedSignature;
        this.logger.debug(`V2 webhook signature verification result: ${isVerified}`);
        return isVerified;
      }
    } catch (error) {
      this.logger.error('Error verifying webhook signature', error.stack);
      return false;
    }
  }

  /**
   * Handles incoming Fireblocks webhooks.
   * Supports both v1 and v2 webhook formats.
   *
   * @param payload - The webhook payload
   * @param signature - The webhook signature from X-Fireblocks-Signature header
   * @param timestamp - The timestamp from X-Fireblocks-Timestamp header (only for v2)
   * @param version - The webhook version ('v1' or 'v2')
   * @returns The processed webhook data
   * @throws InternalServerErrorException if webhook processing fails
   */
  public async handleWebhook(
    payload: string,
    signature: string,
    timestamp?: string,
    version: 'v1' | 'v2' = 'v2',
  ): Promise<IBlockchainWebhookPayload> {
    try {
      this.logger.log(`Processing Fireblocks webhook (${version})`);

      // Verify webhook signature
      if (!(await this.verifyWebhookSignature(payload, signature, timestamp || '', version))) {
        throw new Error('Invalid webhook signature');
      }

      // Parse payload
      const webhookData = JSON.parse(payload) as IFireblocksWebhookV1Payload | IFireblocksWebhookV2Payload;

      if (version === 'v1') {
        const v1Data = webhookData as IFireblocksWebhookV1Payload;
        this.logger.debug(`V1 Webhook type: ${v1Data.type}`);
        // Only log transaction-specific fields if it's a transaction webhook
        if ('id' in v1Data.data && 'status' in v1Data.data) {
          this.logger.debug(`Transaction ID: ${v1Data.data.id}`);
          this.logger.debug(`Status: ${v1Data.data.status}`);
        }
      } else {
        const v2Data = webhookData as IFireblocksWebhookV2Payload;
        this.logger.debug(`V2 Webhook eventType: ${v2Data.eventType}`);
        // Only log transaction-specific fields if it's a transaction webhook
        if ('id' in v2Data.data && 'status' in v2Data.data) {
          this.logger.debug(`Transaction ID: ${v2Data.data.id}`);
          this.logger.debug(`Status: ${v2Data.data.status}`);
        }
      }

      // Return normalized webhook data
      return this.normalizeWebhookData(webhookData);
    } catch (error) {
      this.logger.error('Failed to process Fireblocks webhook', error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  /**
   * Maps v1 event type to v2 event type
   * @param v1EventType - The v1 event type
   * @returns The corresponding v2 event type
   */
  public mapV1ToV2EventType(v1EventType: string): string {
    return FIREBLOCKS_V1_TO_V2_EVENT_TYPES[v1EventType as keyof typeof FIREBLOCKS_V1_TO_V2_EVENT_TYPES] || v1EventType;
  }

  /**
   * Maps v2 event type to v1 event type
   * @param v2EventType - The v2 event type
   * @returns The corresponding v1 event type
   */
  public mapV2ToV1EventType(v2EventType: string): string {
    return FIREBLOCKS_V2_TO_V1_EVENT_TYPES[v2EventType as keyof typeof FIREBLOCKS_V2_TO_V1_EVENT_TYPES] || v2EventType;
  }

  /**
   * Normalizes webhook data to a common format for internal processing
   * @param webhookData - The webhook data (v1 or v2)
   * @returns Normalized webhook data
   */
  public normalizeWebhookData(
    webhookData: IFireblocksWebhookV1Payload | IFireblocksWebhookV2Payload,
  ): IBlockchainWebhookPayload {
    if ('type' in webhookData) {
      // V1 webhook
      const v1Data = webhookData as IFireblocksWebhookV1Payload;

      // Handle vault account events
      if (v1Data.type === FireblocksV1EventType.VAULT_ACCOUNT_ADDED) {
        const vaultData = v1Data.data as IFireblocksVaultAccountWebhookData;
        return {
          type: v1Data.type,
          tenantId: v1Data.tenantId,
          timestamp: v1Data.timestamp,
          data: {
            id: vaultData.id,
            name: vaultData.name,
            hiddenOnUI: vaultData.hiddenOnUI,
            assets: vaultData.assets,
            customerRefId: vaultData.customerRefId,
            autoFuel: vaultData.autoFuel,
          },
        };
      }

      // Handle vault account asset added events
      if (v1Data.type === FireblocksV1EventType.VAULT_ACCOUNT_ASSET_ADDED) {
        const assetData = v1Data.data as IFireblocksVaultAccountAssetWebhookData;
        return {
          type: v1Data.type,
          tenantId: v1Data.tenantId,
          timestamp: v1Data.timestamp,
          data: {
            accountId: assetData.accountId,
            accountName: assetData.accountName,
            assetId: assetData.assetId,
          },
        };
      }

      // Handle transaction events (existing logic)
      const txData = v1Data.data as IFireblocksWebhookV1Data;
      return {
        type: v1Data.type,
        tenantId: v1Data.tenantId,
        timestamp: v1Data.timestamp,
        data: {
          id: txData.id,
          status: txData.status,
          subStatus: txData.subStatus,
          externalTxId: txData.externalTxId,
          txHash: txData.txHash,
          operation: txData.operation,
          createdBy: txData.createdBy,
          assetId: txData.assetId,
          source: {
            type: txData.source.type,
            id: txData.source.id,
            sourceAddress: txData.sourceAddress,
          },
          destination: txData.destination
            ? {
                type: txData.destination.type,
                id: txData.destination.id,
                destinationAddress: txData.destinationAddress,
                destinationTag: txData.destinationTag,
              }
            : undefined,
          amountInfo: {
            amount: txData.amountInfo.amount,
          },
          feeInfo: txData.feeInfo,
          createdAt: txData.createdAt,
          lastUpdated: txData.lastUpdated,
        },
      };
    } else {
      // V2 webhook
      const v2Data = webhookData as IFireblocksWebhookV2Payload;

      // Handle vault account events
      if (v2Data.eventType === FireblocksV2EventType.VAULT_ACCOUNT_CREATED) {
        const vaultData = v2Data.data as any;
        return {
          eventType: v2Data.eventType,
          id: v2Data.id,
          eventVersion: v2Data.eventVersion,
          resourceId: v2Data.resourceId,
          createdAt: v2Data.createdAt,
          workspaceId: v2Data.workspaceId,
          data: {
            id: vaultData.id,
            name: vaultData.name,
            hiddenOnUI: vaultData.hiddenOnUI,
            assets: vaultData.assets,
            customerRefId: vaultData.customerRefId,
            autoFuel: vaultData.autoFuel,
          },
        };
      }

      // Handle vault account asset added events
      if (v2Data.eventType === FireblocksV2EventType.VAULT_ACCOUNT_ASSET_ADDED) {
        const assetData = v2Data.data as any;
        return {
          eventType: v2Data.eventType,
          id: v2Data.id,
          eventVersion: v2Data.eventVersion,
          resourceId: v2Data.resourceId,
          createdAt: v2Data.createdAt,
          workspaceId: v2Data.workspaceId,
          data: {
            accountId: assetData.accountId,
            accountName: assetData.accountName,
            assetId: assetData.assetId,
          },
        };
      }

      return {
        eventType: v2Data.eventType,
        id: v2Data.id,
        eventVersion: v2Data.eventVersion,
        resourceId: v2Data.resourceId,
        createdAt: v2Data.createdAt,
        workspaceId: v2Data.workspaceId,
        data: {
          id: v2Data.data.id,
          status: v2Data.data.status,
          subStatus: v2Data.data.subStatus,
          externalTxId: v2Data.data.externalTxId,
          createdBy: v2Data.data.createdBy,
          txHash: v2Data.data.txHash,
          operation: v2Data.data.operation,
          assetId: v2Data.data.assetId,
          source: {
            type: v2Data.data.source.type,
            id: v2Data.data.source.id || '',
            sourceAddress: v2Data.data.sourceAddress,
          },
          destination: v2Data.data.destination
            ? {
                type: v2Data.data.destination.type,
                id: v2Data.data.destination.id || '',
                destinationAddress: v2Data.data.destinationAddress,
                destinationTag: v2Data.data.destinationTag,
              }
            : undefined,
          amountInfo: {
            amount: v2Data.data.amountInfo.amount,
          },
          feeInfo: v2Data.data.feeInfo,
          createdAt: v2Data.data.createdAt,
          lastUpdated: v2Data.data.lastUpdated,
        },
      };
    }
  }

  /**
   * Resends webhook notifications - either for a specific transaction or all failed webhooks
   *
   * @param params - Parameters for resending webhooks:
   *   - txId: Optional transaction ID to resend specific webhooks
   *   - resendCreated: Whether to resend the "created" webhook (required if txId provided)
   *   - resendStatusUpdated: Whether to resend the "status updated" webhook (required if txId provided)
   * @returns Response indicating success or count of resent notifications
   * @throws InternalServerErrorException if the request fails
   */
  public async resendWebhook(params?: IBlockchainResendWebhookRequest): Promise<IBlockchainResendWebhookResponse> {
    try {
      if (params?.txId) {
        this.logger.log(`Resending webhooks for transaction ${params.txId}`);

        const response = await this.post<{ success: boolean }>(`/v1/webhooks/resend/${params.txId}`, {
          resendCreated: params.resendCreated || true,
          resendStatusUpdated: params.resendStatusUpdated || true,
        });

        this.logger.log(`Successfully resent webhooks for transaction ${params.txId}`);
        return {
          success: response.data.success,
          message: response.data.success ? 'Webhooks resent successfully' : 'Failed to resend webhooks',
        };
      } else {
        this.logger.log(`Resending all failed webhooks`);

        const response = await this.post<{ messagesCount: number }>('/v1/webhooks/resend', {});

        this.logger.log(`Successfully resent ${response.data.messagesCount} webhooks`);
        return {
          messagesCount: response.data.messagesCount,
          message: `Successfully resent ${response.data.messagesCount} webhooks`,
        };
      }
    } catch (error) {
      this.logger.error('Failed to resend webhooks', error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }
}
