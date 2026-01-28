import { JSONSchema } from 'objection';
import { WaitlistFeature, WaitlistReason } from './waitlist.interface';

export const WaitlistValidationSchema: JSONSchema = {
  type: 'object',
  title: 'Waitlist Validation Schema',
  required: ['user_id', 'user_email', 'reason', 'feature'],
  properties: {
    user_id: { type: 'string' },
    user_email: { type: 'string', format: 'email' },
    reason: {
      type: 'string',
      enum: [WaitlistReason.PHYSICAL_CARDS, WaitlistReason.LOCATION_UNBLOCKED],
    },
    feature: {
      type: 'string',
      enum: [WaitlistFeature.CARD, WaitlistFeature.TRANSFER],
    },
  },
};
