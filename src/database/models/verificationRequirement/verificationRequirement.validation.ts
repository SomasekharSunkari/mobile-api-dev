import { JSONSchema } from 'objection';

export const VerificationRequirementValidationSchema: JSONSchema = {
  type: 'object',
  title: 'Verification Requirement Validation Schema',
  required: ['name'],
  properties: {
    name: { type: 'string' },
  },
};
