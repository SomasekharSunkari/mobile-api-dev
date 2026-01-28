import { JSONSchema } from 'objection';
import { DoshPointsTransactionType } from './doshPointsEvent.interface';

export const DoshPointsEventValidationSchema: JSONSchema = {
  type: 'object',
  title: 'Dosh Points Event Validation Schema',
  required: ['code', 'name', 'transaction_type', 'default_points', 'is_active', 'is_one_time_per_user'],
  properties: {
    code: { type: 'string' },
    name: { type: 'string' },
    description: { type: ['string', 'null'] },
    transaction_type: {
      type: 'string',
      enum: Object.values(DoshPointsTransactionType),
    },
    default_points: { type: 'integer', minimum: 0 },
    is_active: { type: 'boolean' },
    is_one_time_per_user: { type: 'boolean' },
    metadata: { type: ['object', 'null'] },
    start_date: { type: ['string', 'null'], format: 'date-time' },
    end_date: { type: ['string', 'null'], format: 'date-time' },
  },
};
