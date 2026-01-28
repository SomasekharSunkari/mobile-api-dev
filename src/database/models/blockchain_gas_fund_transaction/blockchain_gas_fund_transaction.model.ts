import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { UserModel } from '../user/user.model';
import { BlockchainWalletModel } from '../blockchain_wallet/blockchain_wallet.model';
import { TransactionStatus } from '../transaction';
import { IBlockchainGasFundTransaction } from './blockchain_gas_fund_transaction.interface';
import { BlockchainGasFundTransactionValidationSchema } from './blockchain_gas_fund_transaction.validation';

export class BlockchainGasFundTransactionModel extends BaseModel implements IBlockchainGasFundTransaction {
  public user_id: IBlockchainGasFundTransaction['user_id'];
  public blockchain_wallet_id: IBlockchainGasFundTransaction['blockchain_wallet_id'];
  public native_asset_id: IBlockchainGasFundTransaction['native_asset_id'];
  public amount: IBlockchainGasFundTransaction['amount'];
  public status: IBlockchainGasFundTransaction['status'];
  public provider_reference?: IBlockchainGasFundTransaction['provider_reference'];
  public tx_hash?: IBlockchainGasFundTransaction['tx_hash'];
  public failure_reason?: IBlockchainGasFundTransaction['failure_reason'];
  public network_fee?: IBlockchainGasFundTransaction['network_fee'];
  public idempotency_key?: IBlockchainGasFundTransaction['idempotency_key'];
  public metadata?: IBlockchainGasFundTransaction['metadata'];

  // Relationships
  public user?: IBlockchainGasFundTransaction['user'];
  public blockchain_wallet?: IBlockchainGasFundTransaction['blockchain_wallet'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.blockchain_gas_fund_transactions}`;
  }

  static publicProperty(
    properties: (keyof IBlockchainGasFundTransaction)[] = [],
  ): (keyof IBlockchainGasFundTransaction)[] {
    return [
      'id',
      'user_id',
      'blockchain_wallet_id',
      'native_asset_id',
      'amount',
      'status',
      'provider_reference',
      'tx_hash',
      'failure_reason',
      'network_fee',
      'idempotency_key',
      'metadata',
      'created_at',
      'updated_at',
      ...properties,
    ];
  }

  static get jsonSchema() {
    return BlockchainGasFundTransactionValidationSchema;
  }

  static get relationMappings() {
    return {
      user: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.blockchain_gas_fund_transactions}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        },
      },
      blockchain_wallet: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: BlockchainWalletModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.blockchain_gas_fund_transactions}.blockchain_wallet_id`,
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
        query.where('status', TransactionStatus.PENDING);
      },
      completed(query) {
        query.where('status', TransactionStatus.COMPLETED);
      },
      failed(query) {
        query.where('status', TransactionStatus.FAILED);
      },
      forUser(query, userId: string) {
        query.where('user_id', userId);
      },
      forWallet(query, walletId: string) {
        query.where('blockchain_wallet_id', walletId);
      },
    };
  }
}
