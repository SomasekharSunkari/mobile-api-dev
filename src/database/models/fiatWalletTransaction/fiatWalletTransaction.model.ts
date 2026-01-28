import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { ExternalAccountModel } from '../externalAccount/externalAccount.model';
import { FiatWalletModel } from '../fiatWallet/fiatWallet.model';
import { TransactionModel, TransactionStatus } from '../transaction';
import { UserModel } from '../user/user.model';
import { VirtualAccountModel } from '../virtualAccount/virtualAccount.model';
import { FiatWalletTransactionType, IFiatWalletTransaction } from './fiatWalletTransaction.interface';
import { FiatWalletTransactionValidationSchema } from './fiatWalletTransaction.validation';

export class FiatWalletTransactionModel extends BaseModel implements IFiatWalletTransaction {
  public transaction_id: IFiatWalletTransaction['transaction_id'];
  public fiat_wallet_id: IFiatWalletTransaction['fiat_wallet_id'];
  public user_id: IFiatWalletTransaction['user_id'];
  public transaction_type: IFiatWalletTransaction['transaction_type'];
  public amount: IFiatWalletTransaction['amount'];
  public balance_before: IFiatWalletTransaction['balance_before'];
  public balance_after: IFiatWalletTransaction['balance_after'];
  public currency: IFiatWalletTransaction['currency'];
  public status: IFiatWalletTransaction['status'];

  // Provider details
  public provider: IFiatWalletTransaction['provider'];
  public provider_reference: IFiatWalletTransaction['provider_reference'];
  public provider_quote_ref: IFiatWalletTransaction['provider_quote_ref'];
  public provider_request_ref: IFiatWalletTransaction['provider_request_ref'];
  public provider_fee: IFiatWalletTransaction['provider_fee'];
  public provider_metadata: IFiatWalletTransaction['provider_metadata'];

  // Source/destination
  public source: IFiatWalletTransaction['source'];
  public destination: IFiatWalletTransaction['destination'];

  // External account reference
  public external_account_id: IFiatWalletTransaction['external_account_id'];

  // Additional info
  public description: IFiatWalletTransaction['description'];
  public failure_reason: IFiatWalletTransaction['failure_reason'];

  // Timestamps
  public processed_at: IFiatWalletTransaction['processed_at'];
  public completed_at: IFiatWalletTransaction['completed_at'];
  public failed_at: IFiatWalletTransaction['failed_at'];
  public settled_at: IFiatWalletTransaction['settled_at'];

  // Relationships
  public transaction?: IFiatWalletTransaction['transaction'];
  public fiat_wallet?: IFiatWalletTransaction['fiat_wallet'];
  public user?: IFiatWalletTransaction['user'];
  public externalAccount?: IFiatWalletTransaction['externalAccount'];
  public virtualAccount?: IFiatWalletTransaction['virtualAccount'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.fiat_wallet_transactions}`;
  }

  static publicProperty(properties: (keyof IFiatWalletTransaction)[] = []): (keyof IFiatWalletTransaction)[] {
    return [
      'id',
      'transaction_id',
      'fiat_wallet_id',
      'user_id',
      'transaction_type',
      'amount',
      'balance_before',
      'balance_after',
      'currency',
      'status',
      'provider',
      'provider_reference',
      'provider_quote_ref',
      'provider_request_ref',
      'provider_fee',
      'source',
      'destination',
      'description',
      'created_at',
      'updated_at',
      'processed_at',
      'completed_at',
      'failed_at',
      ...properties,
    ];
  }

  static get jsonSchema() {
    return FiatWalletTransactionValidationSchema;
  }

  static get relationMappings() {
    return {
      transaction: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: TransactionModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.fiat_wallet_transactions}.transaction_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.transactions}.id`,
        },
      },
      fiat_wallet: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: FiatWalletModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.fiat_wallet_transactions}.fiat_wallet_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.fiat_wallets}.id`,
        },
      },
      user: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.fiat_wallet_transactions}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        },
      },
      externalAccount: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: ExternalAccountModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.fiat_wallet_transactions}.external_account_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.external_accounts}.id`,
        },
      },
      virtualAccount: {
        relation: BaseModel.HasOneRelation,
        modelClass: VirtualAccountModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.fiat_wallet_transactions}.fiat_wallet_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.virtual_accounts}.fiat_wallet_id`,
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
      deposits(query) {
        query.where('transaction_type', FiatWalletTransactionType.DEPOSIT);
      },
      withdrawals(query) {
        query.where('transaction_type', FiatWalletTransactionType.WITHDRAWAL);
      },
      transfersIn(query) {
        query.where('transaction_type', FiatWalletTransactionType.TRANSFER_IN);
      },
      transfersOut(query) {
        query.where('transaction_type', FiatWalletTransactionType.TRANSFER_OUT);
      },
    };
  }
}
