import { z } from 'zod';

export const FindingCategorySchema = z.enum([
  'environment',
  'database',
  'aws',
  'messaging',
  'integration',
  'infrastructure',
]);
export type FindingCategory = z.infer<typeof FindingCategorySchema>;

export const FindingOperationSchema = z.enum(['added', 'removed', 'changed']);
export type FindingOperation = z.infer<typeof FindingOperationSchema>;

export const FindingConfidenceSchema = z.enum(['high', 'medium']);
export type FindingConfidence = z.infer<typeof FindingConfidenceSchema>;

export const FindingSchema = z.object({
  application: z.string(),
  category: FindingCategorySchema,
  subject: z.string(),
  operation: FindingOperationSchema,
  repositoryPath: z.string(),
  filePath: z.string(),
  line: z.number().int().positive().optional(),
  evidence: z.string(),
  confidence: FindingConfidenceSchema,
});
export type Finding = z.infer<typeof FindingSchema>;
