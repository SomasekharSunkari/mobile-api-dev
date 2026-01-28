import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Transaction } from 'objection';
import { FetchQuery, IPaginatedResponse } from '../../database/base/base.interface';
import {
  IPagaLedgerTransaction,
  PagaLedgerTransactionStatus,
} from '../../database/models/pagaLedgerTransaction/pagaLedgerTransaction.interface';
import { PagaLedgerTransactionModel } from '../../database/models/pagaLedgerTransaction/pagaLedgerTransaction.model';
import { PagaLedgerTransactionRepository } from './pagaLedgerTransaction.repository';

@Injectable()
export class PagaLedgerTransactionService {
  @Inject(PagaLedgerTransactionRepository)
  private readonly pagaLedgerTransactionRepository: PagaLedgerTransactionRepository;

  private readonly logger = new Logger(PagaLedgerTransactionService.name);

  /**
   * Create a new Paga ledger transaction
   * Checks if a transaction with the same reference_number already exists before creating.
   */
  async create(
    data: Omit<IPagaLedgerTransaction, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>,
    trx?: Transaction,
  ): Promise<PagaLedgerTransactionModel> {
    try {
      this.logger.log(`Creating Paga ledger transaction for account: ${data.account_number}`);

      // Check if transaction with the same reference_number already exists within transaction context
      const existingTransaction = await this.pagaLedgerTransactionRepository.findOne(
        { reference_number: data.reference_number },
        undefined,
        { trx },
      );

      if (existingTransaction) {
        this.logger.warn(
          `Paga ledger transaction with reference_number ${data.reference_number} already exists for account ${data.account_number}`,
        );
        throw new BadRequestException('Paga ledger transaction with reference_number already exists');
      }

      return await this.pagaLedgerTransactionRepository.create(
        {
          ...data,
          status: data.status || 'PENDING',
        },
        trx,
      );
    } catch (error) {
      this.logger.error(
        `Error creating Paga ledger transaction for account ${data.account_number}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(error.message);
    }
  }

  /**
   * Update the status of a Paga ledger transaction by ID
   */
  async update(
    id: string,
    status: PagaLedgerTransactionStatus,
    trx?: Transaction,
  ): Promise<PagaLedgerTransactionModel> {
    try {
      this.logger.log(`Updating Paga ledger transaction status: ${id} to ${status}`);

      const existingTransaction = await this.pagaLedgerTransactionRepository.findById(id, undefined, trx);

      if (!existingTransaction) {
        throw new NotFoundException(`Paga ledger transaction with ID ${id} not found`);
      }

      return await this.pagaLedgerTransactionRepository.update(id, { status }, { trx });
    } catch (error) {
      this.logger.error(`Error updating Paga ledger transaction ${id}: ${error.message}`, error.stack);

      throw new InternalServerErrorException('Failed to update Paga ledger transaction status');
    }
  }

  /**
   * Find all Paga ledger transactions with pagination
   */
  async findAll(params?: FetchQuery): Promise<IPaginatedResponse<PagaLedgerTransactionModel>> {
    try {
      this.logger.log('Finding all Paga ledger transactions');

      return await this.pagaLedgerTransactionRepository.findAll({}, params);
    } catch (error) {
      this.logger.error(`Error finding all Paga ledger transactions: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to retrieve Paga ledger transactions');
    }
  }

  /**
   * Find one Paga ledger transaction by filter
   */
  async findOne(
    filter: Partial<IPagaLedgerTransaction>,
    trx?: Transaction,
  ): Promise<PagaLedgerTransactionModel | null> {
    try {
      this.logger.log(`Finding Paga ledger transaction with filter: ${JSON.stringify(filter)}`);

      const transaction = await this.pagaLedgerTransactionRepository.findOne(filter, undefined, { trx });

      return transaction || null;
    } catch (error) {
      this.logger.error(
        `Error finding Paga ledger transaction with filter ${JSON.stringify(filter)}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to find Paga ledger transaction');
    }
  }

  /**
   * Delete a Paga ledger transaction by ID
   */
  async delete(id: string): Promise<void> {
    try {
      this.logger.log(`Deleting Paga ledger transaction: ${id}`);

      const existingTransaction = await this.pagaLedgerTransactionRepository.findById(id);

      if (!existingTransaction) {
        throw new NotFoundException(`Paga ledger transaction with ID ${id} not found`);
      }

      await this.pagaLedgerTransactionRepository.delete(id);
    } catch (error) {
      this.logger.error(`Error deleting Paga ledger transaction ${id}: ${error.message}`, error.stack);

      throw new InternalServerErrorException('Failed to delete Paga ledger transaction');
    }
  }
}
