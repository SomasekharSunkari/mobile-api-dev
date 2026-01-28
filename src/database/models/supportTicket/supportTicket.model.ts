import { JSONSchema } from 'objection';
import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { UserModel } from '../user';
import { ISupportTicket } from './supportTicket.interface';
import { SupportTicketValidationSchema } from './supportTicket.validation';

export class SupportTicketModel extends BaseModel implements ISupportTicket {
  public id: ISupportTicket['id'];
  public user_id?: ISupportTicket['user_id'];
  public ticket_number: ISupportTicket['ticket_number'];
  public subject: ISupportTicket['subject'];
  public description: ISupportTicket['description'];
  public content: ISupportTicket['content'];
  public status: ISupportTicket['status'];
  public channel: ISupportTicket['channel'];
  public resolved_at?: ISupportTicket['resolved_at'];
  public created_at: ISupportTicket['created_at'];
  public updated_at: ISupportTicket['updated_at'];
  public deleted_at: ISupportTicket['deleted_at'];

  public user?: ISupportTicket['user'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.support_tickets}`;
  }

  static get jsonSchema(): JSONSchema {
    return SupportTicketValidationSchema;
  }

  static get relationMappings() {
    return {
      user: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.support_tickets}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
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
