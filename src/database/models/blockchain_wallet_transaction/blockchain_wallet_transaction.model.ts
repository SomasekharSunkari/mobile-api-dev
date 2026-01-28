import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { BlockchainWalletModel } from '../blockchain_wallet/blockchain_wallet.model';
import { TransactionModel, TransactionStatus } from '../transaction';
import {
  BlockchainWalletTransactionType,
  IBlockchainWalletTransaction,
} from './blockchain_wallet_transaction.interface';
import { TransactionScope } from '../transaction';
import { BlockchainWalletTransactionValidationSchema } from './blockchain_wallet_transaction.validation';

export class BlockchainWalletTransactionModel extends BaseModel implements IBlockchainWalletTransaction {
  public blockchain_wallet_id: IBlockchainWalletTransaction['blockchain_wallet_id'];
  public provider_reference?: IBlockchainWalletTransaction['provider_reference'];
  public asset: IBlockchainWalletTransaction['asset'];
  public amount: IBlockchainWalletTransaction['amount'];
  public balance_before: IBlockchainWalletTransaction['balance_before'];
  public balance_after: IBlockchainWalletTransaction['balance_after'];
  public transaction_type: IBlockchainWalletTransaction['transaction_type'];
  public status: IBlockchainWalletTransaction['status'];
  public transaction_scope: IBlockchainWalletTransaction['transaction_scope'];
  public metadata?: IBlockchainWalletTransaction['metadata'];
  public description?: IBlockchainWalletTransaction['description'];
  public tx_hash?: IBlockchainWalletTransaction['tx_hash'];
  public failure_reason?: IBlockchainWalletTransaction['failure_reason'];
  public main_transaction_id?: IBlockchainWalletTransaction['main_transaction_id'];
  public peer_wallet_id?: IBlockchainWalletTransaction['peer_wallet_id'];
  public peer_wallet_address?: IBlockchainWalletTransaction['peer_wallet_address'];
  public intiated_by?: IBlockchainWalletTransaction['intiated_by'];
  public signed_by?: IBlockchainWalletTransaction['signed_by'];
  public network_fee?: IBlockchainWalletTransaction['network_fee'];
  public parent_id?: IBlockchainWalletTransaction['parent_id'];
  public idempotency_key?: string;
  public type?: 'debit' | 'credit';
  // Relationships
  public transaction?: IBlockchainWalletTransaction['transaction'];
  public blockchain_wallet?: IBlockchainWalletTransaction['blockchain_wallet'];
  public user?: IBlockchainWalletTransaction['user'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.blockchain_wallet_transactions}`;
  }

  static publicProperty(
    properties: (keyof IBlockchainWalletTransaction)[] = [],
  ): (keyof IBlockchainWalletTransaction)[] {
    return [
      'id',
      'blockchain_wallet_id',
      'provider_reference',
      'asset',
      'amount',
      'balance_before',
      'balance_after',
      'transaction_type',
      'status',
      'transaction_scope',
      'metadata',
      'description',
      'tx_hash',
      'failure_reason',
      'main_transaction_id',
      'peer_wallet_id',
      'peer_wallet_address',
      'intiated_by',
      'signed_by',
      'network_fee',
      'parent_id',
      'idempotency_key',
      'type',
      'created_at',
      'updated_at',
      ...properties,
    ];
  }

  static get jsonSchema() {
    return BlockchainWalletTransactionValidationSchema;
  }

  static get relationMappings() {
    return {
      transaction: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: TransactionModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.blockchain_wallet_transactions}.main_transaction_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.transactions}.id`,
        },
      },
      blockchain_wallet: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: BlockchainWalletModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.blockchain_wallet_transactions}.blockchain_wallet_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.blockchain_wallets}.id`,
        },
      },
    };
  }

  static get modifiers() {
    return {
      notDeleted(query) {
        query.whereNull('deleted_at');
      },
      pending(query) {
        query.where(`${BlockchainWalletTransactionModel.tableName}.status`, TransactionStatus.PENDING);
      },
      processing(query) {
        query.where(`${BlockchainWalletTransactionModel.tableName}.status`, TransactionStatus.PROCESSING);
      },
      completed(query) {
        query.where(`${BlockchainWalletTransactionModel.tableName}.status`, TransactionStatus.COMPLETED);
      },
      failed(query) {
        query.where(`${BlockchainWalletTransactionModel.tableName}.status`, TransactionStatus.FAILED);
      },
      deposits(query) {
        query.where('transaction_type', BlockchainWalletTransactionType.DEPOSIT);
      },
      withdrawals(query) {
        query.where('transaction_type', BlockchainWalletTransactionType.WITHDRAWAL);
      },
      transfersIn(query) {
        query.where('transaction_type', BlockchainWalletTransactionType.TRANSFER_IN);
      },
      transfersOut(query) {
        query.where('transaction_type', BlockchainWalletTransactionType.TRANSFER_OUT);
      },
      refunds(query) {
        query.where('transaction_type', BlockchainWalletTransactionType.REFUND);
      },
      fees(query) {
        query.where('transaction_type', BlockchainWalletTransactionType.FEE);
      },
      exchanges(query) {
        query.where('transaction_type', BlockchainWalletTransactionType.SWAP);
      },
      reversals(query) {
        query.where('transaction_type', BlockchainWalletTransactionType.REVERSAL);
      },
      debit(query) {
        query.where('type', 'debit');
      },
      credit(query) {
        query.where('type', 'credit');
      },
      internal(query) {
        query.where('transaction_scope', TransactionScope.INTERNAL);
      },
      external(query) {
        query.where('transaction_scope', TransactionScope.EXTERNAL);
      },
    };
  }

  // If there are $parseJson or $formatJson methods, add 'type' mapping
  $parseDatabaseJson(json: any) {
    const parsed = super.$parseDatabaseJson(json);
    if (parsed.type) {
      parsed.type = parsed.type as 'debit' | 'credit';
    }
    return parsed;
  }

  $formatDatabaseJson(json: any) {
    const formatted = super.$formatDatabaseJson(json);
    if (formatted.type) {
      formatted.type = formatted.type as 'debit' | 'credit';
    }
    return formatted;
  }
}
