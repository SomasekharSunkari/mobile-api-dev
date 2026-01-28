import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { BlockchainWalletTransactionModel } from '../blockchain_wallet_transaction/blockchain_wallet_transaction.model';
import { CardTransactionModel } from '../cardTransaction/cardTransaction.model';
import { FiatWalletTransactionModel } from '../fiatWalletTransaction/fiatWalletTransaction.model';
import { UserModel } from '../user/user.model';
import { ITransaction, TransactionStatus } from './transaction.interface';
import { TransactionValidationSchema } from './transaction.validation';

export class TransactionModel extends BaseModel implements ITransaction {
  public user_id: ITransaction['user_id'];
  public parent_transaction_id: ITransaction['parent_transaction_id'];
  public reference: ITransaction['reference'];
  public external_reference: ITransaction['external_reference'];
  public asset: ITransaction['asset'];
  public amount: ITransaction['amount'];
  public balance_before: ITransaction['balance_before'];
  public balance_after: ITransaction['balance_after'];
  public transaction_type: ITransaction['transaction_type'];
  public status: ITransaction['status'];
  public category: ITransaction['category'];
  public transaction_scope: ITransaction['transaction_scope'];
  public metadata: ITransaction['metadata'];
  public description: ITransaction['description'];
  public ip_address: ITransaction['ip_address'];
  public user_agent: ITransaction['user_agent'];
  public completed_at: ITransaction['completed_at'];
  public failed_at: ITransaction['failed_at'];
  public processed_at: ITransaction['processed_at'];
  public failure_reason: ITransaction['failure_reason'];
  public user?: ITransaction['user'];
  public fiatWalletTransaction?: ITransaction['fiatWalletTransaction'];
  public blockchainWalletTransaction?: ITransaction['blockchainWalletTransaction'];
  public cardTransaction?: ITransaction['cardTransaction'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.transactions}`;
  }

  static publicProperty(properties: (keyof ITransaction)[] = []): (keyof ITransaction)[] {
    return [
      'id',
      'user_id',
      'parent_transaction_id',
      'reference',
      'external_reference',
      'asset',
      'amount',
      'balance_before',
      'balance_after',
      'transaction_type',
      'status',
      'category',
      'transaction_scope',
      'description',
      'created_at',
      'updated_at',
      'completed_at',
      'failed_at',
      ...properties,
    ];
  }

  static get jsonSchema() {
    return TransactionValidationSchema;
  }

  static get relationMappings() {
    return {
      user: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.transactions}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        },
      },
      fiatWalletTransaction: {
        relation: BaseModel.HasOneRelation,
        modelClass: FiatWalletTransactionModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.transactions}.id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.fiat_wallet_transactions}.transaction_id`,
        },
      },
      blockchainWalletTransaction: {
        relation: BaseModel.HasOneRelation,
        modelClass: BlockchainWalletTransactionModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.transactions}.id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.blockchain_wallet_transactions}.main_transaction_id`,
        },
      },
      cardTransaction: {
        relation: BaseModel.HasOneRelation,
        modelClass: CardTransactionModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.transactions}.reference`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.card_transactions}.provider_reference`,
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
        query.where('status', TransactionStatus.PENDING);
      },
      processing(query) {
        query.where('status', TransactionStatus.PROCESSING);
      },
      completed(query) {
        query.where('status', TransactionStatus.COMPLETED);
      },
      failed(query) {
        query.where('status', TransactionStatus.FAILED);
      },
      cancelled(query) {
        query.where('status', TransactionStatus.CANCELLED);
      },
    };
  }
}
