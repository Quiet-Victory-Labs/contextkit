import { z } from 'zod';

export const trustStatusEnum = z.enum(['endorsed', 'warning', 'deprecated']);
export const securityClassificationEnum = z.enum(['public', 'internal', 'confidential', 'secret']);
export const tableTypeEnum = z.enum(['fact', 'dimension', 'bridge', 'snapshot', 'event', 'aggregate', 'view']);
export const semanticRoleEnum = z.enum(['metric', 'dimension', 'identifier', 'date']);
export const defaultAggregationEnum = z.enum(['SUM', 'AVG', 'COUNT', 'COUNT_DISTINCT', 'MIN', 'MAX']);

export const datasetGovernanceSchema = z.object({
  grain: z.string(),
  refresh: z.string().optional(),
  table_type: tableTypeEnum,
  security: securityClassificationEnum.optional(),
});

export const fieldGovernanceSchema = z.object({
  semantic_role: semanticRoleEnum.optional(),
  default_aggregation: defaultAggregationEnum.optional(),
  additive: z.boolean().optional(),
  default_filter: z.string().optional(),
  sample_values: z.array(z.string()).optional(),
});

/** Validates that all keys in a fields record use "dataset.field" dot notation. */
const dottedFieldsRecord = z.record(z.string(), fieldGovernanceSchema).refine(
  (rec) => Object.keys(rec).every((key) => /^[^.]+\.[^.]+$/.test(key)),
  { message: 'Field keys must use "dataset.field" dot notation (e.g., "orders.amount")' },
);

export const businessContextSchema = z.object({
  name: z.string(),
  description: z.string(),
});

export const governanceFileSchema = z.object({
  model: z.string(),
  owner: z.string(),
  version: z.string().optional(),
  trust: trustStatusEnum.optional(),
  security: securityClassificationEnum.optional(),
  tags: z.array(z.string()).optional(),
  business_context: z.array(businessContextSchema).optional(),
  datasets: z.record(z.string(), datasetGovernanceSchema).optional(),
  fields: dottedFieldsRecord.optional(),
});
