export interface ModelPricing {
  /** USD per 1M input (prompt) tokens. */
  inputPerM: number;
  /** USD per 1M output (completion) tokens. */
  outputPerM: number;
  /** USD per 1M cached input tokens. */
  cachedInputPerM: number;
}

export interface AgentModelOption {
  id: string;
  label: string;
  pricing: ModelPricing;
}

// Extend this list as more models get BYOK'd onto the gateway.
export const AGENT_MODELS: AgentModelOption[] = [
  {
    id: '@cf/moonshotai/kimi-k2.7-code',
    label: 'Kimi K2.7 Code (Workers AI)',
    pricing: { inputPerM: 0.95, outputPerM: 4.0, cachedInputPerM: 0.19 }
  }
];

export function getModelPricing(modelId: string): ModelPricing | null {
  return AGENT_MODELS.find((model) => model.id === modelId)?.pricing ?? null;
}

export interface SessionUsage {
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
}

export function calculateCost(usage: SessionUsage, pricing: ModelPricing): number {
  const uncachedInputTokens = Math.max(usage.promptTokens - usage.cachedTokens, 0);
  const inputCost = (uncachedInputTokens / 1_000_000) * pricing.inputPerM;
  const cachedCost = (usage.cachedTokens / 1_000_000) * pricing.cachedInputPerM;
  const outputCost = (usage.completionTokens / 1_000_000) * pricing.outputPerM;
  return inputCost + cachedCost + outputCost;
}
