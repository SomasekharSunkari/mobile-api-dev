import { Inject, Injectable, Logger } from '@nestjs/common';
import { BlockchainGasFundTransactionRepository } from './blockchainGasFundTransaction.repository';
import {
  BlockchainGasFundTransactionModel,
  IBlockchainGasFundTransaction,
} from '../../database/models/blockchain_gas_fund_transaction';
import { TransactionStatus } from '../../database/models/transaction';

@Injectable()
export class BlockchainGasFundTransactionService {
  private readonly logger = new Logger(BlockchainGasFundTransactionService.name);

  @Inject(BlockchainGasFundTransactionRepository)
  private readonly blockchainGasFundTransactionRepository: BlockchainGasFundTransactionRepository;

  async create(data: Partial<IBlockchainGasFundTransaction>): Promise<BlockchainGasFundTransactionModel> {
    this.logger.log(`Creating gas fund transaction for user ${data.user_id} and wallet ${data.blockchain_wallet_id}`);

    const transaction = await this.blockchainGasFundTransactionRepository.create(data);
    this.logger.log(`Gas fund transaction created with ID: ${transaction.id}`);

    return transaction;
  }

  async findById(id: string): Promise<BlockchainGasFundTransactionModel | null> {
    return (await this.blockchainGasFundTransactionRepository.findById(id)) as BlockchainGasFundTransactionModel | null;
  }

  async findByUser(userId: string): Promise<BlockchainGasFundTransactionModel[]> {
    return await this.blockchainGasFundTransactionRepository.findByUser(userId);
  }

  async findByWallet(walletId: string): Promise<BlockchainGasFundTransactionModel[]> {
    return await this.blockchainGasFundTransactionRepository.findByWallet(walletId);
  }

  async findByStatus(status: TransactionStatus): Promise<BlockchainGasFundTransactionModel[]> {
    return await this.blockchainGasFundTransactionRepository.findByStatus(status);
  }

  async findByProviderReference(providerReference: string): Promise<BlockchainGasFundTransactionModel | null> {
    return await this.blockchainGasFundTransactionRepository.findByProviderReference(providerReference);
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<BlockchainGasFundTransactionModel | null> {
    return await this.blockchainGasFundTransactionRepository.findByIdempotencyKey(idempotencyKey);
  }

  async findByUserAndWallet(userId: string, walletId: string): Promise<BlockchainGasFundTransactionModel[]> {
    return await this.blockchainGasFundTransactionRepository.findByUserAndWallet(userId, walletId);
  }

  async findPendingByUser(userId: string): Promise<BlockchainGasFundTransactionModel[]> {
    return await this.blockchainGasFundTransactionRepository.findPendingByUser(userId);
  }

  async findFirstPendingByUser(userId: string): Promise<BlockchainGasFundTransactionModel | null> {
    return await this.blockchainGasFundTransactionRepository.findFirstPendingByUser(userId);
  }

  async update(id: string, data: Partial<IBlockchainGasFundTransaction>): Promise<BlockchainGasFundTransactionModel> {
    this.logger.log(`Updating gas fund transaction ${id}`);

    const transaction = await this.blockchainGasFundTransactionRepository.update(id, data);
    this.logger.log(`Gas fund transaction ${id} updated`);

    return transaction;
  }

  async updateStatus(
    id: string,
    status: TransactionStatus,
    metadata?: Record<string, any>,
  ): Promise<BlockchainGasFundTransactionModel> {
    this.logger.log(`Updating gas fund transaction ${id} status to ${status}`);

    const updateData: Partial<IBlockchainGasFundTransaction> = { status };
    if (metadata) {
      // Get existing transaction to merge metadata
      const existingTransaction = await this.blockchainGasFundTransactionRepository.findById(id);
      const existingMetadata = existingTransaction?.metadata || {};
      updateData.metadata = { ...existingMetadata, ...metadata };
    }

    const transaction = await this.blockchainGasFundTransactionRepository.update(id, updateData);
    this.logger.log(`Gas fund transaction ${id} status updated to ${status}`);

    return transaction;
  }

  async updateProviderReference(id: string, providerReference: string): Promise<BlockchainGasFundTransactionModel> {
    this.logger.log(`Updating gas fund transaction ${id} provider reference to ${providerReference}`);

    const transaction = await this.blockchainGasFundTransactionRepository.update(id, {
      provider_reference: providerReference,
    });
    this.logger.log(`Gas fund transaction ${id} provider reference updated`);

    return transaction;
  }

  async updateTxHash(id: string, txHash: string): Promise<BlockchainGasFundTransactionModel> {
    this.logger.log(`Updating gas fund transaction ${id} tx hash to ${txHash}`);

    const transaction = await this.blockchainGasFundTransactionRepository.update(id, { tx_hash: txHash });
    this.logger.log(`Gas fund transaction ${id} tx hash updated`);

    return transaction;
  }

  async markAsFailed(id: string, failureReason: string): Promise<BlockchainGasFundTransactionModel> {
    this.logger.log(`Marking gas fund transaction ${id} as failed: ${failureReason}`);

    const transaction = await this.blockchainGasFundTransactionRepository.update(id, {
      status: TransactionStatus.FAILED,
      failure_reason: failureReason,
    });
    this.logger.log(`Gas fund transaction ${id} marked as failed`);

    return transaction;
  }

  async markAsCompleted(id: string, txHash?: string, networkFee?: string): Promise<BlockchainGasFundTransactionModel> {
    this.logger.log(`Marking gas fund transaction ${id} as completed`);

    const updateData: Partial<IBlockchainGasFundTransaction> = {
      status: TransactionStatus.COMPLETED,
    };

    if (txHash) {
      updateData.tx_hash = txHash;
    }

    if (networkFee) {
      updateData.network_fee = networkFee;
    }

    const transaction = await this.blockchainGasFundTransactionRepository.update(id, updateData);
    this.logger.log(`Gas fund transaction ${id} marked as completed`);

    return transaction;
  }

  async delete(id: string): Promise<void> {
    this.logger.log(`Deleting gas fund transaction ${id}`);

    await this.blockchainGasFundTransactionRepository.delete(id);
    this.logger.log(`Gas fund transaction ${id} deleted`);
  }
}
