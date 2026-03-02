import { z } from 'zod';

export const dialectEnum = z.enum(['ANSI_SQL', 'SNOWFLAKE', 'MDX', 'TABLEAU', 'DATABRICKS']);

export const vendorEnum = z.enum(['COMMON', 'SNOWFLAKE', 'SALESFORCE', 'DBT', 'DATABRICKS']);

export const aiContextObjectSchema = z.object({
  instructions: z.string().optional(),
  synonyms: z.array(z.string()).optional(),
  examples: z.array(z.string()).optional(),
});

export const aiContextSchema = z.union([z.string(), aiContextObjectSchema]);

export const customExtensionSchema = z.object({
  vendor_name: vendorEnum,
  data: z.string(),
});

export const dialectExpressionSchema = z.object({
  dialect: dialectEnum,
  expression: z.string(),
});

export const expressionSchema = z.object({
  dialects: z.array(dialectExpressionSchema),
});

export const dimensionSchema = z.object({
  is_time: z.boolean().optional(),
});

export const osiFieldSchema = z.object({
  name: z.string(),
  expression: expressionSchema,
  dimension: dimensionSchema.optional(),
  label: z.string().optional(),
  description: z.string().optional(),
  ai_context: aiContextSchema.optional(),
  custom_extensions: z.array(customExtensionSchema).optional(),
});

export const osiDatasetSchema = z.object({
  name: z.string(),
  source: z.string(),
  primary_key: z.array(z.string()).optional(),
  unique_keys: z.array(z.array(z.string())).optional(),
  description: z.string().optional(),
  ai_context: aiContextSchema.optional(),
  fields: z.array(osiFieldSchema).optional(),
  custom_extensions: z.array(customExtensionSchema).optional(),
});

export const osiRelationshipSchema = z.object({
  name: z.string(),
  from: z.string(),
  to: z.string(),
  from_columns: z.array(z.string()),
  to_columns: z.array(z.string()),
  ai_context: aiContextSchema.optional(),
  custom_extensions: z.array(customExtensionSchema).optional(),
});

export const osiMetricSchema = z.object({
  name: z.string(),
  expression: expressionSchema,
  description: z.string().optional(),
  ai_context: aiContextSchema.optional(),
  custom_extensions: z.array(customExtensionSchema).optional(),
});

export const osiSemanticModelSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  ai_context: aiContextSchema.optional(),
  datasets: z.array(osiDatasetSchema),
  relationships: z.array(osiRelationshipSchema).optional(),
  metrics: z.array(osiMetricSchema).optional(),
  custom_extensions: z.array(customExtensionSchema).optional(),
});

export const osiDocumentSchema = z.object({
  version: z.literal('1.0'),
  semantic_model: z.array(osiSemanticModelSchema),
});
