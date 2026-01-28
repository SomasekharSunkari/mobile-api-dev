import { JSONSchema } from 'objection';

/**
 * JSON Schema for fee configuration structure
 */
const FeeConfigSchema: JSONSchema = {
  type: 'object',
  required: ['value', 'is_percentage'],
  properties: {
    value: { type: 'number', default: 0 },
    currency: { type: ['string', 'null'] },
    is_percentage: { type: 'boolean', default: false },
  },
};

/**
 * JSON Schema for NGN withdrawal fee with cap
 */
const NgnWithdrawalFeeSchema: JSONSchema = {
  type: 'object',
  required: ['value', 'is_percentage', 'cap'],
  properties: {
    value: { type: 'number', default: 0 },
    is_percentage: { type: 'boolean', default: false },
    cap: { type: 'number', default: 0 },
  },
};

/**
 * JSON Schema for fiat exchange configuration
 */
const FiatExchangeSchema: JSONSchema = {
  type: 'object',
  properties: {
    service_fee: FeeConfigSchema,
    partner_fee: FeeConfigSchema,
    disbursement_fee: FeeConfigSchema,
    ngn_withdrawal_fee: NgnWithdrawalFeeSchema,
  },
};

/**
 * JSON Schema for the main config structure
 * Uses additionalProperties: true to allow future use case categories
 */
const ConfigSchema: JSONSchema = {
  type: 'object',
  required: ['is_active'],
  additionalProperties: true,
  properties: {
    fiat_exchange: FiatExchangeSchema,
    is_active: { type: 'boolean', default: true },
  },
};

export const RateConfigValidationSchema: JSONSchema = {
  type: 'object',
  title: 'Rate Config Validation Schema',
  required: ['provider', 'config'],
  properties: {
    provider: { type: 'string', minLength: 1, maxLength: 255 },
    config: ConfigSchema,
    description: { type: ['string', 'null'] },
  },
};
