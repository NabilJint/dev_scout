import { z } from 'zod';

export const AnalysisSchema = z.object({
  summary: z.string(),
  adoptionScore: z.number().min(-1).max(1),
  adoptionLabel: z.enum(['early-stage', 'growing', 'established']),
  toolRatingLabel: z.enum(['beginner-friendly', 'balanced', 'power-user', 'mixed', 'unclear']),
  beginnerFriendlyPercentage: z.number().int().min(0).max(100),
  balancedPercentage: z.number().int().min(0).max(100),
  powerUserPercentage: z.number().int().min(0).max(100),
  confidence: z.number().min(0).max(1),
  mainPurpose: z.string(),
  category: z.string(),
  targetUsers: z.string(),
  keyFeatures: z.array(z.string()),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  pricingModel: z.enum(['free', 'freemium', 'paid', 'usage-based', 'enterprise', 'unclear']),
  integrations: z.array(z.string()),
  bestFor: z.string(),
  marketingBuzzwords: z.array(z.string()),
  ratingNotes: z.string(),
  disclaimer: z.string(),
}).refine(
  (data) => data.beginnerFriendlyPercentage + data.balancedPercentage + data.powerUserPercentage === 100,
  { message: 'beginnerFriendlyPercentage + balancedPercentage + powerUserPercentage must equal 100', path: ['beginnerFriendlyPercentage'] }
);

export type AnalysisOutput = z.infer<typeof AnalysisSchema>;

export function computeComplexityScore(output: AnalysisOutput): number {
  return (output.powerUserPercentage - output.beginnerFriendlyPercentage) / 100;
}
