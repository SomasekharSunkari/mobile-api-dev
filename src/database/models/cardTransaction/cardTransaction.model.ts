import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { CardModel } from '../card/card.model';
import { CardUserModel } from '../cardUser/cardUser.model';
import { UserModel } from '../user/user.model';
import { TransactionModel } from '../transaction/transaction.model';
import { ICardTransaction } from './cardTransaction.interface';
import { CardTransactionValidationSchema } from './cardTransaction.validation';

export class CardTransactionModel extends BaseModel implements ICardTransaction {
  public user_id: ICardTransaction['user_id'];
  public card_user_id: ICardTransaction['card_user_id'];

  public amount: ICardTransaction['amount'];
  public provider_reference: ICardTransaction['provider_reference'];
  public currency: ICardTransaction['currency'];
  public transactionhash: ICardTransaction['transactionhash'];
  public authorized_amount: ICardTransaction['authorized_amount'];
  public authorization_method: ICardTransaction['authorization_method'];
  public merchant_name: ICardTransaction['merchant_name'];
  public merchant_id: ICardTransaction['merchant_id'];
  public merchant_city: ICardTransaction['merchant_city'];
  public merchant_country: ICardTransaction['merchant_country'];
  public merchant_category: ICardTransaction['merchant_category'];
  public merchant_category_code: ICardTransaction['merchant_category_code'];
  public card_id: ICardTransaction['card_id'];
  public status: ICardTransaction['status'];
  public declined_reason: ICardTransaction['declined_reason'];
  public authorized_at: ICardTransaction['authorized_at'];

  public balance_before: ICardTransaction['balance_before'];
  public balance_after: ICardTransaction['balance_after'];
  public transaction_type: ICardTransaction['transaction_type'];
  public type: ICardTransaction['type'];

  public description: ICardTransaction['description'];
  public fee: ICardTransaction['fee'];
  public provider_fee_reference: ICardTransaction['provider_fee_reference'];
  public is_fee_settled: ICardTransaction['is_fee_settled'];

  public parent_exchange_transaction_id: ICardTransaction['parent_exchange_transaction_id'];

  public cardUser?: ICardTransaction['cardUser'];
  public card?: ICardTransaction['card'];
  public user?: ICardTransaction['user'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.card_transactions}`;
  }

  static publicProperty(properties: (keyof ICardTransaction)[] = []): (keyof ICardTransaction)[] {
    return [
      'id',
      'user_id',
      'card_user_id',
      'card_id',
      'amount',
      'provider_reference',
      'currency',
      'transactionhash',
      'authorized_amount',
      'authorization_method',
      'merchant_name',
      'merchant_id',
      'merchant_city',
      'merchant_country',
      'merchant_category',
      'merchant_category_code',
      'status',
      'declined_reason',
      'authorized_at',
      'balance_before',
      'balance_after',
      'transaction_type',
      'type',
      'description',
      'fee',
      'provider_fee_reference',
      'is_fee_settled',
      'parent_exchange_transaction_id',
      'created_at',
      'updated_at',
      ...properties,
    ];
  }

  static get jsonSchema() {
    return CardTransactionValidationSchema;
  }

  static get relationMappings() {
    return {
      user: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.card_transactions}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        },
      },
      cardUser: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: CardUserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.card_transactions}.card_user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.card_users}.id`,
        },
      },
      card: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: CardModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.card_transactions}.card_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.cards}.id`,
        },
      },
      parentExchangeTransaction: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: TransactionModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.card_transactions}.parent_exchange_transaction_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.transactions}.id`,
        },
      },
    };
  }

  static get modifiers() {
    return {
      notDeleted(query) {
        query.whereNull('deleted_at');
      },
    };
  }
}
