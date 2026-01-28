import { JSONSchema } from 'objection';
import { AccountDeactivationStatus } from './accountDeactivationLog.interface';

export const AccountDeactivationLogValidation: JSONSchema = {
  type: 'object',
  title: 'AccountDeactivationLog Schema Validation',
  required: ['reasons', 'user_id', 'status'],
  properties: {
    user_id: { type: 'string' },
    reasons: { type: 'array', items: { type: 'string' } },
    deactivated_on: { type: 'string' },
    deactivated_by_user_id: { type: 'string' },
    status: { type: 'string', enum: Object.values(AccountDeactivationStatus) },
    is_active_log: { type: 'boolean' },
    reactivated_on: { type: 'string' },
    reactivated_by_user_id: { type: 'string' },
    reactivation_description: { type: ['string', 'null'] },
    reactivation_support_document_url: { type: ['string', 'null'] },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
    deleted_at: { type: 'string' },
  },
};
