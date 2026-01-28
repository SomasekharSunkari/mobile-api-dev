import { Inject, Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { FireblocksConfigProvider } from '../../config';
import {
  IBlockchainResendWebhookRequest,
  IBlockchainResendWebhookResponse,
  IBlockchainWaasManagement,
  IBlockchainWebhookPayload,
  ICreateAccountParams,
  ICreateAccountResponse,
  ICreateTransactionParams,
  ICreateTransactionResponse,
  ICreateWalletParams,
  ICreateWalletResponse,
  IEstimateExternalFeeParams,
  IEstimateInternalTransferFeeParams,
  IEstimateTransactionFeeParams,
  IExternalTransferParams,
  IFeeEstimateResponse,
  IInternalTransferParams,
  IStableAsset,
  ITransactionHistoryItem,
  ITransactionHistoryParams,
  ITransactionHistoryResponse,
  ITransferResponse,
  IVaultAccount,
  IVaultAsset,
  IVaultAssetTransactionHistoryParams,
  IVaultAssetTransactionHistoryResponse,
} from './blockchain-waas-adapter.interface';
import { FireblocksAdapter } from './fireblocks/fireblocks_adapter';
import { BlockchainAccountProvider } from '../../database/models/blockchain_account';

@Injectable()
export class BlockchainWaasAdapter implements IBlockchainWaasManagement {
  private readonly logger = new Logger(BlockchainWaasAdapter.name);

  @Inject(FireblocksAdapter)
  private readonly FireblocksAdapter: FireblocksAdapter;

  getProvider(): IBlockchainWaasManagement {
    const provider = new FireblocksConfigProvider().getConfig().default_blockchain_waas_adapter;
    this.logger.debug(`Selected WaaS provider: ${provider}`);

    if (provider === BlockchainAccountProvider.FIREBLOCKS) {
      return this.FireblocksAdapter;
    } else {
      this.logger.error(`Unsupported blockchain WaaS provider: ${provider}`);
      throw new Error(`Unsupported blockchain WaaS provider: ${provider}`);
    }
  }

  async getAvailableStableAssets(): Promise<IStableAsset[]> {
    const provider = this.getProvider();

    this.logger.log('Fetching available stable assets...');
    const response = await provider.getAvailableStableAssets();
    this.logger.log(`Fetched ${response.length} stable assets.`);
    return response;
  }

  async createAccount(params: ICreateAccountParams): Promise<ICreateAccountResponse> {
    const provider = this.getProvider();
    this.logger.log(`Creating account for user ${params.user_name} - (${params.user_id})...`);

    const accountResponse = await provider.createAccount(params);

    this.logger.log(`Successfully created account and wallets for user ${params.user_name}`);
    return accountResponse;
  }

  async createWallet(params: ICreateWalletParams): Promise<ICreateWalletResponse> {
    const provider = this.getProvider();
    this.logger.log(
      `Creating wallets for vault ${params.provider_account_ref} and assets ${params.asset_ids.join(', ')}...`,
    );

    const response = await provider.createWallet(params);

    this.logger.log(
      `Wallet creation completed. Successful: ${response.successful.length}, Failed: ${response.failed.length}`,
    );
    return response;
  }

  public async getVaultAccount(vaultAccountId: string): Promise<IVaultAccount> {
    const provider = this.getProvider();
    this.logger.log(`Retrieving vault account with ID: ${vaultAccountId}`);
    return await provider.getVaultAccount(vaultAccountId);
  }

  public async getAssetBalance(vaultAccountId: string, assetId: string): Promise<IVaultAsset> {
    const provider = this.getProvider();
    this.logger.log(`Retrieving balance for asset ${assetId} in vault account ${vaultAccountId}`);
    return await provider.getAssetBalance(vaultAccountId, assetId);
  }

  async estimateInternalTransferFee(params: IEstimateInternalTransferFeeParams): Promise<IFeeEstimateResponse> {
    const provider = this.getProvider();
    this.logger.log(
      `Estimating internal transfer fee for ${params.assetId} between vaults ${params.sourceVaultId} and ${params.destinationVaultId}`,
    );
    return await provider.estimateTransactionFee({
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

  async estimateExternalTransactionFee(params: IEstimateExternalFeeParams): Promise<IFeeEstimateResponse> {
    const provider = this.getProvider();
    this.logger.log(
      `Estimating external transaction fee for ${params.assetId} from vault ${params.sourceVaultId} to ${params.destinationAddress}`,
    );
    return await provider.estimateTransactionFee({
      assetId: params.assetId,
      amount: params.amount,
      source: {
        type: 'VAULT_ACCOUNT',
        id: params.sourceVaultId,
      },
      destination: {
        type: 'ONE_TIME_ADDRESS',
        address: params.destinationAddress,
        tag: params.destinationTag,
      },
      operation: 'TRANSFER',
      feeLevel: params.feeLevel,
    });
  }

  public async internalTransfer(params: IInternalTransferParams): Promise<ITransferResponse> {
    const provider = this.getProvider();
    this.logger.log(
      `Creating internal transfer of ${params.amount} ${params.assetId} ` +
        `from vault ${params.sourceVaultId} to vault ${params.destinationVaultId}`,
    );

    return await provider.internalTransfer(params);
  }

  public async externalTransfer(params: IExternalTransferParams): Promise<ITransferResponse> {
    const provider = this.getProvider();
    this.logger.log(
      `Creating external transfer of ${params.amount} ${params.assetId} ` +
        `from vault ${params.sourceVaultId} to address ${params.destinationAddress}` +
        (params.destinationTag ? ` (tag: ${params.destinationTag})` : ''),
    );

    return await provider.externalTransfer(params);
  }

  public async getVaultAssetTransactionHistory(
    params: IVaultAssetTransactionHistoryParams,
  ): Promise<IVaultAssetTransactionHistoryResponse> {
    const provider = this.getProvider();
    this.logger.log(
      `Fetching transaction history for vault ${params.vaultAccountId}` +
        (params.assetId ? ` and asset ${params.assetId}` : ''),
    );

    const queryParams: ITransactionHistoryParams = {
      sourceId: params.vaultAccountId,
      sourceType: 'VAULT_ACCOUNT',
      assetId: params.assetId,
      before: params.before,
      after: params.after,
      status: params.status,
      limit: params.limit,
      nextPageToken: params.nextPageToken,
      orderBy: 'createdAt',
      sort: 'DESC',
    };

    const history = await provider.getTransactionHistory(queryParams);

    this.logger.log(
      `Found ${history.transactions.length} transactions for vault ${params.vaultAccountId}` +
        (params.assetId ? ` and asset ${params.assetId}` : ''),
    );

    return history;
  }

  public async getTransaction(params: { txId?: string; externalTxId?: string }): Promise<ITransactionHistoryItem> {
    const provider = this.getProvider();

    if (params.txId) {
      this.logger.log(`Fetching transaction by ${params.externalTxId ? 'Fireblocks' : ''} ID: ${params.txId}`);
    } else if (params.externalTxId) {
      this.logger.log(`Fetching transaction by external ID: ${params.externalTxId}`);
    }

    try {
      return await provider.getTransaction(params);
    } catch (error) {
      this.logger.error(`Failed to fetch transaction: ${params.txId ? params.txId : params.externalTxId}`, error.stack);
      throw error;
    }
  }

  estimateTransactionFee(params: IEstimateTransactionFeeParams): Promise<IFeeEstimateResponse> {
    throw new NotImplementedException(`Not Implemented ${params}`);
  }

  createTransaction(params: ICreateTransactionParams): Promise<ICreateTransactionResponse> {
    throw new NotImplementedException(`Not Implemented ${params}`);
  }

  getTransactionHistory(params: ITransactionHistoryParams): Promise<ITransactionHistoryResponse> {
    throw new NotImplementedException(`Not Implemented ${params}`);
  }

  public async handleWebhook(
    payload: string,
    signature: string,
    timestamp: string,
    version: 'v1' | 'v2' = 'v1',
  ): Promise<IBlockchainWebhookPayload> {
    const provider = this.getProvider();
    this.logger.log(`Processing blockchain webhook (${version})`);
    return await provider.handleWebhook(payload, signature, timestamp, version);
  }

  public async resendWebhook(params?: IBlockchainResendWebhookRequest): Promise<IBlockchainResendWebhookResponse> {
    const provider = this.getProvider();

    if (params?.txId) {
      this.logger.log(`Resending webhooks for transaction ${params.txId}`);
    } else {
      this.logger.log(`Resending all failed webhooks`);
    }

    return await provider.resendWebhook(params);
  }
}
